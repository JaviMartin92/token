// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAtomicSwapReceiver {
    event AtomicSwapExecuted(
        address indexed user,
        uint256 usdtDeposited,
        uint256 usdcReceived,
        uint256 feePaid
    );

    /**
     * @notice Receives USDT from a user and atomically swaps it internally to USDC.
     * @dev Slippage check is enforced by minUsdcExpected. Swap must execute in the same transaction block.
     * @param usdtAmount The amount of USDT being deposited.
     * @param minUsdcExpected The minimum USDC expected back (max 0.05% slippage).
     * @return usdcDeposited The net amount of USDC deposited into the treasury.
     */
    function depositUSDT(uint256 usdtAmount, uint256 minUsdcExpected) external returns (uint256 usdcDeposited);
}
