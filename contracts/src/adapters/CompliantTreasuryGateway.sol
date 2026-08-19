// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../lib/security/ReentrancyGuard.sol";
import "../ProtocolRoles.sol";
import "../interfaces/IProtocolErrors.sol";

interface ITreasuryManagerGateway {
    function deposit(uint256 stableAmount, uint256 minSharesOut) external returns (uint256 sharesMinted);
    function redeem(uint256 sharesAmount, uint256 minUsdcOut) external returns (uint256 assetsReceived);
    function redemptionToken() external view returns (address);
}

/**
 * @title CompliantTreasuryGateway
 * @notice Stateless Compliance Wrapper for Institutional Investors (MiCA/AML Isolation Layer).
 * @dev Delegates 100% of execution to the core permissionless TreasuryManager without maintaining separate liquidity pools,
 *      eliminating price discrepancies, fragmentation, and MEV arbitrage opportunities.
 */
contract CompliantTreasuryGateway is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error KYCVerificationFailed(address user);
    error GatewayZeroAddress();

    ITreasuryManagerGateway public immutable treasuryManager;
    address public immutable alphaToken;
    address public immutable stablecoin;

    mapping(address => bool) public isKYCVerified;

    event InstitutionalKYCUpdated(address indexed account, bool status);
    event InstitutionalDepositForwarded(address indexed institution, uint256 usdcIn, uint256 sharesOut);
    event InstitutionalRedeemForwarded(address indexed institution, uint256 sharesIn, uint256 usdcOut);

    constructor(address _treasuryManager, address _alphaToken, address _admin) {
        if (_treasuryManager == address(0) || _alphaToken == address(0)) revert GatewayZeroAddress();
        treasuryManager = ITreasuryManagerGateway(_treasuryManager);
        alphaToken = _alphaToken;
        stablecoin = ITreasuryManagerGateway(_treasuryManager).redemptionToken();

        address admin = (_admin != address(0)) ? _admin : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.COMPLIANCE_ROLE, admin);
    }

    modifier onlyKYC(address account) {
        if (!isKYCVerified[account]) revert KYCVerificationFailed(account);
        _;
    }

    function setKYCStatus(address account, bool status) external onlyRole(ProtocolRoles.COMPLIANCE_ROLE) {
        if (account == address(0)) revert IProtocolErrors.ZeroAddress();
        isKYCVerified[account] = status;
        emit InstitutionalKYCUpdated(account, status);
    }

    function batchSetKYCStatus(address[] calldata accounts, bool status)
        external
        onlyRole(ProtocolRoles.COMPLIANCE_ROLE)
    {
        uint256 len = accounts.length;
        for (uint256 i = 0; i < len;) {
            if (accounts[i] != address(0)) {
                isKYCVerified[accounts[i]] = status;
                emit InstitutionalKYCUpdated(accounts[i], status);
            }
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Forwards institutional deposit directly to TreasuryManager.
     *         Stateless: Tokens pass through instantaneously from user to core vault, minting Alpha directly to the user.
     */
    function depositCompliant(uint256 stableAmount, uint256 minSharesOut)
        external
        nonReentrant
        onlyKYC(msg.sender)
        returns (uint256 sharesMinted)
    {
        if (stableAmount == 0) revert IProtocolErrors.ZeroAmount();

        // Pull stablecoin from institution
        IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), stableAmount);
        IERC20(stablecoin).approve(address(treasuryManager), stableAmount);

        // Execute core deposit
        sharesMinted = treasuryManager.deposit(stableAmount, minSharesOut);

        // Forward minted shares to the institution
        IERC20(alphaToken).safeTransfer(msg.sender, sharesMinted);

        emit InstitutionalDepositForwarded(msg.sender, stableAmount, sharesMinted);
    }

    /**
     * @notice Forwards institutional redemption directly to TreasuryManager.
     *         Stateless: Alpha tokens pass through to Core for burning, transferring USDC directly to the user.
     */
    function redeemCompliant(uint256 sharesAmount, uint256 minUsdcOut)
        external
        nonReentrant
        onlyKYC(msg.sender)
        returns (uint256 assetsReceived)
    {
        if (sharesAmount == 0) revert IProtocolErrors.ZeroAmount();

        // Pull Alpha tokens from institution
        IERC20(alphaToken).safeTransferFrom(msg.sender, address(this), sharesAmount);
        IERC20(alphaToken).approve(address(treasuryManager), sharesAmount);

        // Execute core redemption
        assetsReceived = treasuryManager.redeem(sharesAmount, minUsdcOut);

        // Forward redeemed stablecoins to institution
        IERC20(stablecoin).safeTransfer(msg.sender, assetsReceived);

        emit InstitutionalRedeemForwarded(msg.sender, sharesAmount, assetsReceived);
    }
}
