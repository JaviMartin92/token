// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ProtocolRoles
 * @author Viraje Protocol Architecture Team
 * @notice Registro central canónico e inmutable de todos los roles de AccessControl utilizados en el protocolo Viraje Protocol.
 * @dev Todas las constantes se declaran como `internal constant` para garantizar que el compilador de Solidity (0.8.20+)
 *      inserte los hashes calculados directamente en el bytecode de los contratos consumidores en tiempo de compilación (inlined PUSH32),
 *      eliminando llamadas externas, costes de almacenamiento (SLOAD) y costes de despliegue en tiempo de ejecución.
 *
 * @custom:security-note Principio de mínimo privilegio y segregación estricta de responsabilidades:
 *                       - ROOT_ADMIN_ROLE (0x00): Exclusivo para gestión de roles vía Timelock.
 *                       - ADMIN_ROLE: Parámetros operativos gobernados por la DAO.
 *                       - MINTER/BURNER/VAULT_MANAGER: Segregación técnica sin permisos de administración cruzados.
 * @custom:audit Tier-1 Institutional Security Audit Compliant.
 */
library ProtocolRoles {
    // =========================================================================
    // 🏛️ ROLES PRINCIPALES DE GOBERNANZA & ADMINISTRACIÓN
    // =========================================================================

    /**
     * @notice Rol raíz de administración fiduciaria (equivalente a DEFAULT_ADMIN_ROLE en OpenZeppelin).
     * @dev Único rol capacitado para conceder y revocar otros roles.
     *      En producción (Pure DeFi), este rol es propiedad exclusiva e irreversible del `TimelockController.sol`.
     */
    bytes32 internal constant ROOT_ADMIN_ROLE = 0x00;

    /**
     * @notice Rol de administración operativa del protocolo para parametrización de módulos.
     * @dev Controlado por la DAO mediante propuestas con Timelock de 72 horas.
     */
    bytes32 internal constant ADMIN_ROLE = keccak256("PROTOCOL_ADMIN_ROLE");

    /**
     * @notice Rol administrativo de emergencia para activación de pausas defensivas o circuit breakers.
     * @dev Asignado al `CircuitBreaker.sol` y al `TimelockController.sol`.
     */
    bytes32 internal constant EMERGENCY_ADMIN_ROLE = keccak256("EMERGENCY_ADMIN_ROLE");

    // =========================================================================
    // ⏳ ROLES DE GOBERNANZA TIMELOCK (DAO CONTROLLER)
    // =========================================================================

    /**
     * @notice Rol de administración interna del TimelockController.
     */
    bytes32 internal constant TIMELOCK_ADMIN_ROLE = keccak256("TIMELOCK_ADMIN_ROLE");

    /**
     * @notice Rol con potestad para encolar propuestas aprobadas tras votación de gobernanza.
     * @dev Asignado exclusivamente al contrato `GovernorViraje.sol`.
     */
    bytes32 internal constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");

    /**
     * @notice Rol con potestad para ejecutar propuestas transcurrido el tiempo de retardo (72h).
     * @dev En Pure DeFi se asigna a `address(0)` para permitir ejecución descentralizada y permisionless.
     */
    bytes32 internal constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    /**
     * @notice Rol con potestad para cancelar propuestas encoladas ante detección de fallos o emergencias.
     * @dev Asignado a `GovernorViraje.sol` y al Timelock.
     */
    bytes32 internal constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");

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
    // 🪙 ROLES DE EMISIÓN & QUEMA DE PARTICIPACIONES (VIRAJE Shares)
    // =========================================================================

    /**
     * @notice Rol con potestad para acuñar cuotas de VIRAJE respaldadas en reservas (NAV).
     * @dev Asignado exclusivamente a `TreasuryManager.sol` contra depósito verificado de colateral exógeno.
     */
    bytes32 internal constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /**
     * @notice Rol con potestad para quemar tokens VIRAJE durante reembolsos o buybacks deflacionarios.
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
