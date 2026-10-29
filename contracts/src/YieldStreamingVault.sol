// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IYieldStreamingVault.sol";
import "./interfaces/IProtocolErrors.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";

/**
 * @title YieldStreamingVault
 * @author Alpha Centauri Architecture Team
 * @notice Distribuye rendimientos reales acumulados con soporte para reclamos sin gas mediante firmas EIP-712.
 * @dev Los rendimientos no reclamados se componen continuamente en el tiempo según la tasa `compoundingApyBps`.
 *      Protege a los usuarios garantizando que ningún saldo de rendimiento sea deducido si la bóveda no dispone
 *      de liquidez suficiente para liquidar el 100% del pago.
 */
contract YieldStreamingVault is IYieldStreamingVault, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================================================================
    // ⚠️ ERRORES PERSONALIZADOS (EIP-838)
    // =========================================================================
    error SignatureExpired();
    error InvalidNonce();
    error InvalidSignature();
    error InsufficientYieldBalance(uint256 requested, uint256 available);

    // =========================================================================
    // 🔏 CONSTANTES EIP-712 Y DOMINIO
    // =========================================================================
    /* solhint-disable gas-small-strings */
    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("ClaimRequest(address user,uint256 amount,uint256 nonce,uint256 deadline)");

    bytes32 private immutable _cachedDomainSeparator;
    uint256 private immutable _cachedChainId;
    bytes32 private immutable _hashedName;
    bytes32 private immutable _hashedVersion;

    /// @notice Token estable colateral utilizado para los pagos de rendimiento (ej. USDC).
    address public immutable yieldToken;

    // =========================================================================
    // 📦 ESTADO Y REGISTROS CONTABLES
    // =========================================================================
    mapping(address => uint256) public nonces;
    mapping(address => uint256) public pendingYields;
    mapping(address => uint256) public lastYieldUpdateTimestamp;

    /// @notice Tasa anual de auto-composición de rendimientos (por defecto 6.45% = 645 BPS).
    uint256 public compoundingApyBps = 645;

    event CompoundingApyUpdated(uint256 newApyBps);

    /**
     * @notice Constructor que inicializa el token de rendimiento, administrador génesis y separador de dominio EIP-712.
     * @param _yieldToken Dirección del token ERC-20 utilizado para los pagos.
     * @param _initialOwner Dirección administradora génesis (TimelockController en mainnet).
     */
    constructor(address _yieldToken, address _initialOwner) {
        if (_yieldToken == address(0)) revert IProtocolErrors.ZeroAddress();
        if (_initialOwner == address(0)) revert IProtocolErrors.ZeroAddress();

        yieldToken = _yieldToken;

        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialOwner);

        _hashedName = keccak256("YieldStreamingVault");
        _hashedVersion = keccak256("1");
        _cachedChainId = block.chainid;
        _cachedDomainSeparator = _buildDomainSeparator();
    }
    /* solhint-enable gas-small-strings */

    /**
     * @notice Construye el separador de dominio EIP-712 para prevenir ataques de repetición entre cadenas.
     */
    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                _hashedName,
                _hashedVersion,
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice Obtiene el separador de dominio activo, recalculándolo si ocurre un hard fork.
     */
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return block.chainid == _cachedChainId ? _cachedDomainSeparator : _buildDomainSeparator();
    }

    /**
     * @notice Actualiza la tasa de interés compuesto anual con límites estrictos de seguridad.
     * @param newApyBps Nueva tasa en puntos básicos (Máximo 50.00% = 5000 BPS).
     */
    function setCompoundingApyBps(uint256 newApyBps) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (newApyBps > 5000) revert IProtocolErrors.InvalidParameters();
        compoundingApyBps = newApyBps;
        emit CompoundingApyUpdated(newApyBps);
    }

    /**
     * @dev Calcula el rendimiento total acumulado con interés compuesto continuo en el tiempo.
     */
    function _calculateCompoundedYield(address user) internal view returns (uint256) {
        uint256 base = pendingYields[user];
        if (base == 0) return 0;
        uint256 lastTs = lastYieldUpdateTimestamp[user];
        if (lastTs == 0 || block.timestamp <= lastTs) return base;

        uint256 elapsedSeconds = block.timestamp - lastTs;
        uint256 extraYield = (base * compoundingApyBps * elapsedSeconds) / (10000 * 365 days);
        return base + extraYield;
    }

    /**
     * @notice Asigna rendimientos devengados a un usuario específico.
     * @param user Dirección del usuario beneficiario.
     * @param amount Cantidad bruta de rendimiento a incorporar.
     */
    function allocateYield(address user, uint256 amount) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (user == address(0)) revert IProtocolErrors.ZeroAddress();
        if (amount == 0) revert IProtocolErrors.ZeroAmount();

        pendingYields[user] = _calculateCompoundedYield(user) + amount;
        lastYieldUpdateTimestamp[user] = block.timestamp;
    }

    /**
     * @notice Reclama el rendimiento acumulado transfiriéndolo directamente a la cuenta del emisor.
     * @dev Revierte si la bóveda no dispone de suficiente liquidez, protegiendo el saldo del usuario.
     * @param amount Cantidad exacta de rendimiento a retirar.
     */
    function claimYield(uint256 amount) external override nonReentrant {
        if (amount == 0) revert IProtocolErrors.ZeroAmount();
        uint256 currentYield = _calculateCompoundedYield(msg.sender);
        if (currentYield < amount) revert InsufficientYieldBalance(amount, currentYield);

        uint256 bal = IERC20(yieldToken).balanceOf(address(this));
        if (bal < amount) revert InsufficientYieldBalance(amount, bal);

        pendingYields[msg.sender] = currentYield - amount;
        lastYieldUpdateTimestamp[msg.sender] = block.timestamp;

        IERC20(yieldToken).safeTransfer(msg.sender, amount);

        emit YieldClaimed(msg.sender, amount, false);
    }

    /**
     * @notice Permite el reclamo de rendimientos sin pagar gas mediante una firma EIP-712 transmitida por un relayer/keeper.
     * @param request Estructura con usuario, cantidad, nonce y fecha límite.
     * @param signature Firma ECDSA generada por la billetera del usuario.
     */
    function claimYieldGasless(ClaimRequest calldata request, bytes calldata signature) external override nonReentrant {
        if (request.deadline < block.timestamp) revert SignatureExpired();
        uint256 currentNonce = nonces[request.user];
        if (request.nonce != currentNonce) revert InvalidNonce();
        unchecked {
            ++nonces[request.user];
        }

        uint256 currentYield = _calculateCompoundedYield(request.user);
        if (currentYield < request.amount) revert InsufficientYieldBalance(request.amount, currentYield);

        uint256 bal = IERC20(yieldToken).balanceOf(address(this));
        if (bal < request.amount) revert InsufficientYieldBalance(request.amount, bal);

        // Construir hash estructurado EIP-712
        bytes32 structHash =
            keccak256(abi.encode(CLAIM_TYPEHASH, request.user, request.amount, request.nonce, request.deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));

        // Recuperar y verificar dirección firmante
        address signer = ECDSA.recover(digest, signature);
        if (signer != request.user) revert InvalidSignature();

        pendingYields[request.user] = currentYield - request.amount;
        lastYieldUpdateTimestamp[request.user] = block.timestamp;

        IERC20(yieldToken).safeTransfer(request.user, request.amount);

        emit YieldClaimed(request.user, request.amount, true);
    }

    /**
     * @notice Consulta el rendimiento acumulado disponible en tiempo real para un usuario.
     * @param user Dirección del usuario a consultar.
     * @return Rendimiento total disponible incluyendo el interés compuesto devengado.
     */
    function getPendingYield(address user) external view override returns (uint256) {
        return _calculateCompoundedYield(user);
    }
}
