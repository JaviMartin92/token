// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title ProtocolOpExVault
 * @author Viraje Protocol Architecture Team
 * @notice Bóveda fiduciaria para gastos operacionales, auditorías externas de seguridad,
 *         infraestructura de nodos RPC y subvenciones de desarrollo técnico.
 * @dev Custodia el porcentaje de ingresos y comisiones protocolarias reservadas para sostenibilidad técnica.
 *      Los retiros de capital operativo están estrictamente restringidos al rol `ADMIN_ROLE`
 *      (gobernado de forma obligatoria por el `TimelockController.sol` con un retraso mínimo de 72 horas).
 *      Cada retiro emite un evento público auditable con la justificación exacta (`purpose`) registrada on-chain.
 *      Implementa rescate de tokens ERC-20 accidentales con bloqueo inviolable del stablecoin operativo.
 */
contract ProtocolOpExVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Token estable de liquidación utilizado para gastos operativos institucionales (ej. USDC).
    IERC20 public immutable stablecoin;

    /// @notice Contador acumulativo de fondos operativos recibidos en stablecoin (telemetría on-chain).
    uint256 public totalOpExReceived;

    /// @notice Contador acumulativo de fondos operativos desembolsados en stablecoin (telemetría on-chain).
    uint256 public totalOpExDisbursed;

    // =========================================================================
    // 📢 EVENTOS DE OPERACIONES, AUDITORÍA & RESCATE ON-CHAIN
    // =========================================================================
    
    /// @notice Emitido cuando se depositan fondos de comisiones operativas en el vault.
    event OpExDeposited(address indexed source, uint256 amount);

    /// @notice Emitido cuando la DAO desembolsa fondos operativos aprobados tras el timelock.
    event OpExWithdrawn(address indexed recipient, uint256 amount, string purpose);

    /// @notice Emitido cuando se rescatan tokens ERC-20 no operativos transferidos accidentalmente.
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Constructor del Vault de Gastos Operativos.
     * @dev Asigna los roles iniciales de administración al propietario génesis (TimelockController en mainnet).
     * @param _stablecoin Dirección del contrato ERC-20 del stablecoin operativo (ej. USDC).
     * @param _initialOwner Dirección administradora génesis receptora de DEFAULT_ADMIN_ROLE y ADMIN_ROLE.
     */
    constructor(address _stablecoin, address _initialOwner) {
        if (_stablecoin == address(0)) revert IProtocolErrors.ZeroAddress();
        if (_initialOwner == address(0)) revert IProtocolErrors.ZeroAddress();
        stablecoin = IERC20(_stablecoin);

        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialOwner);
    }

    /**
     * @notice Recibe comisiones operacionales en stablecoin desde enrutadores o módulos autorizados.
     * @dev Requiere aprobación previa de allowance (`transferFrom`). Incrementa la métrica `totalOpExReceived`.
     * @param amount Cantidad exacta de stablecoin a depositar.
     */
    function depositOpEx(uint256 amount) external nonReentrant {
        if (amount == 0) revert IProtocolErrors.ZeroAmount();
        
        totalOpExReceived += amount;
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);
        
        emit OpExDeposited(msg.sender, amount);
    }

    /**
     * @notice Retira fondos en stablecoin para sufragar gastos operativos aprobados por la gobernanza DAO
     *         (auditorías de seguridad, infraestructura de red, nodos RPC, subvenciones de ingeniería).
     * @dev Restringido estrictamente a `ADMIN_ROLE` (TimelockController con 72h de retraso obligatorio).
     *      Valida que la justificación (`purpose`) no sea vacía para garantizar trazabilidad pública inmutable.
     * @param recipient Dirección institucional receptora de los fondos (ej. firma auditora o proveedor).
     * @param amount Cantidad exacta de stablecoin a desembolsar.
     * @param purpose Justificación y descripción forense del gasto para auditoría pública on-chain.
     */
    function withdrawOpEx(address recipient, uint256 amount, string calldata purpose)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
        nonReentrant
    {
        if (recipient == address(0)) revert IProtocolErrors.ZeroAddress();
        if (amount == 0) revert IProtocolErrors.ZeroAmount();
        if (bytes(purpose).length == 0) revert IProtocolErrors.InvalidParameters();
        
        uint256 currentBalance = stablecoin.balanceOf(address(this));
        if (amount > currentBalance) revert IProtocolErrors.InvalidAmount();

        totalOpExDisbursed += amount;
        stablecoin.safeTransfer(recipient, amount);
        
        emit OpExWithdrawn(recipient, amount, purpose);
    }

    /**
     * @notice Rescata tokens ERC-20 transferidos accidentalmente a la bóveda (excluyendo el stablecoin operativo).
     * @dev Prohíbe estrictamente el rescate del stablecoin operativo (`stablecoin`) para preservar los fondos OpEx.
     *      Restringido exclusivamente a `ADMIN_ROLE` bajo timelock descentralizado.
     * @param token Dirección del contrato ERC-20 a rescatar.
     * @param to Dirección de destino donde se transferirán los tokens rescatados.
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
     * @notice Consulta el saldo de fondos operativos disponibles en la bóveda.
     * @return Cantidad de stablecoin en custodia disponible para gastos operativos.
     */
    function getBalance() external view returns (uint256) {
        return stablecoin.balanceOf(address(this));
    }
}
