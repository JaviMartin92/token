// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./interfaces/IProtocolErrors.sol";

interface IGovernanceStakingYield {
    function notifyRewardAmount(uint256 amount) external;
}

/**
 * @title CommunityYieldVault
 * @author Viraje Protocol Architecture Team
 * @notice Decentralized Pure DeFi vault for capturing and distributing 50% protocol real yield fees.
 * @dev Receives liquid USDC from `RealYieldRouter.sol`, `TreasuryManager.sol`, and `VestedDiscountVault.sol`,
 *      routing it directly into `GovernanceStaking.sol` for continuous dividend streaming to stVIRAJE stakers.
 *      Complies strictly with EU MiCA Regulation Recital 22: 100% of real yield flows to the community without
 *      custodial intermediaries or administrative skimming.
 */
contract CommunityYieldVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Canonical settlement stablecoin used for real yield distributions (USDC).
    IERC20 public immutable stablecoin;

    /// @notice Governance Staking contract destination receiving yield rewards for continuous streaming.
    address public stakingPool;

    /// @notice Cumulative lifetime USDC yield deposited into the vault.
    uint256 public totalYieldReceived;

    /// @notice Cumulative lifetime USDC yield flushed and notified to GovernanceStaking.
    uint256 public totalYieldFlushed;

    // =========================================================================
    // 📢 YIELD & TELEMETRY EVENTS
    // =========================================================================
    event YieldDeposited(address indexed source, uint256 amount);
    event StakingPoolSet(address indexed stakingPool);
    event YieldFlushed(address indexed caller, uint256 amount);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Initializes the Community Yield Vault with settlement stablecoin and governance admin.
     * @param _stablecoin ERC-20 contract address of the settlement token (USDC).
     * @param _initialOwner Genesis governance administrator address (TimelockController in production).
     */
    constructor(address _stablecoin, address _initialOwner) {
        if (_stablecoin == address(0) || _initialOwner == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        stablecoin = IERC20(_stablecoin);

        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialOwner);
    }

    /**
     * @notice Configures or updates the target Governance Staking contract receiving rewards.
     * @param _stakingPool Address of the `GovernanceStaking.sol` contract.
     */
    function setStakingPool(address _stakingPool) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_stakingPool == address(0)) revert IProtocolErrors.ZeroAddress();
        stakingPool = _stakingPool;
        emit StakingPoolSet(_stakingPool);
    }

    /**
     * @notice Rescues accidentally transferred ERC-20 tokens (excluding the community yield stablecoin).
     * @dev Strictly prohibits sweeping the canonical stablecoin to guarantee non-custodial yield safety.
     * @param token Address of the token to sweep.
     * @param to Destination address receiving the swept tokens.
     */
    function sweepTokens(address token, address to) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        if (token == address(stablecoin)) revert IProtocolErrors.InvalidParameters();

        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) revert IProtocolErrors.InvalidAmount();

        IERC20(token).safeTransfer(to, bal);
        emit TokensSwept(token, to, bal);
    }

    /**
     * @notice Receives liquid USDC yield and triggers immediate dividend streaming notification.
     * @dev If notification fails (e.g. eligibleStaked == 0 before initial stakers arrive), the allowance is reset
     *      and funds remain safely held in escrow until flushed via `flushPendingYield()`.
     * @param amount Exact amount of USDC to deposit and route.
     */
    function depositYield(uint256 amount) external nonReentrant {
        if (amount == 0) revert IProtocolErrors.ZeroAmount();
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);

        totalYieldReceived += amount;

        if (stakingPool != address(0)) {
            stablecoin.safeApprove(stakingPool, 0);
            stablecoin.safeApprove(stakingPool, amount);
            try IGovernanceStakingYield(stakingPool).notifyRewardAmount(amount) {
                totalYieldFlushed += amount;
            } catch {
                // Reset dangling allowance to eliminate non-zero residual approval
                stablecoin.safeApprove(stakingPool, 0);
            }
        }

        emit YieldDeposited(msg.sender, amount);
    }

    /**
     * @notice Flushes any pending or unnotified USDC yield balance directly into the staking pool.
     * @dev Permissionless public function to ensure zero yield is ever stranded in escrow.
     */
    function flushPendingYield() external nonReentrant {
        if (stakingPool == address(0)) revert IProtocolErrors.ZeroAddress();
        uint256 bal = stablecoin.balanceOf(address(this));
        if (bal == 0) revert IProtocolErrors.ZeroAmount();

        stablecoin.safeApprove(stakingPool, 0);
        stablecoin.safeApprove(stakingPool, bal);
        IGovernanceStakingYield(stakingPool).notifyRewardAmount(bal);

        totalYieldFlushed += bal;

        emit YieldFlushed(msg.sender, bal);
    }

    /**
     * @notice Returns the idle USDC balance currently escrowed in the vault.
     * @return Current escrow balance in USDC units.
     */
    function getBalance() external view returns (uint256) {
        return stablecoin.balanceOf(address(this));
    }
}
