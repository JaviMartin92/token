// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./ProtocolAddressProvider.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title AlphaToken (ALPHA)
 * @author Alpha Centauri Architecture Team
 * @notice Token de cuota patrimonial y gobernanza del protocolo Alpha Centauri con soporte EIP-2612 (Permit).
 * @dev Cada token ALPHA representa una participación proporcional sobre la cesta de activos exógenos
 *      (USDC, WBTC, WETH) custodiados en la tesorería. La emisión y quema están estrictamente restringidas
 *      a contratos autorizados mediante RBAC (MINTER_ROLE y BURNER_ROLE).
 *      El soporte de EIP-2612 Permit permite aprobaciones sin coste de gas (gasless) optimizadas para Arbitrum.
 */
contract AlphaToken is ERC20, ERC20Permit, AccessControl {
    /// @notice Proveedor central de direcciones inmutable del protocolo.
    ProtocolAddressProvider public immutable addressProvider;

    /**
     * @notice Inicializa el token ALPHA con su símbolo, nombre y administrador génesis.
     * @param _addressProvider Contrato central de registro de direcciones del protocolo.
     * @param initialAdmin Dirección que recibe el rol inicial DEFAULT_ADMIN_ROLE (transferido al Timelock en mainnet).
     */
    constructor(ProtocolAddressProvider _addressProvider, address initialAdmin)
        ERC20("Alpha Centauri Shares", "ALPHA")
        ERC20Permit("Alpha Centauri Shares")
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
     * @notice Acuña nuevas participaciones ALPHA respaldadas por depósitos a valor liquidativo (NAV).
     * @dev Restringido estrictamente a direcciones que posean `MINTER_ROLE` (`TreasuryManager.sol`).
     * @param to Dirección de la billetera o contrato receptor de los tokens.
     * @param amount Cantidad exacta de tokens en unidades wei (18 decimales) a acuñar.
     */
    function mint(address to, uint256 amount) external onlyRole(ProtocolRoles.MINTER_ROLE) {
        if (amount == 0) {
            revert IProtocolErrors.ZeroAmount();
        }
        _mint(to, amount);
    }

    /**
     * @notice Quema voluntariamente tokens ALPHA de la cuenta del emisor (`msg.sender`).
     * @param amount Cantidad exacta de tokens a quemar.
     */
    function burn(uint256 amount) external {
        if (amount == 0) {
            revert IProtocolErrors.ZeroAmount();
        }
        _burn(msg.sender, amount);
    }

    /**
     * @notice Quema tokens ALPHA de una cuenta específica con deducción de `allowance`.
     * @dev Restringido a direcciones con `BURNER_ROLE` (`TreasuryManager.sol` en rescates y `DiscountBuybackEngine.sol`).
     * @param account Cuenta propietaria de los tokens a ser quemados.
     * @param amount Cantidad de tokens a quemar.
     */
    function burnFrom(address account, uint256 amount) external onlyRole(ProtocolRoles.BURNER_ROLE) {
        if (amount == 0) {
            revert IProtocolErrors.ZeroAmount();
        }
        if (account != msg.sender) {
            _spendAllowance(account, msg.sender, amount);
        }
        _burn(account, amount);
    }
}
