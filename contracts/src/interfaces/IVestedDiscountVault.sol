// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice Minimal interface the Treasury uses to interact with the vested discount vault.
 */
interface IVestedDiscountVault {
    /// @notice Settles matured bonds into the fixed-principal liability bucket.
    function accrue() external;

    /// @notice Present value of outstanding bonded debt, scaled to 18 decimals.
    function totalPresentLiability() external view returns (uint256);
}
