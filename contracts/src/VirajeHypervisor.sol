// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/IVirajeHypervisor.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/ICircuitBreaker.sol";
import "./ProtocolAddressProvider.sol";
import "./ProtocolRoles.sol";

/* solhint-disable func-name-mixedcase */
interface IP2PLendingMarketView {
    function totalActiveLoansReceivableUSD() external view returns (uint256);
    function virajeCollateralHaircutBps() external view returns (uint256);
    function MAX_LTV_BPS() external view returns (uint256);
    function bondCollateralHaircutBps() external view returns (uint256);
}
/* solhint-enable func-name-mixedcase */

interface IVaultPositionNFTView {
    struct BondPosition {
        uint256 principal;
        uint256 discountedPrice;
        uint256 maturity;
        uint256 apr;
        bool claimed;
        bool isPledged;
    }
    function ownerOf(uint256 tokenId) external view returns (address);
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function getPosition(uint256 tokenId) external view returns (BondPosition memory);
}

/**
 * @title VirajeHypervisor
 * @author Viraje Protocol Architecture Team
 * @notice Centinela de Solvencia e Invariantes Pre-Transaccionales de Viraje Protocol.
 * @dev Permite simulación estática instantánea vía eth_call sin consumo de gas (inspectPreFlight)
 *      y verificación de transiciones de estado on-chain (verifyStateTransition).
 */
