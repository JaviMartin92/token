// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IPostQuantumGuard.sol";
import "./ProtocolAddressProvider.sol";
import "./ProtocolRoles.sol";
import "./interfaces/IProtocolErrors.sol";
import "./lib/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PostQuantumGuard
 * @author Viraje Protocol Architecture Team
 * @notice Módulo de seguridad criptográfica post-cuántica (PQC) híbrida de Viraje Protocol.
 * @dev Implementa verificación on-chain de firmas Winternitz One-Time Signatures (W-OTS+, w=4, 67 cadenas de hash),
 *      completamente inmunes a algoritmos cuánticos de factorización y logaritmo discreto (Shor).
 *      Totalmente ejecutable en la EVM mediante operaciones Keccak-256 (resistencia Grover al nivel de 128 bits de seguridad).
 *      Garantiza Secreto Hacia Adelante (Perfect Forward Secrecy - PFS) mediante el encadenamiento de cada clave
 *      comprometida de un solo uso con la raíz sucesiva en un esquema de trinquete criptográfico.
 */
contract PostQuantumGuard is IPostQuantumGuard, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant QUANTUM_OPERATOR_ROLE = ProtocolRoles.QUANTUM_OPERATOR_ROLE;
    bytes32 public constant QUANTUM_AUDITOR_ROLE = ProtocolRoles.QUANTUM_AUDITOR_ROLE;

    ProtocolAddressProvider public immutable addressProvider;

    // Número de cadenas de hash para Winternitz w=4 (64 nibbles de mensaje + 3 nibbles de checksum)
    uint256 public constant CHAINS_COUNT = 67;
    uint256 public constant MAX_NIBBLE_VALUE = 15;
    uint256 public constant MAX_CHECKSUM_SUM = 64 * 15; // 960

    // Registro de raíces de clave pública cuántica activas (compromiso de Merkle / trinquete)
    mapping(address => bytes32) private _activeCommitments;
    mapping(bytes32 => bool) public usedCommitments;
    mapping(bytes32 => uint256) public commitmentNonce;

    // Acciones de alto impacto certificadas con firmas cuánticas válidas
    mapping(bytes32 => bool) public quantumAuthorizedActions;

    // --- Errores Personalizados de Dominio (EIP-838) ---
    error InvalidQuantumSignature();
    error QuantumCommitmentAlreadyUsed();
    error NoActiveQuantumCommitment();
    error ZeroCommitmentRoot();
    error ZeroActionId();
    error ActionAlreadyAuthorized();

    event QuantumActionConsumed(bytes32 indexed actionId, address indexed consumer);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Inicializa el centinela cuántico con el registro fiduciario del protocolo.
     * @param initialAdmin Dirección del administrador de gobernanza inicial.
     * @param _addressProvider Dirección del registro ProtocolAddressProvider.
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
     * @notice Registra el compromiso inicial de clave pública post-cuántica (raíz hash de las 67 extremidades).
     * @param commitmentRoot Hash Keccak-256 de los 67 puntos finales de la clave pública.
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
     * @notice Verifica matemáticamente si una firma W-OTS+ (w=4) corresponde a un mensaje y compromiso dados.
     * @param messageHash Digest de 32 bytes del payload firmado.
     * @param signature 67 preimágenes intermedias correspondientes a cada nibble y checksum.
     * @param expectedCommitment Raíz hash esperada de los extremos de la clave pública.
     * @return isValid True si los extremos reconstruidos coinciden con el compromiso esperado.
     */
    function verifyWinternitzSignature(
        bytes32 messageHash,
        bytes32[67] calldata signature,
        bytes32 expectedCommitment
    ) public pure override returns (bool isValid) {
        if (expectedCommitment == bytes32(0) || messageHash == bytes32(0)) return false;

        bytes32[67] memory reconstructedPubKeys;
        uint256 sumNibbles = 0;

        // 1. Descomposición de los 32 bytes del mensaje en 64 nibbles (4 bits cada uno, valores 0..15)
        for (uint256 i = 0; i < 32;) {
            uint8 byteVal = uint8(messageHash[i]);
            uint8 n0 = byteVal >> 4;
            uint8 n1 = byteVal & 0x0F;

            sumNibbles += (n0 + n1);

            // Hashea hacia adelante (15 - nibble) veces hasta alcanzar el extremo de la cadena
            reconstructedPubKeys[i * 2] = _hashForward(signature[i * 2], 15 - n0);
            reconstructedPubKeys[i * 2 + 1] = _hashForward(signature[i * 2 + 1], 15 - n1);

            unchecked {
                ++i;
            }
        }

        // 2. Cálculo del checksum para prevenir ataques de falsificación incremental (960 - sumNibbles)
        uint256 checksum = MAX_CHECKSUM_SUM - sumNibbles;
        uint8 c0 = uint8((checksum >> 8) & 0x0F);
        uint8 c1 = uint8((checksum >> 4) & 0x0F);
        uint8 c2 = uint8(checksum & 0x0F);

        // 3. Procesa las 3 cadenas del checksum hacia adelante
        reconstructedPubKeys[64] = _hashForward(signature[64], 15 - c0);
        reconstructedPubKeys[65] = _hashForward(signature[65], 15 - c1);
        reconstructedPubKeys[66] = _hashForward(signature[66], 15 - c2);

        // 4. Compara el hash del vector completo de claves públicas reconstruidas con la raíz esperada
        bytes32 calculatedCommitment = keccak256(abi.encode(reconstructedPubKeys));
        return calculatedCommitment == expectedCommitment;
    }

    /**
     * @notice Autoriza una acción crítica mediante firma post-cuántica y avanza el trinquete (PFS).
     * @param actionId Identificador único de la propuesta u operación gobernada.
     * @param messageHash Digest del payload de la acción.
     * @param pqcSignature Firma Winternitz de 67 elementos.
     * @param nextCommitment Raíz cuántica sucesiva (Forward Security). Opcional (bytes32(0) si finaliza).
     * @return authorized Confirmación de éxito.
     */
    function authorizeGuardedAction(
        bytes32 actionId,
        bytes32 messageHash,
        bytes32[67] calldata pqcSignature,
        bytes32 nextCommitment
    ) external override nonReentrant returns (bool authorized) {
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

        // Verificación de la firma W-OTS+
        if (!verifyWinternitzSignature(messageHash, pqcSignature, currentCommitment)) {
            revert InvalidQuantumSignature();
        }

        // Consume el compromiso actual para erradicar ataques de reutilización OTS
        usedCommitments[currentCommitment] = true;
        quantumAuthorizedActions[actionId] = true;

        // Avanza al siguiente compromiso si se provee (Perfect Forward Secrecy)
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
     * @notice Autoriza una acción con firma Winternitz OTS+ con separación estricta de dominios (EIP-712 Style).
     * @param commitmentRoot Raíz pública esperada del firmante.
     * @param actionId Identificador único de la acción.
     * @param signature Firma W-OTS+ de 67 elementos.
     */
    function authorizeActionWithQuantumSignature(
        bytes32 commitmentRoot,
        bytes32 actionId,
        bytes32[67] calldata signature
    ) external override nonReentrant {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !hasRole(QUANTUM_OPERATOR_ROLE, msg.sender)) {
            revert IProtocolErrors.Unauthorized();
        }
        if (actionId == bytes32(0)) revert ZeroActionId();
        if (quantumAuthorizedActions[actionId]) revert ActionAlreadyAuthorized();
        if (_activeCommitments[msg.sender] == bytes32(0) || _activeCommitments[msg.sender] != commitmentRoot) {
            revert InvalidQuantumSignature();
        }
        if (usedCommitments[commitmentRoot]) revert QuantumCommitmentAlreadyUsed();

        uint256 nonce = commitmentNonce[commitmentRoot];
        commitmentNonce[commitmentRoot] = nonce + 1;

        // Separación estricta de dominios
        bytes32 digest = keccak256(abi.encode(block.chainid, address(this), msg.sender, nonce, actionId));

        if (!verifyWinternitzSignature(digest, signature, commitmentRoot)) {
            revert InvalidQuantumSignature();
        }

        // Invalida el compromiso de clave de un solo uso
        usedCommitments[commitmentRoot] = true;
        quantumAuthorizedActions[actionId] = true;
        delete _activeCommitments[msg.sender];

        emit QuantumSignatureVerified(msg.sender, actionId, commitmentRoot);
        emit QuantumActionAuthorized(actionId, msg.sender);
    }

    /**
     * @notice Consume una acción autorizada cuánticamente durante su ejecución para prevenir replay.
     * @param actionId Identificador de la acción a consumir.
     */
    function consumeQuantumAuthorizedAction(bytes32 actionId) external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !hasRole(QUANTUM_OPERATOR_ROLE, msg.sender)) {
            revert IProtocolErrors.Unauthorized();
        }
        if (!quantumAuthorizedActions[actionId]) revert IProtocolErrors.Unauthorized();
        quantumAuthorizedActions[actionId] = false;
        emit QuantumActionConsumed(actionId, msg.sender);
    }

    /**
     * @notice Consulta si una acción dispone de autorización cuántica activa.
     * @param actionId Identificador único de la acción.
     */
    function isActionQuantumAuthorized(bytes32 actionId) external view override returns (bool) {
        return quantumAuthorizedActions[actionId];
    }

    /**
     * @notice Devuelve la raíz de compromiso cuántico activa para una cuenta.
     * @param account Dirección del firmante consultado.
     */
    function getActiveCommitment(address account) external view override returns (bytes32) {
        return _activeCommitments[account];
    }

    /**
     * @notice Rescata tokens ERC-20 transferidos accidentalmente al contrato.
     * @param token Dirección del activo.
     * @param to Destinatario del rescate.
     * @param amount Cantidad a transferir.
     */
    function sweepTokens(address token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit TokensSwept(token, to, amount);
    }

    /**
     * @dev Función interna: computa n iteraciones sucesivas de Keccak-256 sobre la semilla.
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
