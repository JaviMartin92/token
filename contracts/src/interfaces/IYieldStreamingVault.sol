// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IYieldStreamingVault {
    struct ClaimRequest {
        address user;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }

    event YieldClaimed(address indexed user, uint256 amount, bool gasless);

    /**
     * @notice Direct on-chain method to claim accumulated yields in stablecoins.
     * @param amount The yield amount to claim.
     */
    function claimYield(uint256 amount) external;

    /**
     * @notice Gasless off-chain method to claim yields via digital signatures (EIP-712).
     * @param request The detailed claim parameters.
     * @param signature The EIP-712 signature proving user authentication.
     */
    function claimYieldGasless(
        ClaimRequest calldata request,
        bytes calldata signature
    ) external;

    /**
     * @notice View the pending yield ready to be claimed by a user.
     */
    function getPendingYield(address user) external view returns (uint256);
}