contract VirajeHypervisor is IVirajeHypervisor, AccessControl {
    // =========================================================================
    // 🏷️ CONSTANTES & CONFIGURACIÓN
    // =========================================================================

    ProtocolAddressProvider public immutable addressProvider;

    HypervisorConfig public config;

    // Selectores conocidos para inspección especializada
    bytes4 private constant SEL_REDEEM_1 = 0xba087652; // redeem(uint256)
    bytes4 private constant SEL_REDEEM_2 = 0x89791475; // redeem(uint256,uint256)
    bytes4 private constant SEL_DEPOSIT_1 = 0xb6b55f25; // deposit(uint256)
    bytes4 private constant SEL_DEPOSIT_2 = 0x003e8784; // deposit(uint256,uint256)
    bytes4 private constant SEL_BORROW_VIRAJE_1 = 0xfd7b27be; // borrowFromTreasuryWithViraje(uint256,uint256,uint256)
    bytes4 private constant SEL_BORROW_VIRAJE_2 = 0x221375d0; // borrowFromTreasuryWithViraje(uint256,uint256)
    bytes4 private constant SEL_BORROW_NFT = 0x933be074; // borrowFromTreasury(uint256,uint256)

    // Hash de anomalías conocidas
    bytes32 public constant ANOMALY_NONE = bytes32(0);
    bytes32 public constant ANOMALY_PAUSED = keccak256("HYPERVISOR_PAUSED");
    bytes32 public constant ANOMALY_INSUFFICIENT_BALANCE = keccak256("INSUFFICIENT_BALANCE");
    bytes32 public constant ANOMALY_INSUFFICIENT_ALLOWANCE = keccak256("INSUFFICIENT_ALLOWANCE");
    bytes32 public constant ANOMALY_MAX_LTV_EXCEEDED = keccak256("MAX_LTV_EXCEEDED");
    bytes32 public constant ANOMALY_DEBT_CAP_EXCEEDED = keccak256("DEBT_CAP_EXCEEDED");
    bytes32 public constant ANOMALY_INSUFFICIENT_TREASURY_LIQUIDITY = keccak256("INSUFFICIENT_TREASURY_LIQUIDITY");
    bytes32 public constant ANOMALY_CIRCUIT_BREAKER_ACTIVE = keccak256("CIRCUIT_BREAKER_ACTIVE");
    bytes32 public constant ANOMALY_NFT_NOT_OWNED = keccak256("NFT_NOT_OWNED");
    bytes32 public constant ANOMALY_NFT_NOT_APPROVED = keccak256("NFT_NOT_APPROVED");
    bytes32 public constant ANOMALY_NFT_ALREADY_PLEDGED = keccak256("NFT_ALREADY_PLEDGED");
    bytes32 public constant ANOMALY_NAV_DECREASED = keccak256("NAV_DECREASED");
    bytes32 public constant ANOMALY_INSOLVENCY = keccak256("INSOLVENCY_BREACH");

    // =========================================================================
    // 🏗️ CONSTRUCTOR
    // =========================================================================

    constructor(address _addressProvider, address _initialAdmin) {
        if (_addressProvider == address(0) || _initialAdmin == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }

        addressProvider = ProtocolAddressProvider(_addressProvider);

        _grantRole(DEFAULT_ADMIN_ROLE, _initialAdmin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialAdmin);
        _grantRole(ProtocolRoles.EMERGENCY_ADMIN_ROLE, _initialAdmin);

        // Parámetros institucionales por defecto
        config = HypervisorConfig({
            minCollateralRatioBps: 10000,       // 100% solvencia mínima
            maxTreasuryLoanRatioBps: 2000,     // 20% cap máximo de deuda en tesorería
            maxSingleAssetWeightBps: 7500,     // 75% concentración máxima de un activo
            navToleranceBps: 5,                // 0.05% tolerancia de redondeo de NAV
            maxOracleStalenessSeconds: 86400,  // 24 horas en testnet (ajustable a 1h en prod)
            enforceOnChain: true,              // Enforzamiento activo
            isPaused: false                    // Operativo
        });
    }

    // =========================================================================
    // ⚙️ GESTIÓN DE CONFIGURACIÓN
    // =========================================================================

    function updateConfig(HypervisorConfig calldata newConfig) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (newConfig.minCollateralRatioBps < 8000 || newConfig.maxTreasuryLoanRatioBps > 5000) {
            revert IProtocolErrors.InvalidParameters();
        }
        HypervisorConfig memory oldConfig = config;
        config = newConfig;
        emit HypervisorConfigUpdated(oldConfig, newConfig);
    }

    function setPause(bool paused) external onlyRole(ProtocolRoles.EMERGENCY_ADMIN_ROLE) {
        config.isPaused = paused;
    }

    function getConfig() external view override returns (HypervisorConfig memory) {
        return config;
    }

    // =========================================================================
    // 🔍 EVALUACIÓN DE SALUD DE TESORERÍA (GLOBAL HEALTH)
    // =========================================================================

    function assessTreasuryHealth() public view override returns (TreasuryHealthReport memory health) {
        address treasuryAddr = addressProvider.getTreasuryManager();
        if (treasuryAddr == address(0)) {
            return health;
        }

        ITreasury treasury = ITreasury(treasuryAddr);
        health.navPerShare = treasury.getNAVPerShare();
        (health.totalAssetsUSD, health.totalLiabilitiesUSD, health.collateralRatioBps) = treasury.getProofOfReserves();

        address p2pAddr = addressProvider.getP2PMarket();
        if (p2pAddr != address(0)) {
            try IP2PLendingMarketView(p2pAddr).totalActiveLoansReceivableUSD() returns (uint256 debt) {
                health.totalDebtUSD = debt;
            } catch {
                health.totalDebtUSD = 0;
            }
        }

        health.maxDebtCapUSD = (health.totalAssetsUSD * config.maxTreasuryLoanRatioBps) / 10000;

        bool solvencyOk = health.collateralRatioBps >= config.minCollateralRatioBps;
        bool debtCapOk = health.totalDebtUSD <= health.maxDebtCapUSD;
        bool notPaused = !config.isPaused;

        health.isHealthy = solvencyOk && debtCapOk && notPaused;
    }

    // =========================================================================
    // 🛡️ INSPECCIÓN PRE-FLIGHT (PRE-TRANSACTION SENTINEL)
    // =========================================================================

    function inspectPreFlight(
        address target,
        bytes calldata data,
        address user
    ) external view override returns (PreFlightReport memory report) {
        TreasuryHealthReport memory health = assessTreasuryHealth();

        report.currentNAVPerShare = health.navPerShare;
        report.projectedNAVPerShare = health.navPerShare;
        report.currentCollateralRatioBps = health.collateralRatioBps;
        report.projectedCollateralRatioBps = health.collateralRatioBps;
        report.totalTreasuryDebtUSD = health.totalDebtUSD;
        report.maxTreasuryDebtCapUSD = health.maxDebtCapUSD;

        if (config.isPaused) {
            report.isSafe = false;
            report.severity = AnomalySeverity.CRITICAL;
            report.riskScore = 100;
            report.anomalyCode = ANOMALY_PAUSED;
            report.summary = "Hypervisor en pausa preventiva de emergencia.";
            return report;
        }

        if (data.length < 4) {
            report.isSafe = health.isHealthy;
            report.severity = health.isHealthy ? AnomalySeverity.NONE : AnomalySeverity.WARNING;
            report.riskScore = health.isHealthy ? 0 : 40;
            report.summary = "Transaccion sin selector detectable. Salud del protocolo evaluada.";
            return report;
        }

        bytes4 selector = bytes4(data[:4]);
        address treasuryAddr = addressProvider.getTreasuryManager();
        address p2pAddr = addressProvider.getP2PMarket();

        // 1. Canje (Redeem)
        if (target == treasuryAddr && (selector == SEL_REDEEM_1 || selector == SEL_REDEEM_2)) {
            return _inspectRedeem(data, user, health, report);
        }

        // 2. Préstamo con VIRAJE en P2P
        if (target == p2pAddr && (selector == SEL_BORROW_VIRAJE_1 || selector == SEL_BORROW_VIRAJE_2)) {
            return _inspectBorrowViraje(data, user, health, report);
        }

        // 3. Préstamo con NFT en P2P
        if (target == p2pAddr && selector == SEL_BORROW_NFT) {
            return _inspectBorrowNFT(data, user, p2pAddr, report);
        }

        // Inspección general / Transacción estándar
        report.isSafe = health.isHealthy;
        report.severity = health.isHealthy ? AnomalySeverity.NONE : AnomalySeverity.WARNING;
        report.riskScore = health.isHealthy ? 5 : 45;
        report.summary = health.isHealthy
            ? "Operacion analizada: Invariantes globales de solvencia y NAV preservados."
            : "Alerta preventiva: Solvencia del protocolo en zona de precaucion.";
        return report;
    }

    // =========================================================================
    // 🧩 MÓDULOS INTERNOS DE INSPECCIÓN
    // =========================================================================

    function _inspectRedeem(
        bytes calldata data,
        address user,
        TreasuryHealthReport memory health,
        PreFlightReport memory report
    ) internal view returns (PreFlightReport memory) {
        uint256 sharesAmount = abi.decode(data[4:36], (uint256));
        address virajeToken = addressProvider.getVirajeToken();
        address treasuryAddr = addressProvider.getTreasuryManager();

        if (user != address(0) && virajeToken != address(0)) {
            if (IERC20(virajeToken).balanceOf(user) < sharesAmount) {
                report.isSafe = false;
                report.severity = AnomalySeverity.CRITICAL;
                report.riskScore = 85;
                report.anomalyCode = ANOMALY_INSUFFICIENT_BALANCE;
                report.summary = "Saldo de VIRAJE insuficiente para completar el canje solicitado.";
                return report;
            }

            if (IERC20(virajeToken).allowance(user, treasuryAddr) < sharesAmount) {
                report.isSafe = false;
                report.severity = AnomalySeverity.WARNING;
                report.riskScore = 50;
                report.anomalyCode = ANOMALY_INSUFFICIENT_ALLOWANCE;
                report.summary = "Aprobacion (allowance) de VIRAJE insuficiente para el contrato de Tesoreria.";
                return report;
            }
        }

        uint256 requiredUsdc = (sharesAmount * health.navPerShare) / 1e18;
        if (requiredUsdc > health.totalAssetsUSD) {
            report.isSafe = false;
            report.severity = AnomalySeverity.CRITICAL;
            report.riskScore = 90;
            report.anomalyCode = ANOMALY_INSUFFICIENT_TREASURY_LIQUIDITY;
            report.summary = "La Tesoreria no dispone de suficiente liquidez libre para este volumen de canje.";
            return report;
        }

        report.isSafe = true;
        report.severity = AnomalySeverity.NONE;
        report.riskScore = 5;
        report.summary = "Inspeccion pre-flight exitosa: Canje a NAV institucionalmente validado.";
        return report;
    }

    function _inspectBorrowViraje(
        bytes calldata data,
        address user,
        TreasuryHealthReport memory health,
        PreFlightReport memory report
    ) internal view returns (PreFlightReport memory) {
        (uint256 virajeCollateral, uint256 borrowAmount) = abi.decode(data[4:68], (uint256, uint256));
        address virajeToken = addressProvider.getVirajeToken();
        address p2pAddr = addressProvider.getP2PMarket();

        if (user != address(0) && virajeToken != address(0)) {
            if (IERC20(virajeToken).balanceOf(user) < virajeCollateral) {
                report.isSafe = false;
                report.severity = AnomalySeverity.CRITICAL;
                report.riskScore = 85;
                report.anomalyCode = ANOMALY_INSUFFICIENT_BALANCE;
                report.summary = "Saldo de colateral VIRAJE insuficiente.";
                return report;
            }
            if (IERC20(virajeToken).allowance(user, p2pAddr) < virajeCollateral) {
                report.isSafe = false;
                report.severity = AnomalySeverity.WARNING;
                report.riskScore = 50;
                report.anomalyCode = ANOMALY_INSUFFICIENT_ALLOWANCE;
                report.summary = "Falta aprobacion de gasto (allowance) de VIRAJE para P2PLendingMarket.";
                return report;
            }
        }

        // Límite de LTV Efectivo (25%: 50% Haircut * 50% Max LTV)
        uint256 collateralValueUSD = (virajeCollateral * health.navPerShare) / 1e18;
        uint256 maxBorrowAllowed = (collateralValueUSD * 2500) / 10000;
        uint256 maxBorrowAllowedUSDC = maxBorrowAllowed / 1e12; // De 18 a 6 decimales

        if (borrowAmount > maxBorrowAllowedUSDC) {
            report.isSafe = false;
            report.severity = AnomalySeverity.CRITICAL;
            report.riskScore = 90;
            report.anomalyCode = ANOMALY_MAX_LTV_EXCEEDED;
            report.summary = "El prestamo excede el 25% LTV Efectivo permitido (50% Haircut x 50% LTV).";
            return report;
        }

        uint256 proposedDebt = health.totalDebtUSD + (borrowAmount * 1e12);
        if (proposedDebt > health.maxDebtCapUSD) {
            report.isSafe = false;
            report.severity = AnomalySeverity.CRITICAL;
            report.riskScore = 95;
            report.anomalyCode = ANOMALY_DEBT_CAP_EXCEEDED;
            report.summary = "El prestamo haria superar el techo prudencial del 20% de deuda en la Tesoreria.";
            return report;
        }

        report.isSafe = true;
        report.severity = AnomalySeverity.NONE;
        report.riskScore = 10;
        report.summary = "Inspeccion pre-flight exitosa: Prestamo colateralizado con VIRAJE 100% seguro.";
        return report;
    }

    function _inspectBorrowNFT(
        bytes calldata data,
        address user,
        address p2pAddr,
        PreFlightReport memory report
    ) internal view returns (PreFlightReport memory) {
        (uint256 positionId, uint256 borrowAmount) = abi.decode(data[4:68], (uint256, uint256));
        address nftAddr = addressProvider.getAddress(keccak256("POSITION_NFT"));

        if (user != address(0) && nftAddr != address(0)) {
            IVaultPositionNFTView nft = IVaultPositionNFTView(nftAddr);
            try nft.ownerOf(positionId) returns (address owner) {
                if (owner != user) {
                    report.isSafe = false;
                    report.severity = AnomalySeverity.CRITICAL;
                    report.riskScore = 95;
                    report.anomalyCode = ANOMALY_NFT_NOT_OWNED;
                    report.summary = "El usuario no es el propietario de la posicion NFT indicada.";
                    return report;
                }
            } catch {
                report.isSafe = false;
                report.severity = AnomalySeverity.CRITICAL;
                report.riskScore = 95;
                report.anomalyCode = ANOMALY_NFT_NOT_OWNED;
                report.summary = "La posicion NFT indicada no existe.";
                return report;
            }

            bool approved = nft.isApprovedForAll(user, p2pAddr) || nft.getApproved(positionId) == p2pAddr;
            if (!approved) {
                report.isSafe = false;
                report.severity = AnomalySeverity.WARNING;
                report.riskScore = 55;
                report.anomalyCode = ANOMALY_NFT_NOT_APPROVED;
                report.summary = "Falta aprobacion ERC721 (setApprovalForAll) para custodiar la posicion NFT.";
                return report;
            }

            IVaultPositionNFTView.BondPosition memory pos = nft.getPosition(positionId);
            if (pos.isPledged || pos.claimed) {
                report.isSafe = false;
                report.severity = AnomalySeverity.CRITICAL;
                report.riskScore = 95;
                report.anomalyCode = ANOMALY_NFT_ALREADY_PLEDGED;
                report.summary = "La posicion NFT ya esta pignorada en otro prestamo o ya fue liquidada.";
                return report;
            }

            uint256 maxBorrowAllowedUSDC = (pos.discountedPrice * 2500) / 10000;
            if (borrowAmount > maxBorrowAllowedUSDC) {
                report.isSafe = false;
                report.severity = AnomalySeverity.CRITICAL;
                report.riskScore = 90;
                report.anomalyCode = ANOMALY_MAX_LTV_EXCEEDED;
                report.summary = "El importe solicitado supera el 25% LTV Efectivo de la posicion NFT.";
                return report;
            }
        }

        report.isSafe = true;
        report.severity = AnomalySeverity.NONE;
        report.riskScore = 10;
        report.summary = "Inspeccion pre-flight exitosa: Prestamo colateralizado con NFT validado.";
        return report;
    }

    // =========================================================================
    // 🔒 ENFORCEMENT ON-CHAIN (VERIFICACIÓN EN TRANSICIÓN DE ESTADO)
    // =========================================================================

    function verifyStateTransition(
        uint256 preNAVPerShare,
        uint256 postNAVPerShare,
        uint256 preCollateralRatioBps,
        uint256 postCollateralRatioBps
    ) external view override {
        if (config.isPaused) revert HypervisorPaused();
        if (!config.enforceOnChain) return;

        // Invariante 1: NAV por acción no puede descender más allá de la tolerancia de redondeo
        uint256 tolerance = (preNAVPerShare * config.navToleranceBps) / 10000;
        if (postNAVPerShare + tolerance < preNAVPerShare) {
            revert InvariantNAVDecreased(preNAVPerShare, postNAVPerShare);
        }

        // Invariante 2: Ratio de colateralización no puede caer por debajo del mínimo institucional ni descender
        if (postCollateralRatioBps < config.minCollateralRatioBps || postCollateralRatioBps < preCollateralRatioBps) {
            revert InvariantSolvencyBreached(postCollateralRatioBps, config.minCollateralRatioBps);
        }
    }
}
