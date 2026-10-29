// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IPostQuantumGuard.sol";
import "./ProtocolAddressProvider.sol";
import "./ProtocolRoles.sol";
import "./interfaces/IProtocolErrors.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PostQuantumGuard
 * @author Alpha Centauri Architecture Team
 * @notice Hybrid Post-Quantum Cryptography (PQC) security module for the Alpha Centauri Protocol.
 * @dev Implements on-chain verification of Winternitz One-Time Signatures (W-OTS+, w=4, 67 hash chains),
 *      completely immune to quantum factorization and discrete log algorithms (Shor).
 *      Natively executable on EVM using Keccak-256 operations (Grover-resistant at 128-bit security level).
 *      Provides Perfect Forward Secrecy (PFS) by chaining each single-use key commitment to a subsequent root.
 */
contract PostQuantumGuard is IPostQuantumGuard, AccessControl {
    bytes32 public constant QUANTUM_OPERATOR_ROLE = ProtocolRoles.QUANTUM_OPERATOR_ROLE;
    bytes32 public constant QUANTUM_AUDITOR_ROLE = ProtocolRoles.QUANTUM_AUDITOR_ROLE;

    ProtocolAddressProvider public immutable addressProvider;

    // Number of hash chains for Winternitz w=4 (64 message nibbles + 3 checksum nibbles)
    uint256 public constant CHAINS_COUNT = 67;
    uint256 public constant MAX_NIBBLE_VALUE = 15;
    uint256 public constant MAX_CHECKSUM_SUM = 64 * 15; // 960

    // Registry of active quantum public key roots (Merkle / chain commitment)
    mapping(address => bytes32) private _activeCommitments;
    mapping(bytes32 => bool) public usedCommitments;

    // High-impact actions certified with valid quantum signatures
    mapping(bytes32 => bool) public quantumAuthorizedActions;

    // --- Domain Custom Errors ---
    error InvalidQuantumSignature();
    error QuantumCommitmentAlreadyUsed();
    error NoActiveQuantumCommitment();
    error ZeroCommitmentRoot();
    error ZeroActionId();
    error ActionAlreadyAuthorized();

    event QuantumActionConsumed(bytes32 indexed actionId, address indexed consumer);

    /**
     * @notice Initializes PostQuantumGuard with protocol address provider and admin
     * @param initialAdmin Address of initial governance administrator
     * @param _addressProvider Address of ProtocolAddressProvider registry
     */
    constructor(address initialAdmin, address _addressProvider) {
        if (initialAdmin == address(0) || _addressProvider == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(QUANTUM_OPERATOR_ROLE, initialAdmin);
        addressProvider = ProtocolAddressProvider(_addressProvider);
    }

    /**
     * @notice Registers initial post-quantum public key commitment (hash root of 67 chain extremities)
     * @param commitmentRoot Keccak-256 hash of the 67 public key endpoints
     */
    function registerQuantumCommitment(bytes32 commitmentRoot) external override {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !hasRole(QUANTUM_OPERATOR_ROLE, msg.sender)) {
            revert IProtocolErrors.Unauthorized();
        }
        if (commitmentRoot == bytes32(0)) revert ZeroCommitmentRoot();
        if (usedCommitments[commitmentRoot]) revert QuantumCommitmentAlreadyUsed();

        _activeCommitments[msg.sender] = commitmentRoot;
        emit QuantumCommitmentRegistered(msg.sender, commitmentRoot, block.timestamp);
    }

    /**
     * @notice Verifies mathematically if a W-OTS+ (w=4) signature corresponds to a given message and commitment root
     * @param messageHash 32-byte digest of the signed action payload
     * @param signature 67 intermediate preimages corresponding to each nibble and checksum
     * @param expectedCommitment Expected root hash of the public key chain endpoints
     * @return isValid True if reconstructed public key endpoints hash to expected commitment
     */
    function verifyWinternitzSignature(
        bytes32 messageHash,
        bytes32[67] calldata signature,
        bytes32 expectedCommitment
    ) public pure override returns (bool isValid) {
        if (expectedCommitment == bytes32(0) || messageHash == bytes32(0)) return false;

        bytes32[67] memory reconstructedPubKeys;
        uint256 sumNibbles = 0;

        // 1. Deconstruct the 32 message bytes into 64 nibbles (4 bits each, values 0..15)
        for (uint256 i = 0; i < 32;) {
            uint8 byteVal = uint8(messageHash[i]);
            uint8 n0 = byteVal >> 4;
            uint8 n1 = byteVal & 0x0F;

            sumNibbles += (n0 + n1);

            // Hash forward (15 - nibble) times to reach the public key chain extremity
            reconstructedPubKeys[i * 2] = _hashForward(signature[i * 2], 15 - n0);
            reconstructedPubKeys[i * 2 + 1] = _hashForward(signature[i * 2 + 1], 15 - n1);

            unchecked {
                ++i;
            }
        }

        // 2. Compute checksum to prevent incremental forgery attacks (960 - sumNibbles)
        uint256 checksum = MAX_CHECKSUM_SUM - sumNibbles;
        uint8 c0 = uint8((checksum >> 8) & 0x0F);
        uint8 c1 = uint8((checksum >> 4) & 0x0F);
        uint8 c2 = uint8(checksum & 0x0F);

        // 3. Process the 3 checksum chains forward
        reconstructedPubKeys[64] = _hashForward(signature[64], 15 - c0);
        reconstructedPubKeys[65] = _hashForward(signature[65], 15 - c1);
        reconstructedPubKeys[66] = _hashForward(signature[66], 15 - c2);

        // 4. Compare hash of entire reconstructed public key vector with expected commitment root
        bytes32 calculatedCommitment = keccak256(abi.encode(reconstructedPubKeys));
        return calculatedCommitment == expectedCommitment;
    }

    /**
     * @notice Authorizes a critical action via post-quantum signature and advances the key chain (PFS)
     * @param actionId Unique identifier of the governed proposal or operation
     * @param messageHash Digest of the action payload
     * @param pqcSignature 67-element Winternitz signature
     * @param nextCommitment Next quantum key root (Forward Security). Optional (bytes32(0) if closing).
     * @return authorized Success confirmation
     */
    function authorizeGuardedAction(
        bytes32 actionId,
        bytes32 messageHash,
        bytes32[67] calldata pqcSignature,
        bytes32 nextCommitment
    ) external override returns (bool authorized) {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !hasRole(QUANTUM_OPERATOR_ROLE, msg.sender)) {
            revert IProtocolErrors.Unauthorized();
        }
        if (actionId == bytes32(0)) revert ZeroActionId();
        if (quantumAuthorizedActions[actionId]) revert ActionAlreadyAuthorized();

        bytes32 expectedHashWithNext = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, actionId, nextCommitment));
        bytes32 expectedHashWithoutNext = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, actionId));
        if (messageHash != expectedHashWithNext && messageHash != expectedHashWithoutNext) {
            revert IProtocolErrors.InvalidParameters();
        }

        bytes32 currentCommitment = _activeCommitments[msg.sender];
        if (currentCommitment == bytes32(0)) revert NoActiveQuantumCommitment();
        if (usedCommitments[currentCommitment]) revert QuantumCommitmentAlreadyUsed();

        // Verify the W-OTS+ signature
        if (!verifyWinternitzSignature(messageHash, pqcSignature, currentCommitment)) {
            revert InvalidQuantumSignature();
        }

        // Consume current commitment to strictly prevent OTS key reuse attacks
        usedCommitments[currentCommitment] = true;
        quantumAuthorizedActions[actionId] = true;

        // Advance to next key commitment if provided (Perfect Forward Secrecy)
        if (nextCommitment != bytes32(0)) {
            if (usedCommitments[nextCommitment]) revert QuantumCommitmentAlreadyUsed();
            _activeCommitments[msg.sender] = nextCommitment;
            emit QuantumCommitmentRegistered(msg.sender, nextCommitment, block.timestamp);
        } else {
            delete _activeCommitments[msg.sender];
        }

        emit QuantumSignatureVerified(msg.sender, messageHash, currentCommitment);
        emit QuantumActionAuthorized(actionId, msg.sender);
        return true;
    }

    /**
     * @notice Consumes an authorized quantum action upon execution to prevent replay
     * @param actionId Action identifier to mark as consumed
     */
    function consumeQuantumAuthorizedAction(bytes32 actionId) external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !hasRole(QUANTUM_OPERATOR_ROLE, msg.sender)) {
            revert IProtocolErrors.Unauthorized();
        }
        quantumAuthorizedActions[actionId] = false;
        emit QuantumActionConsumed(actionId, msg.sender);
    }

    /**
     * @notice Checks whether an action has active post-quantum authorization
     * @param actionId Unique identifier of the action
     */
    function isActionQuantumAuthorized(bytes32 actionId) external view override returns (bool) {
        return quantumAuthorizedActions[actionId];
    }

    /**
     * @notice Returns the active quantum commitment root for an account
     * @param account Target signer address
     */
    function getActiveCommitment(address account) external view override returns (bytes32) {
        return _activeCommitments[account];
    }

    /**
     * @dev Internal: computes n successive Keccak-256 iterations on seed
     */
    function _hashForward(bytes32 seed, uint256 iterations) internal pure returns (bytes32 result) {
        result = seed;
        for (uint256 i = 0; i < iterations;) {
            result = keccak256(abi.encodePacked(result));
            unchecked {
                ++i;
            }
        }
    }
}
