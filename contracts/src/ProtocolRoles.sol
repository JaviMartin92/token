// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ProtocolRoles
 * @author Alpha Centauri Architecture Team
 * @notice Registro central canónico e inmutable de todos los roles de AccessControl utilizados en el protocolo Alpha Centauri.
 * @dev Todas las constantes se declaran como `internal constant` para garantizar que el compilador de Solidity (0.8.20+)
 *      inserte los hashes calculados directamente en el bytecode de los contratos consumidores en tiempo de compilación,
 *      eliminando llamadas externas, costes de despliegue y enlaces de librerías en tiempo de ejecución.
 */
library ProtocolRoles {
    // =========================================================================
    // 🏛️ ROLES PRINCIPALES DE GOBERNANZA & ADMINISTRACIÓN
    // =========================================================================

    /**
     * @notice Rol de administración fiduciaria del protocolo.
     * @dev En producción (Pure DeFi), este rol debe ser propiedad exclusiva e irreversible del `TimelockController.sol`.
     *      Ninguna dirección EOA (billetera privada) debe retener este rol tras el despliegue génesis.
     */
    bytes32 internal constant ADMIN_ROLE = keccak256("PROTOCOL_ADMIN_ROLE");

    /**
     * @notice Rol administrativo de emergencia para activación de pausas o circuit breakers.
     * @dev Asignado al `CircuitBreaker.sol` y al `TimelockController.sol`.
     */
    bytes32 internal constant EMERGENCY_ADMIN_ROLE = keccak256("EMERGENCY_ADMIN_ROLE");

    // =========================================================================
    // 🏦 ROLES DE TESORERÍA, BÓVEDAS & GESTIÓN DE LIQUIDEZ
    // =========================================================================

    /**
     * @notice Rol para gestión interna y distribución de activos entre las bóvedas del protocolo.
     * @dev Asignado a `TreasuryManager.sol`, `DiscountBuybackEngine.sol` y `RealYieldRouter.sol`.
     */
    bytes32 internal constant VAULT_MANAGER_ROLE = keccak256("VAULT_MANAGER_ROLE");

    /**
     * @notice Rol para rebalanceo y ajuste fiduciario de reservas exógenas.
     * @dev Controlado por la DAO mediante propuestas con Timelock de 72 horas.
     */
    bytes32 internal constant RESERVE_MANAGER_ROLE = keccak256("RESERVE_MANAGER_ROLE");

    /**
     * @notice Rol para la ruta y distribución atómica de dividendos Real Yield.
     * @dev Asignado exclusivamente al contrato `RealYieldRouter.sol`.
     */
    bytes32 internal constant YIELD_ROUTER_ROLE = keccak256("YIELD_ROUTER_ROLE");

    // =========================================================================
    // 🪙 ROLES DE EMISIÓN & QUEMA DE PARTICIPACIONES (ALPHA TOKEN)
    // =========================================================================

    /**
     * @notice Rol con potestad para acuñar cuotas de ALPHA respaldadas en reservas (NAV).
     * @dev Asignado exclusivamente a `TreasuryManager.sol` contra depósito verificado de colateral exógeno.
     */
    bytes32 internal constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /**
     * @notice Rol con potestad para quemar tokens ALPHA durante reembolsos o buybacks deflacionarios.
     * @dev Asignado a `TreasuryManager.sol` y `DiscountBuybackEngine.sol`.
     */
    bytes32 internal constant BURNER_ROLE = keccak256("BURNER_ROLE");

    // =========================================================================
    // ⚙️ ROLES DE OPERACIONES, ORÁCULOS & KEEPER BOTS
    // =========================================================================

    /**
     * @notice Rol para actualización y registro de feeds Chainlink en el Router de Precios.
     * @dev Restringido a propuestas aprobadas de gobernanza DAO vía `TimelockController.sol`.
     */
    bytes32 internal constant ORACLE_MANAGER_ROLE = keccak256("ORACLE_MANAGER_ROLE");

    /**
     * @notice Rol para cumplimiento normativo (MiCA / KYC fiduciario para gateway institucional).
     */
    bytes32 internal constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    /**
     * @notice Rol para bots automatizados (Keepers) encargados del rebalanceo y ejecución de buybacks con descuento.
     */
    bytes32 internal constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    // =========================================================================
    // 🛡️ ROLES DE SEGURIDAD CRIPTOGRÁFICA POST-CUÁNTICA (PQC)
    // =========================================================================

    /**
     * @notice Rol de operador cuántico para autorizar migraciones de estado mediante firmas Winternitz W-OTS+.
     * @dev Asignado al módulo `PostQuantumGuard.sol`.
     */
    bytes32 internal constant QUANTUM_OPERATOR_ROLE = keccak256("QUANTUM_OPERATOR_ROLE");

    /**
     * @notice Rol de auditor independiente para verificación de compromisos de claves cuánticas de 67 cadenas.
     */
    bytes32 internal constant QUANTUM_AUDITOR_ROLE = keccak256("QUANTUM_AUDITOR_ROLE");
}
