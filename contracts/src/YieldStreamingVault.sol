// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IYieldStreamingVault.sol";
import "./interfaces/IProtocolErrors.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";

/**
 * @title YieldStreamingVault
 * @author Viraje Protocol Architecture Team
 * @notice Distributes accumulated real yield with support for gasless claims via EIP-712 signatures.
 * @dev Unclaimed yields continuously auto-compound over time according to `compoundingApyBps`, capped
 *      strictly by physical vault surplus to eliminate unbacked yield creation.
 */
contract YieldStreamingVault is IYieldStreamingVault, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================================================================
    // ⚠️ DOMAIN CUSTOM ERRORS (EIP-838)
    // =========================================================================
    error SignatureExpired();
    error InvalidNonce();
    error InvalidSignature();
    error InsufficientYieldBalance(uint256 requested, uint256 available);

    // =========================================================================
    // 🔏 CANONICAL CONSTANTS & EIP-712 DOMAIN
    // =========================================================================
    /// @notice Canonical Basis Points Denominator (10,000 = 100.00%)
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Maximum Permissible Compounding APY (5,000 BPS = 50.00%)
    uint256 public constant MAX_COMPOUNDING_APY_BPS = 5000;

    /// @notice Annual seconds base (365 days)
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    /* solhint-disable gas-small-strings */
    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("ClaimRequest(address user,uint256 amount,uint256 nonce,uint256 deadline)");

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    /* solhint-enable gas-small-strings */

    bytes32 private immutable _cachedDomainSeparator;
    uint256 private immutable _cachedChainId;
    bytes32 private immutable _hashedName;
    bytes32 private immutable _hashedVersion;

    /// @notice Canonical collateral stablecoin used for yield payouts (USDC).
    address public immutable yieldToken;

    // =========================================================================
    // 📦 STATE & ACCOUNTING REGISTERS
    // =========================================================================
    mapping(address => uint256) public nonces;
    mapping(address => uint256) public pendingYields;
    mapping(address => uint256) public lastYieldUpdateTimestamp;
    uint256 public totalUnclaimedPrincipal;

    /// @notice Annual auto-compounding interest rate (default 6.45% = 645 BPS).
    uint256 public compoundingApyBps = 645;

    event CompoundingApyUpdated(uint256 newApyBps);
    event YieldAllocated(address indexed user, uint256 amount, uint256 newTotalYield);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Initializes the YieldStreamingVault with settlement token, admin, and EIP-712 domain separator.
     * @param _yieldToken ERC-20 token address used for yield distributions (USDC).
     * @param _initialOwner Genesis governance administrator (TimelockController in production).
     */
    constructor(address _yieldToken, address _initialOwner) {
        if (_yieldToken == address(0) || _initialOwner == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }

        yieldToken = _yieldToken;

        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialOwner);

        _hashedName = keccak256("YieldStreamingVault");
        _hashedVersion = keccak256("1");
        _cachedChainId = block.chainid;
        _cachedDomainSeparator = _buildDomainSeparator();
    }

    /**
     * @dev Builds EIP-712 domain separator preventing cross-chain replay attacks.
     */
    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                _hashedName,
                _hashedVersion,
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice Returns the active EIP-712 domain separator, recalculating upon hard-fork.
     */
    /* solhint-disable-next-line func-name-mixedcase */
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return block.chainid == _cachedChainId ? _cachedDomainSeparator : _buildDomainSeparator();
    }

    /**
     * @notice Updates the annual auto-compounding APY within strict sanity bounds.
     * @param newApyBps New APY in basis points (Maximum 50.00% = 5000 BPS).
     */
    function setCompoundingApyBps(uint256 newApyBps) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (newApyBps > MAX_COMPOUNDING_APY_BPS) revert IProtocolErrors.InvalidParameters();
        compoundingApyBps = newApyBps;
        emit CompoundingApyUpdated(newApyBps);
    }

    /**
     * @notice Rescues accidentally transferred ERC-20 tokens (excluding the backing yield token).
     * @dev Strictly prohibits sweeping the canonical yieldToken to guarantee 100% principal backing.
     * @param token Address of the token to sweep.
     * @param to Destination address receiving the swept tokens.
     */
    function sweepTokens(address token, address to) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        if (token == yieldToken) revert IProtocolErrors.InvalidParameters();

        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) revert IProtocolErrors.InvalidAmount();

        IERC20(token).safeTransfer(to, bal);
        emit TokensSwept(token, to, bal);
    }

    /**
     * @dev Calculates total accumulated yield with continuous compounding over time, capped by physical vault surplus.
     */
    function _calculateCompoundedYield(address user) internal view returns (uint256) {
        uint256 base = pendingYields[user];
        if (base == 0 || compoundingApyBps == 0) return base;
        uint256 lastTs = lastYieldUpdateTimestamp[user];
        if (lastTs == 0 || block.timestamp <= lastTs) return base;

        uint256 elapsedSeconds = block.timestamp - lastTs;
        uint256 extraYield = (base * compoundingApyBps * elapsedSeconds) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
        uint256 vaultBal = IERC20(yieldToken).balanceOf(address(this));
        uint256 availableSurplus = vaultBal > totalUnclaimedPrincipal ? vaultBal - totalUnclaimedPrincipal : 0;
        if (extraYield > availableSurplus) {
            extraYield = availableSurplus;
        }
        return base + extraYield;
    }

    /**
     * @notice Allocates earned yield to a designated user account, pulling backing collateral tokens.
     * @param user Beneficiary user address.
     * @param amount Gross amount of yield to allocate.
     */
    function allocateYield(address user, uint256 amount) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (user == address(0)) revert IProtocolErrors.ZeroAddress();
        if (amount == 0) revert IProtocolErrors.ZeroAmount();

        // Pull backing yield tokens to ensure 100% physical solvency
        IERC20(yieldToken).safeTransferFrom(msg.sender, address(this), amount);

        uint256 compounded = _calculateCompoundedYield(user);
        uint256 accruedExtra = compounded - pendingYields[user];

        uint256 newTotal = compounded + amount;
        pendingYields[user] = newTotal;
        totalUnclaimedPrincipal += amount + accruedExtra;
        lastYieldUpdateTimestamp[user] = block.timestamp;

        emit YieldAllocated(user, amount, newTotal);
    }

    /**
     * @notice Claims accumulated yield and transfers it directly to caller.
     * @dev Reverts if the vault lacks sufficient liquidity, protecting user's accounting balance.
     * @param amount Exact yield amount to withdraw.
     */
    function claimYield(uint256 amount) external override nonReentrant {
        if (amount == 0) revert IProtocolErrors.ZeroAmount();
        uint256 currentYield = _calculateCompoundedYield(msg.sender);
        if (currentYield < amount) revert InsufficientYieldBalance(amount, currentYield);

        uint256 bal = IERC20(yieldToken).balanceOf(address(this));
        if (bal < amount) revert InsufficientYieldBalance(amount, bal);

        if (totalUnclaimedPrincipal >= amount) {
            totalUnclaimedPrincipal -= amount;
        } else {
            totalUnclaimedPrincipal = 0;
        }

        pendingYields[msg.sender] = currentYield - amount;
        lastYieldUpdateTimestamp[msg.sender] = block.timestamp;

        IERC20(yieldToken).safeTransfer(msg.sender, amount);

        emit YieldClaimed(msg.sender, amount, false);
    }

    /**
     * @notice Allows gasless yield claims via EIP-712 digital signatures transmitted by a relayer/keeper.
     * @param request Struct containing user, amount, nonce, and deadline.
     * @param signature ECDSA signature generated by user's wallet.
     */
    function claimYieldGasless(ClaimRequest calldata request, bytes calldata signature) external override nonReentrant {
        if (request.deadline < block.timestamp) revert SignatureExpired();
        uint256 currentNonce = nonces[request.user];
        if (request.nonce != currentNonce) revert InvalidNonce();
        unchecked {
            ++nonces[request.user];
        }

        uint256 currentYield = _calculateCompoundedYield(request.user);
        if (currentYield < request.amount) revert InsufficientYieldBalance(request.amount, currentYield);

        uint256 bal = IERC20(yieldToken).balanceOf(address(this));
        if (bal < request.amount) revert InsufficientYieldBalance(request.amount, bal);

        // Build EIP-712 structured hash
        bytes32 structHash =
            keccak256(abi.encode(CLAIM_TYPEHASH, request.user, request.amount, request.nonce, request.deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));

        // Recover and verify signer
        address signer = ECDSA.recover(digest, signature);
        if (signer != request.user) revert InvalidSignature();

        if (totalUnclaimedPrincipal >= request.amount) {
            totalUnclaimedPrincipal -= request.amount;
        } else {
            totalUnclaimedPrincipal = 0;
        }

        pendingYields[request.user] = currentYield - request.amount;
        lastYieldUpdateTimestamp[request.user] = block.timestamp;

        IERC20(yieldToken).safeTransfer(request.user, request.amount);

        emit YieldClaimed(request.user, request.amount, true);
    }

    /**
     * @notice View pending claimable yield in real-time including continuous auto-compounded bonus.
     * @param user User address to query.
     * @return Total claimable yield in yieldToken units.
     */
    function getPendingYield(address user) external view override returns (uint256) {
        return _calculateCompoundedYield(user);
    }
}
