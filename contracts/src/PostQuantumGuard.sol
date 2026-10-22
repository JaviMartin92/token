// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IPostQuantumGuard.sol";
import "./ProtocolAddressProvider.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PostQuantumGuard
 * @notice Módulo de Seguridad Híbrida Post-Cuántica (PQC) para el Protocolo Alpha Centauri.
 * @dev Implementa verificación on-chain de firmas basadas en hash Winternitz OTS+ (w=4, 67 cadenas de hash),
 *      completamente resistente a algoritmos cuánticos de factorización y logaritmo discreto (Shor).
 *      Totalmente compatible con EVM nativa utilizando operaciones Keccak-256 (Grover-resistant a 128-bit security).
 */
contract PostQuantumGuard is IPostQuantumGuard, AccessControl {
    bytes32 public constant QUANTUM_OPERATOR_ROLE = keccak256("QUANTUM_OPERATOR_ROLE");
    bytes32 public constant QUANTUM_AUDITOR_ROLE = keccak256("QUANTUM_AUDITOR_ROLE");

    ProtocolAddressProvider public immutable addressProvider;

    // Número de cadenas de hash para Winternitz w=4 (64 nibbles de mensaje + 3 nibbles de checksum)
    uint256 public constant CHAINS_COUNT = 67;
    uint256 public constant MAX_NIBBLE_VALUE = 15;
    uint256 public constant MAX_CHECKSUM_SUM = 64 * 15; // 960

    // Registro de compromisos de clave pública cuántica (Quantum Public Key Root)
    mapping(address => bytes32) private _activeCommitments;
    mapping(bytes32 => bool) public usedCommitments;

    // Acciones de alto impacto que han sido certificadas con firma cuántica
    mapping(bytes32 => bool) public quantumAuthorizedActions;

    error InvalidQuantumSignature();
    error QuantumCommitmentAlreadyUsed();
    error NoActiveQuantumCommitment();
    error ZeroCommitmentRoot();
    error ZeroActionId();

    constructor(address initialAdmin, address _addressProvider) {
        if (initialAdmin == address(0) || _addressProvider == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(QUANTUM_OPERATOR_ROLE, initialAdmin);
        addressProvider = ProtocolAddressProvider(_addressProvider);
    }

    /**
     * @notice Registra el compromiso inicial de clave pública post-cuántica (hash raíz de las 67 cadenas).
     * @param commitmentRoot El hash Keccak-256 de los 67 extremos públicos de la clave.
     */
    function registerQuantumCommitment(bytes32 commitmentRoot) external override {
        if (commitmentRoot == bytes32(0)) revert ZeroCommitmentRoot();
        if (usedCommitments[commitmentRoot]) revert QuantumCommitmentAlreadyUsed();

        _activeCommitments[msg.sender] = commitmentRoot;
        emit QuantumCommitmentRegistered(msg.sender, commitmentRoot, block.timestamp);
    }

    /**
     * @notice Verifica matemáticamente si una firma W-OTS+ (w=4) corresponde a un mensaje y compromiso dado.
     * @param messageHash El digest de 32 bytes del mensaje firmado.
     * @param signature Las 67 preimágenes intermedias correspondientes a cada nibble y checksum.
     * @param expectedCommitment El hash raíz esperado de los extremos públicos.
     * @return isValid Verdadero si la reconstrucción de extremos coincide exactamente con el compromiso.
     */
    function verifyWinternitzSignature(
        bytes32 messageHash,
        bytes32[67] calldata signature,
        bytes32 expectedCommitment
    ) public pure override returns (bool isValid) {
        if (expectedCommitment == bytes32(0)) return false;

        bytes32[67] memory reconstructedPubKeys;
        uint256 sumNibbles = 0;

        // 1. Descomponer los 32 bytes de mensaje en 64 nibbles (4 bits cada uno, valores 0..15)
        for (uint256 i = 0; i < 32;) {
            uint8 byteVal = uint8(messageHash[i]);
            uint8 n0 = byteVal >> 4;
            uint8 n1 = byteVal & 0x0F;

            sumNibbles += (n0 + n1);

            // Hashear hacia adelante (15 - nibble) veces para alcanzar el extremo de la clave pública
            reconstructedPubKeys[i * 2] = _hashForward(signature[i * 2], 15 - n0);
            reconstructedPubKeys[i * 2 + 1] = _hashForward(signature[i * 2 + 1], 15 - n1);

            unchecked {
                ++i;
            }
        }

        // 2. Calcular checksum para evitar falsificaciones incrementales (960 - sumNibbles)
        uint256 checksum = MAX_CHECKSUM_SUM - sumNibbles;
        uint8 c0 = uint8((checksum >> 8) & 0x0F);
        uint8 c1 = uint8((checksum >> 4) & 0x0F);
        uint8 c2 = uint8(checksum & 0x0F);

        // 3. Procesar las 3 cadenas de checksum hacia adelante
        reconstructedPubKeys[64] = _hashForward(signature[64], 15 - c0);
        reconstructedPubKeys[65] = _hashForward(signature[65], 15 - c1);
        reconstructedPubKeys[66] = _hashForward(signature[66], 15 - c2);

        // 4. Comparar el hash del vector completo de claves públicas reconstruidas con el compromiso raíz
        bytes32 calculatedCommitment = keccak256(abi.encode(reconstructedPubKeys));
        return calculatedCommitment == expectedCommitment;
    }

    /**
     * @notice Autoriza una acción crítica mediante firma post-cuántica y avanza la cadena de claves (PFS).
     * @param actionId Identificador único de la operación o propuesta gobernada.
     * @param messageHash Digest del payload de la acción.
     * @param pqcSignature Firma Winternitz de 67 elementos.
     * @param nextCommitment Siguiente clave pública cuántica (Forward Security). Opcional (puede ser bytes32(0)).
     */
    function authorizeGuardedAction(
        bytes32 actionId,
        bytes32 messageHash,
        bytes32[67] calldata pqcSignature,
        bytes32 nextCommitment
    ) external override returns (bool authorized) {
        if (actionId == bytes32(0)) revert ZeroActionId();

        bytes32 currentCommitment = _activeCommitments[msg.sender];
        if (currentCommitment == bytes32(0)) revert NoActiveQuantumCommitment();
        if (usedCommitments[currentCommitment]) revert QuantumCommitmentAlreadyUsed();

        // Verificar la firma W-OTS+
        if (!verifyWinternitzSignature(messageHash, pqcSignature, currentCommitment)) {
            revert InvalidQuantumSignature();
        }

        // Consumir el compromiso actual para impedir ataques de reutilización OTS
        usedCommitments[currentCommitment] = true;
        quantumAuthorizedActions[actionId] = true;

        // Actualizar al siguiente compromiso si se provee (Seguridad Hacia Adelante)
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
     * @notice Consulta si una acción dispone de certificación post-cuántica activa.
     */
    function isActionQuantumAuthorized(bytes32 actionId) external view override returns (bool) {
        return quantumAuthorizedActions[actionId];
    }

    /**
     * @notice Retorna el compromiso cuántico activo para una cuenta.
     */
    function getActiveCommitment(address account) external view override returns (bytes32) {
        return _activeCommitments[account];
    }

    /**
     * @dev Función interna para aplicar n iteraciones sucesivas de Keccak-256.
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
