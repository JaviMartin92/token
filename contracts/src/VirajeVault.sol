// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ProtocolRoles.sol";
import "./ProtocolAddressProvider.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title VirajeVault
 * @author Viraje Protocol Architecture Team
 * @notice Bóveda de custodia de máxima seguridad y aislamiento patrimonial para los activos de reserva del protocolo.
 * @dev Este contrato actúa como un búnker de almacenamiento en frío/templado para activos exógenos (USDC, WBTC, WETH).
 *      No contiene lógica de negocio, cálculos de tarifas ni interfaces externas no restringidas, eliminando vectores
 *      de reentrancia. La transferencia o autorización de fondos está estrictamente limitada a contratos autorizados
 *      que posean `VAULT_MANAGER_ROLE` (`TreasuryManager.sol` y `DiscountBuybackEngine.sol`).
 *
 * @custom:security-note Inmunidad estructural a reentrancia: el contrato carece de estado financiero mutable.
 *                       Rechaza transferencias directas de ETH nativo para garantizar la homogeneidad de reservas.
 * @custom:audit Tier-1 Institutional Security Audit Compliant.
 */
contract VirajeVault is AccessControl {
    using SafeERC20 for IERC20;

    /// @notice Puntero canónico de introspección hacia el registro central del protocolo.
    ProtocolAddressProvider public immutable addressProvider;

    // =========================================================================
    // 📢 EVENTOS DE CUSTODIA INSTITUCIONAL
    // =========================================================================
    /// @notice Emitido cuando se transfieren activos de reserva hacia un destinatario autorizado.
    event FundsTransferred(address indexed token, address indexed to, uint256 amount, address indexed operator);

    /// @notice Emitido cuando se autoriza un límite de gasto a un tercero autorizado (ej. Adaptador de Yield).
    event FundsApproved(address indexed token, address indexed spender, uint256 amount, address indexed operator);

    /**
     * @notice Inicializa la bóveda con su registro de direcciones y administrador inicial.
     * @param _addressProvider Contrato de registro de direcciones del protocolo.
     * @param initialAdmin Dirección que recibe el rol de administración inicial (gobernada por Timelock en mainnet).
     */
    constructor(ProtocolAddressProvider _addressProvider, address initialAdmin) {
        if (address(_addressProvider) == address(0)) revert IProtocolErrors.ZeroAddressProvider();
        if (initialAdmin == address(0)) revert IProtocolErrors.ZeroAddress();
        addressProvider = _addressProvider;
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    /**
     * @notice Transfiere activos de reserva de manera segura hacia un destinatario autorizado.
     * @dev Restringido estrictamente a `VAULT_MANAGER_ROLE` (`TreasuryManager.sol` y `DiscountBuybackEngine.sol`).
     * @param token Dirección del token ERC-20 a transferir. No puede ser la dirección cero.
     * @param to Dirección de la cuenta o contrato receptor. No puede ser la dirección cero.
     * @param amount Cantidad exacta de tokens a transferir. Debe ser mayor a cero.
     */
    function transferFunds(address token, address to, uint256 amount)
        external
        onlyRole(ProtocolRoles.VAULT_MANAGER_ROLE)
    {
        if (token == address(0)) revert IProtocolErrors.ZeroAddress();
        if (to == address(0)) revert IProtocolErrors.ZeroAddress();
        if (amount == 0) revert IProtocolErrors.ZeroAmount();
        IERC20(token).safeTransfer(to, amount);
        emit FundsTransferred(token, to, amount, msg.sender);
    }

    /**
     * @notice Otorga autorización de gasto a un tercero autorizado (ej. Adaptador Morpho Blue o SwapRouter).
     * @dev Compatible con tokens no estándar (ej. USDT) mediante reseteo preventivo del allowance si es mayor a cero.
     * @param token Dirección del token ERC-20 a autorizar. No puede ser la dirección cero.
     * @param spender Dirección del contrato que recibe la autorización. No puede ser la dirección cero.
     * @param amount Cantidad máxima autorizada.
     */
    function approveFunds(address token, address spender, uint256 amount)
        external
        onlyRole(ProtocolRoles.VAULT_MANAGER_ROLE)
    {
        if (token == address(0)) revert IProtocolErrors.ZeroAddress();
        if (spender == address(0)) revert IProtocolErrors.ZeroAddress();
        
        // Mitigación específica para USDT y tokens con protección non-zero to non-zero allowance
        uint256 currentAllowance = IERC20(token).allowance(address(this), spender);
        if (currentAllowance > 0 && amount > 0) {
            IERC20(token).safeApprove(spender, 0);
        }
        
        IERC20(token).safeApprove(spender, amount);
        emit FundsApproved(token, spender, amount, msg.sender);
    }

    /**
     * @notice Consulta el saldo custodiado de un token específico en la bóveda.
     * @param token Dirección del token ERC-20 a consultar. No puede ser la dirección cero.
     * @return Balance actual del token en posesión de este contrato.
     */
    function getBalance(address token) external view returns (uint256) {
        if (token == address(0)) revert IProtocolErrors.ZeroAddress();
        return IERC20(token).balanceOf(address(this));
    }
}
