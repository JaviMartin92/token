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
 * @author Alpha Centauri Architecture Team
 * @notice Bóveda fiduciaria para gastos operacionales, auditorías externas, nodos RPC y subvenciones de desarrollo.
 * @dev Custodia el porcentaje de comisiones protocolarias reservadas para sostenibilidad técnica.
 *      Los retiros están estrictamente restringidos al rol `ADMIN_ROLE` (gestionado por el `TimelockController.sol` con 72h de retraso).
 *      Cada retiro emite un evento público auditable con el motivo exacto (`purpose`) en la blockchain.
 */
contract ProtocolOpExVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Token estable de liquidación utilizado para gastos operativos (USDC).
    IERC20 public immutable stablecoin;

    // =========================================================================
    // 📢 EVENTOS DE OPERACIONES & AUDITORÍA ON-CHAIN
    // =========================================================================
    event OpExDeposited(address indexed source, uint256 amount);
    event OpExWithdrawn(address indexed recipient, uint256 amount, string purpose);

    /**
     * @notice Constructor del Vault de Gastos Operativos.
     * @param _stablecoin Dirección del contrato ERC-20 del stablecoin (ej. USDC).
     * @param _initialOwner Dirección administradora génesis (TimelockController en mainnet).
     */
    constructor(address _stablecoin, address _initialOwner) {
        if (_stablecoin == address(0)) revert IProtocolErrors.ZeroAddress();
        if (_initialOwner == address(0)) revert IProtocolErrors.ZeroAddress();
        stablecoin = IERC20(_stablecoin);

        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialOwner);
    }

    /**
     * @notice Recibe comisiones operacionales en USDC desde el enrutador de rendimientos.
     * @param amount Cantidad exacta de USDC a depositar.
     */
    function depositOpEx(uint256 amount) external nonReentrant {
        if (amount == 0) revert IProtocolErrors.ZeroAmount();
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);
        emit OpExDeposited(msg.sender, amount);
    }

    /**
     * @notice Retira fondos en USDC para sufragar gastos aprobados por la DAO (auditorías, infraestructura, RPCs, grants).
     * @dev Restringido a `ADMIN_ROLE` (TimelockController con 72h de retraso).
     * @param recipient Dirección de la entidad receptora de los fondos (ej. firma auditora).
     * @param amount Cantidad exacta de USDC a desembolsar.
     * @param purpose Justificación y descripción del gasto para transparencia y auditoría on-chain.
     */
    function withdrawOpEx(address recipient, uint256 amount, string calldata purpose)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
        nonReentrant
    {
        if (recipient == address(0)) revert IProtocolErrors.ZeroAddress();
        if (amount == 0) revert IProtocolErrors.ZeroAmount();
        uint256 currentBalance = stablecoin.balanceOf(address(this));
        if (amount > currentBalance) revert IProtocolErrors.InvalidAmount();

        stablecoin.safeTransfer(recipient, amount);
        emit OpExWithdrawn(recipient, amount, purpose);
    }

    /**
     * @notice Consulta el saldo de fondos operativos disponibles en la bóveda.
     */
    function getBalance() external view returns (uint256) {
        return stablecoin.balanceOf(address(this));
    }
}
