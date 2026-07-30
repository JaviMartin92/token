// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IYieldStreamingVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";

/**
 * @title YieldStreamingVault
 * @notice Distributes yield accumulated from yield vaults and consensus staking.
 *         Supports gasless signature-based claims using EIP-712.
 */
contract YieldStreamingVault is IYieldStreamingVault, Ownable, ReentrancyGuard {
    bytes32 public constant CLAIM_TYPEHASH = keccak256(
        "ClaimRequest(address user,uint256 amount,uint256 nonce,uint256 deadline)"
    );
    
    bytes32 public immutable DOMAIN_SEPARATOR;
    address public immutable yieldToken; // Stablecoin token for yield payouts (e.g. USDC/EURC)

    mapping(address => uint256) public nonces;
    mapping(address => uint256) public lastYieldUpdateTimestamp;
    uint256 public compoundingApyBps = 645; // 6.45% Morpho Blue Auto-Compounding APY

    event CompoundingApyUpdated(uint256 newApyBps);

    constructor(address _yieldToken, address _initialOwner) Ownable() {
        yieldToken = _yieldToken;

        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("YieldStreamingVault"),
                keccak256("1"),
                chainId,
                address(this)
            )
        );

        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    function setCompoundingApyBps(uint256 newApyBps) external onlyOwner {
        compoundingApyBps = newApyBps;
        emit CompoundingApyUpdated(newApyBps);
    }

    function _calculateCompoundedYield(address user) internal view returns (uint256) {
        uint256 base = pendingYields[user];
        if (base == 0) return 0;
        uint256 lastTs = lastYieldUpdateTimestamp[user];
        if (lastTs == 0 || block.timestamp <= lastTs) return base;

        uint256 elapsedSeconds = block.timestamp - lastTs;
        uint256 extraYield = (base * compoundingApyBps * elapsedSeconds) / (10000 * 365 days);
        return base + extraYield;
    }

    /**
     * @notice Allows governance/operator to add yield allocations to users.
     */
    function allocateYield(address user, uint256 amount) external onlyOwner {
        require(user != address(0), "YieldStreamingVault: Zero address");
        require(amount > 0, "YieldStreamingVault: Amount must be > 0");

        pendingYields[user] = _calculateCompoundedYield(user) + amount;
        lastYieldUpdateTimestamp[user] = block.timestamp;
    }

    /**
     * @inheritdoc IYieldStreamingVault
     */
    function claimYield(uint256 amount) external override nonReentrant {
        require(amount > 0, "YieldStreamingVault: Claim amount must be > 0");
        uint256 currentYield = _calculateCompoundedYield(msg.sender);
        require(currentYield >= amount, "YieldStreamingVault: Insufficient yield balance");

        pendingYields[msg.sender] = currentYield - amount;
        lastYieldUpdateTimestamp[msg.sender] = block.timestamp;
        
        // Execute yield payout transfer
        uint256 bal = IERC20(yieldToken).balanceOf(address(this));
        uint256 payout = amount > bal ? bal : amount;
        require(IERC20(yieldToken).transfer(msg.sender, payout), "YieldStreamingVault: yield transfer failed");
        
        emit YieldClaimed(msg.sender, payout, false);
    }

    /**
     * @inheritdoc IYieldStreamingVault
     */
    function claimYieldGasless(
        ClaimRequest calldata request,
        bytes calldata signature
    ) external override nonReentrant {
        require(request.deadline >= block.timestamp, "YieldStreamingVault: Signature expired");
        require(request.nonce == nonces[request.user]++, "YieldStreamingVault: Invalid nonce");
        
        uint256 currentYield = _calculateCompoundedYield(request.user);
        require(currentYield >= request.amount, "YieldStreamingVault: Insufficient yield balance");

        // Construct EIP-712 structural digest
        bytes32 structHash = keccak256(
            abi.encode(
                CLAIM_TYPEHASH,
                request.user,
                request.amount,
                request.nonce,
                request.deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        
        // Recover and verify signer
        address signer = ECDSA.recover(digest, signature);
        require(signer == request.user, "YieldStreamingVault: Invalid signature");

        pendingYields[request.user] = currentYield - request.amount;
        lastYieldUpdateTimestamp[request.user] = block.timestamp;

        // Execute yield payout transfer to user
        uint256 bal = IERC20(yieldToken).balanceOf(address(this));
        uint256 payout = request.amount > bal ? bal : request.amount;
        require(IERC20(yieldToken).transfer(request.user, payout), "YieldStreamingVault: yield transfer failed");
        
        emit YieldClaimed(request.user, payout, true);
    }

    /**
     * @inheritdoc IYieldStreamingVault
     */
    function getPendingYield(address user) external view override returns (uint256) {
        return _calculateCompoundedYield(user);
    }
}
