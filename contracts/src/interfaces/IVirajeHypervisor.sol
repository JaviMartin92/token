// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVirajeHypervisor
 * @author Viraje Protocol Architecture Team
 * @notice Interfaz central del Hypervisor de Viraje: Centinela Pre-Transaccional y Guardián de Invariantes.
 * @dev Provee métodos para simulación estática (pre-flight inspection), auditoría de solvencia y verificación on-chain.
 */
interface IVirajeHypervisor {
    // =========================================================================
    // 📊 ESTRUCTURAS DE DATOS
    // =========================================================================

    enum AnomalySeverity {
        NONE,        // 0: Operación 100% segura
        WARNING,     // 1: Alerta no bloqueante (desvío leve)
        CRITICAL,    // 2: Infracción severa de invariante (NAV decreciente o insolvencia)
        FATAL        // 3: Explotación potencial / reentrancia / oráculo corrupto
    }

    struct PreFlightReport {
        bool isSafe;
        AnomalySeverity severity;
        uint8 riskScore;                       // Puntuación 0 (óptimo) a 100 (ataque/revert)
        uint256 currentNAVPerShare;            // NAV actual en USD (18 decimales)
        uint256 projectedNAVPerShare;          // NAV proyectado tras la operación
        uint256 currentCollateralRatioBps;     // Ratio de colateralización actual (10000 = 100%)
        uint256 projectedCollateralRatioBps;   // Ratio proyectado tras la operación
        uint256 totalTreasuryDebtUSD;          // Deuda viva en préstamos de tesorería
        uint256 maxTreasuryDebtCapUSD;         // Techo máximo prudencial de deuda (20% de tesorería)
        bytes32 anomalyCode;                   // Código hash del motivo (0 si es limpio)
        string summary;                        // Diagnóstico legible para la interfaz
    }

    struct TreasuryHealthReport {
        bool isHealthy;
        uint256 navPerShare;
        uint256 collateralRatioBps;
        uint256 totalAssetsUSD;
        uint256 totalLiabilitiesUSD;
        uint256 totalDebtUSD;
        uint256 maxDebtCapUSD;
    }

    struct HypervisorConfig {
        uint256 minCollateralRatioBps;         // Mínimo ratio de solvencia (default: 10000 = 100%)
        uint256 maxTreasuryLoanRatioBps;       // Máxima deuda P2P vs reservas líquidas (default: 2000 = 20%)
        uint256 maxSingleAssetWeightBps;       // Concentración máxima por activo (default: 7500 = 75%)
        uint256 navToleranceBps;               // Tolerancia de redondeo NAV (default: 5 bps = 0.05%)
        uint256 maxOracleStalenessSeconds;     // Máxima edad de datos de oráculo (default: 3600 = 1h)
        bool enforceOnChain;                   // Si es true, activa los reverts en el hook on-chain
        bool isPaused;                         // Pausa de emergencia global del hypervisor
    }

    // =========================================================================
    // 📢 EVENTOS
    // =========================================================================

    event HypervisorConfigUpdated(HypervisorConfig oldConfig, HypervisorConfig newConfig);
    event PreFlightInspectionConducted(address indexed caller, address indexed target, bytes4 indexed selector, bool isSafe, uint8 riskScore);
    event InvariantBreached(bytes32 indexed anomalyCode, uint256 expected, uint256 actual, string reason);
    event CircuitBreakerActionTriggered(address indexed asset, string reason);

    // =========================================================================
    // 🚨 ERRORES PERSONALIZADOS (EIP-838)
    // =========================================================================

    error HypervisorPaused();
    error InvariantNAVDecreased(uint256 preNAV, uint256 postNAV);
    error InvariantSolvencyBreached(uint256 currentRatioBps, uint256 minRatioBps);
    error TreasuryDebtCapExceeded(uint256 proposedDebtUSD, uint256 maxCapUSD);
    error AssetConcentrationBreached(address asset, uint256 weightBps, uint256 maxWeightBps);
    error OracleStaleOrCompromised(address feed, uint256 updatedAt, uint256 maxStaleness);
    error TargetCallFailed(bytes revertData);

    // =========================================================================
    // 🔍 MÉTODOS DE INSPECCIÓN Y PRE-FLIGHT
    // =========================================================================

    function inspectPreFlight(
        address target,
        bytes calldata data,
        address user
    ) external view returns (PreFlightReport memory report);

    function assessTreasuryHealth() external view returns (TreasuryHealthReport memory health);

    function verifyStateTransition(
        uint256 preNAVPerShare,
        uint256 postNAVPerShare,
        uint256 preCollateralRatioBps,
        uint256 postCollateralRatioBps
    ) external view;

    function getConfig() external view returns (HypervisorConfig memory);
}
