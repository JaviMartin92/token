// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPostQuantumGuard
 * @notice Interfaz para el módulo de seguridad post-cuántica híbrida (PQC) en Alpha Centauri.
 *         Implementa validación on-chain basada en cadenas de hash Winternitz OTS+ (W-OTS+ w=4).
 */
interface IPostQuantumGuard {
    event QuantumCommitmentRegistered(address indexed account, bytes32 indexed commitmentRoot, uint256 timestamp);
    event QuantumSignatureVerified(address indexed account, bytes32 indexed messageHash, bytes32 indexed commitmentRoot);
    event QuantumActionAuthorized(bytes32 indexed actionId, address indexed authorizedBy);

    function registerQuantumCommitment(bytes32 commitmentRoot) external;

    function verifyWinternitzSignature(
        bytes32 messageHash,
        bytes32[67] calldata signature,
        bytes32 expectedCommitment
    ) external pure returns (bool isValid);

    function authorizeGuardedAction(
        bytes32 actionId,
        bytes32 messageHash,
        bytes32[67] calldata pqcSignature,
        bytes32 nextCommitment
    ) external returns (bool authorized);

    function authorizeActionWithQuantumSignature(
        bytes32 commitmentRoot,
        bytes32 actionId,
        bytes32[67] calldata signature
    ) external;

    function isActionQuantumAuthorized(bytes32 actionId) external view returns (bool);
    function getActiveCommitment(address account) external view returns (bytes32);
}
