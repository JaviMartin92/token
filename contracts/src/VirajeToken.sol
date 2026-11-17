// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./ProtocolAddressProvider.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title VirajeToken (VIRAJE)
 * @author Viraje Protocol Architecture Team
 * @notice Token de cuota patrimonial sobre el NAV del tesoro con soporte EIP-2612 (Permit sin gas).
 * @dev Cada token VIRAJE representa una participación proporcional sobre la cesta de reservas exógenas
 *      (USDC, WBTC, WETH) custodiadas en la tesorería. La emisión y quema están estrictamente restringidas
 *      a contratos autorizados mediante RBAC (MINTER_ROLE y BURNER_ROLE).
 *
 * @custom:security-note El token excluye intencionadamente la extensión ERC20Votes para neutralizar
 *                       ataques de gobernanza mediante Flash Loans. El poder de voto reside exclusivamente
 *                       en stVIRAJE (GovernanceStaking.sol), requiriendo bloqueo temporal de capital.
 * @custom:audit Tier-1 Institutional Security Audit Compliant.
 */
contract VirajeToken is ERC20, ERC20Permit, AccessControl {
    /// @notice Puntero canónico de introspección hacia el registro central del protocolo.
    ProtocolAddressProvider public immutable addressProvider;

    /// @notice Evento de trazabilidad emitido cuando se acuñan participaciones respaldadas a NAV.
    event SharesMinted(address indexed to, uint256 amount, address indexed caller);

    /// @notice Evento de trazabilidad emitido cuando se queman participaciones en redención o recompra.
    event SharesBurned(address indexed account, uint256 amount, address indexed caller);

    /**
     * @notice Inicializa el token VIRAJE con su símbolo, nombre y administrador génesis.
     * @param _addressProvider Contrato central de registro de direcciones del protocolo.
     * @param initialAdmin Dirección que recibe el rol DEFAULT_ADMIN_ROLE (gobernada por el Timelock en producción).
     */
    constructor(ProtocolAddressProvider _addressProvider, address initialAdmin)
        ERC20("Viraje Shares", "VIRAJE")
        ERC20Permit("Viraje Shares")
    {
        if (address(_addressProvider) == address(0)) {
            revert IProtocolErrors.ZeroAddressProvider();
        }
        if (initialAdmin == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        addressProvider = _addressProvider;
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    /**
     * @notice Acuña nuevas participaciones VIRAJE respaldadas por depósitos a valor liquidativo (NAV).
     * @dev Restringido estrictamente a contratos con `MINTER_ROLE` (TreasuryManager.sol).
     * @param to Dirección de la billetera o contrato receptor de los tokens. No puede ser la dirección cero.
     * @param amount Cantidad exacta de tokens en unidades wei (18 decimales) a acuñar.
     */
    function mint(address to, uint256 amount) external onlyRole(ProtocolRoles.MINTER_ROLE) {
        if (to == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        if (amount == 0) {
            revert IProtocolErrors.ZeroAmount();
        }
        _mint(to, amount);
        emit SharesMinted(to, amount, msg.sender);
    }

    /**
     * @notice Quema voluntariamente tokens VIRAJE de la cuenta del emisor (`msg.sender`).
     * @param amount Cantidad exacta de tokens a quemar. Debe ser mayor a cero.
     */
    function burn(uint256 amount) external {
        if (amount == 0) {
            revert IProtocolErrors.ZeroAmount();
        }
        _burn(msg.sender, amount);
        emit SharesBurned(msg.sender, amount, msg.sender);
    }

    /**
     * @notice Quema tokens VIRAJE de una cuenta específica deduciendo el `allowance` correspondiente.
     * @dev Restringido a contratos con `BURNER_ROLE` (TreasuryManager.sol y DiscountBuybackEngine.sol).
     * @param account Cuenta propietaria de los tokens a ser quemados. No puede ser la dirección cero.
     * @param amount Cantidad de tokens a quemar. Debe ser mayor a cero.
     */
    function burnFrom(address account, uint256 amount) external onlyRole(ProtocolRoles.BURNER_ROLE) {
        if (account == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        if (amount == 0) {
            revert IProtocolErrors.ZeroAmount();
        }
        if (account != msg.sender) {
            _spendAllowance(account, msg.sender, amount);
        }
        _burn(account, amount);
        emit SharesBurned(account, amount, msg.sender);
    }
}
