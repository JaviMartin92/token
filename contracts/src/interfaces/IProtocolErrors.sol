// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IProtocolErrors
 * @notice Standardized custom errors for the Alpha Centauri Protocol (EIP-838)
 * @dev Replaces string-based reverts to optimize deployment and execution gas costs.
 */
interface IProtocolErrors {
    // General Errors
    error ZeroAddress();
    error ZeroAddressProvider();
    error ZeroAmount();
    error InvalidAmount();
    error Unauthorized();
    error TransferFailed();
    error ApproveFailed();
    error InvalidParameters();
    error ProtocolPaused();
    error TimelockActive(uint256 availableAt);
    error AlreadyInitialized();

    // Financial & Solvency Invariants
    error Undercollateralized(uint256 currentRatioBps, uint256 minRatioBps);
    error SlippageExceeded(uint256 expectedMin, uint256 actual);
    error InvariantNAVDecreased(uint256 preNav, uint256 postNav);
    error InvariantSolvencyDecreased(uint256 preRatio, uint256 postRatio);
    error TVLCapExceeded(uint256 attempted, uint256 cap);
    error InvalidWeightsSum(uint256 sum);
    error DailyBudgetExceeded(uint256 spent, uint256 cap);
    error TradeSizeTooLarge(uint256 amount, uint256 maxSingleTrade);
    error CooldownActive(uint256 nextExecutionTimestamp);
    error CircuitBreakerActive(address asset);

    // Oracle & Price Feed Errors
    error PriceFeedNotSet();
    error InvalidPrice();
    error StalePriceFeed(uint256 updatedAt, uint256 stalenessLimit);
    error NoDiscountVsNAV();
    error DiscountTooLow(uint256 discountBps, uint256 minDiscountBps);

    // Lending & Staking Errors
    error LoanNotFound(uint256 loanId);
    error LoanNotActive(uint256 loanId);
    error LoanExpired(uint256 loanId);
    error InsufficientStakedBalance(uint256 requested, uint256 available);
    error NoActiveStakers();
    error BlockNotMined(uint256 requestedBlock, uint256 currentBlock);
    error ZeroTotalSupply();
    error InvalidLockYears();
    error SequencerGracePeriodActive();
    error SequencerDown();
}
