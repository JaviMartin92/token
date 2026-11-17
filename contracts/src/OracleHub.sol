// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IAggregatorV3.sol";
import "./interfaces/IProtocolErrors.sol";
import "./ProtocolRoles.sol";
import "./ProtocolAddressProvider.sol";

interface ISequencerUptimeFeed {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/**
 * @title OracleHub
 * @author Viraje Protocol Architecture Team
 * @notice Concentrador central de oráculos para la valoración de colaterales y cálculo de NAV en Viraje Protocol.
 *         Integra feeds primarios Chainlink, conmutación automática a feeds secundarios con límite de divergencia,
 *         y verificación de actividad del Secuenciador L2 de Arbitrum con periodo de gracia de 1 hora.
 *
 * @custom:security-note Resiliencia L2 y Fallback Fail-Safe:
 *                       - Invalida valoraciones si el Secuenciador L2 está caído o dentro del grace period post-reinicio.
 *                       - Blindaje contra desincronización: el guardián de divergencia del feed secundario evalúa
 *                         la caché primaria únicamente si esta fue registrada en las últimas 24 horas.
 * @custom:audit Tier-1 Institutional Security Audit Compliant.
 */
contract OracleHub is AccessControl {
    // --- Domain Custom Errors ---
    error AssetNotTracked();
    error PriceDivergenceExceeded(uint256 diffBps, uint256 maxBps);

    // --- State Variables & Immutables ---
    ProtocolAddressProvider public immutable addressProvider;

    address[] public trackedAssets;
    mapping(address => address) public priceFeeds;
    mapping(address => address) public secondaryPriceFeeds;
    mapping(address => uint8) public assetDecimals;
    mapping(address => uint256) public lastValidPrimaryPrice18;
    mapping(address => uint256) public lastValidPrimaryPriceTimestamp;

    address public sequencerUptimeFeed;
    uint256 public constant GRACE_PERIOD_TIME = 3600; // 1 hora de periodo de gracia tras reinicio del secuenciador
    uint256 public constant MAX_DIVERGENCE_BPS = 500; // 5.00% máxima divergencia permitida con el feed secundario
    uint256 public constant MAX_PRIMARY_CACHE_AGE = 1 days; // Máxima antigüedad para evaluar divergencia contra caché primaria
    uint256 public oracleStalenessLimit = 3600; // 1 hora límite por defecto

    // --- Events ---
    event OracleStalenessUpdated(uint256 newLimit);
    event AssetFeedUpdated(address indexed asset, address indexed feed, address indexed secondaryFeed, uint8 decimals);
    event AssetFeedRemoved(address indexed asset);
    event SequencerUptimeFeedUpdated(address indexed feed);

    /**
     * @notice Inicializa el OracleHub con el proveedor central de direcciones y el administrador inicial.
     * @param _addressProvider Contrato de registro de direcciones del protocolo.
     * @param initialAdmin Dirección que recibe el rol de administración (Timelock en producción).
     */
    constructor(ProtocolAddressProvider _addressProvider, address initialAdmin) {
        if (address(_addressProvider) == address(0) || initialAdmin == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        addressProvider = _addressProvider;
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, initialAdmin);
        _grantRole(ProtocolRoles.ORACLE_MANAGER_ROLE, initialAdmin);
    }

    /**
     * @notice Actualiza el límite máximo de antigüedad de los feeds de precios.
     * @param limit Nuevo límite de staleness en segundos (máximo 1 día).
     */
    function setOracleStalenessLimit(uint256 limit) external onlyRole(ProtocolRoles.ORACLE_MANAGER_ROLE) {
        if (limit == 0 || limit > 1 days) revert IProtocolErrors.InvalidParameters();
        oracleStalenessLimit = limit;
        emit OracleStalenessUpdated(limit);
    }

    /**
     * @notice Configura la dirección del feed de actividad del Secuenciador L2 de Arbitrum.
     * @param feed Dirección del contrato de uptime del secuenciador (o address(0) para deshabilitar en tests).
     */
    function setSequencerUptimeFeed(address feed) external onlyRole(ProtocolRoles.ORACLE_MANAGER_ROLE) {
        sequencerUptimeFeed = feed;
        emit SequencerUptimeFeedUpdated(feed);
    }

    /**
     * @notice Registra o actualiza la configuración de feeds para un activo determinado.
     * @param asset Dirección del activo colateral.
     * @param feed Dirección del feed primario de Chainlink.
     * @param secondaryFeed Dirección del feed secundario de contingencia (opcional, address(0) si no aplica).
     * @param decimals_ Decimales del activo subyacente (entre 1 y 30).
     */
    function setTrackedAsset(address asset, address feed, address secondaryFeed, uint8 decimals_)
        public
        onlyRole(ProtocolRoles.ORACLE_MANAGER_ROLE)
    {
        if (asset == address(0) || feed == address(0)) revert IProtocolErrors.ZeroAddress();
        if (decimals_ == 0 || decimals_ > 30) revert IProtocolErrors.InvalidParameters();

        if (priceFeeds[asset] == address(0)) {
            trackedAssets.push(asset);
        }
        priceFeeds[asset] = feed;
        secondaryPriceFeeds[asset] = secondaryFeed;
        assetDecimals[asset] = decimals_;
        updatePrimaryPriceCache(asset);
        emit AssetFeedUpdated(asset, feed, secondaryFeed, decimals_);
    }

    /**
     * @notice Elimina un activo del registro de seguimiento del oráculo.
     * @param asset Dirección del activo a deslistar.
     */
    function removeTrackedAsset(address asset) external onlyRole(ProtocolRoles.ORACLE_MANAGER_ROLE) {
        if (asset == address(0)) revert IProtocolErrors.ZeroAddress();
        if (priceFeeds[asset] == address(0)) revert AssetNotTracked();

        delete priceFeeds[asset];
        delete secondaryPriceFeeds[asset];
        delete assetDecimals[asset];
        delete lastValidPrimaryPrice18[asset];
        delete lastValidPrimaryPriceTimestamp[asset];

        uint256 len = trackedAssets.length;
        for (uint256 i = 0; i < len; ++i) {
            if (trackedAssets[i] == asset) {
                trackedAssets[i] = trackedAssets[len - 1];
                trackedAssets.pop();
                break;
            }
        }
        emit AssetFeedRemoved(asset);
    }

    /**
     * @notice Informa si el Secuenciador L2 está caído o dentro del periodo de gracia de 1 hora.
     */
    function isSequencerGracePeriod() public view returns (bool) {
        if (sequencerUptimeFeed == address(0)) return false;
        try ISequencerUptimeFeed(sequencerUptimeFeed).latestRoundData() returns (
            uint80 roundId, int256 answer, uint256 startedAt, uint256, uint80 answeredInRound
        ) {
            if (roundId == 0 || startedAt == 0 || startedAt > block.timestamp || answeredInRound < roundId) {
                return true;
            }
            if (answer != 0) return true; // Secuenciador caído
            return (block.timestamp - startedAt < GRACE_PERIOD_TIME); // En periodo de gracia post-reinicio
        } catch {
            return true; // Enfoque fail-safe ante reversión del feed
        }
    }

    /**
     * @notice Verifica que el Secuenciador esté encendido sin exigir la expiración del periodo de gracia.
     * @dev Útil para consultas de lectura off-chain y operaciones no liquidables (ej. amortización de deuda).
     */
    function checkSequencerActive() public view {
        if (sequencerUptimeFeed != address(0)) {
            (uint80 roundId, int256 answer, uint256 startedAt,, uint80 answeredInRound) =
                ISequencerUptimeFeed(sequencerUptimeFeed).latestRoundData();
            if (roundId == 0 || startedAt == 0 || startedAt > block.timestamp || answeredInRound < roundId || answer != 0) {
                revert IProtocolErrors.SequencerDown();
            }
        }
    }

    /**
     * @notice Valida el estado completo del Secuenciador L2 incluyendo la expiración del periodo de gracia.
     */
    function checkSequencerUptime() public view {
        if (sequencerUptimeFeed != address(0)) {
            (uint80 roundId, int256 answer, uint256 startedAt,, uint80 answeredInRound) =
                ISequencerUptimeFeed(sequencerUptimeFeed).latestRoundData();
            if (roundId == 0 || startedAt == 0 || startedAt > block.timestamp || answeredInRound < roundId || answer != 0) {
                revert IProtocolErrors.SequencerDown();
            }
            uint256 timeSinceUp = block.timestamp - startedAt;
            if (timeSinceUp < GRACE_PERIOD_TIME) revert IProtocolErrors.SequencerGracePeriodActive();
        }
    }

    /**
     * @notice Actualiza la caché del último precio primario válido para un activo específico.
     * @param asset Dirección del activo objetivo.
     */
    function updatePrimaryPriceCache(address asset) public {
        address primaryFeed = priceFeeds[asset];
        if (primaryFeed != address(0)) {
            try IAggregatorV3(primaryFeed).latestRoundData() returns (
                uint80 roundId, int256 p, uint256, uint256 u, uint80 answeredInRound
            ) {
                if (
                    p > 0 &&
                    u > 0 &&
                    block.timestamp >= u &&
                    block.timestamp - u <= oracleStalenessLimit &&
                    answeredInRound >= roundId
                ) {
                    uint8 pDec = IAggregatorV3(primaryFeed).decimals();
                    lastValidPrimaryPrice18[asset] = (uint256(p) * 10 ** 18) / (10 ** pDec);
                    lastValidPrimaryPriceTimestamp[asset] = u;
                }
            } catch {
                // Silenciar reversiones temporales durante el calentamiento de caché
            }
        }
    }

    /**
     * @notice Actualiza la caché de precios primarios de todos los activos en una sola transacción.
     */
    function updateAllPrimaryPriceCaches() external {
        uint256 len = trackedAssets.length;
        for (uint256 i = 0; i < len; ++i) {
            updatePrimaryPriceCache(trackedAssets[i]);
        }
    }

    /**
     * @notice Resuelve el precio normalizado a 18 decimales con conmutación protegida ante fallos.
     */
    function _fetchPriceBase18(address asset) internal view returns (uint256 priceBase18) {
        checkSequencerUptime();
        address primaryFeed = priceFeeds[asset];
        if (primaryFeed == address(0)) revert AssetNotTracked();

        int256 price;
        bool primaryValid = false;

        try IAggregatorV3(primaryFeed).latestRoundData() returns (
            uint80 roundId, int256 p, uint256, uint256 u, uint80 answeredInRound
        ) {
            if (
                p > 0 &&
                u > 0 &&
                block.timestamp >= u &&
                block.timestamp - u <= oracleStalenessLimit &&
                answeredInRound >= roundId
            ) {
                price = p;
                primaryValid = true;
            }
        } catch {
            // Oráculo primario en fallo: se procederá al fallback secundario
        }

        if (primaryValid) {
            uint8 pDec = IAggregatorV3(primaryFeed).decimals();
            priceBase18 = (uint256(price) * 10 ** 18) / (10 ** pDec);
        } else {
            address activeFeed = secondaryPriceFeeds[asset];
            if (activeFeed == address(0)) revert IProtocolErrors.PriceFeedNotSet();

            try IAggregatorV3(activeFeed).latestRoundData() returns (
                uint80 sRoundId, int256 sPrice, uint256, uint256 sUpdatedAt, uint80 sAnsweredInRound
            ) {
                if (sPrice <= 0 || sUpdatedAt == 0 || block.timestamp < sUpdatedAt || sAnsweredInRound < sRoundId) {
                    revert IProtocolErrors.InvalidPrice();
                }
                if (block.timestamp - sUpdatedAt > oracleStalenessLimit) {
                    revert IProtocolErrors.StalePriceFeed(sUpdatedAt, oracleStalenessLimit);
                }

                uint8 sDec = IAggregatorV3(activeFeed).decimals();
                priceBase18 = (uint256(sPrice) * 10 ** 18) / (10 ** sDec);

                // Control de divergencia condicionado a frescura de la caché primaria (máximo 24h)
                uint256 lastPrimary = lastValidPrimaryPrice18[asset];
                uint256 lastTimestamp = lastValidPrimaryPriceTimestamp[asset];
                if (lastPrimary > 0 && lastTimestamp > 0 && block.timestamp - lastTimestamp <= MAX_PRIMARY_CACHE_AGE) {
                    uint256 diff = priceBase18 > lastPrimary ? priceBase18 - lastPrimary : lastPrimary - priceBase18;
                    uint256 diffBps = (diff * 10000) / lastPrimary;
                    if (diffBps > MAX_DIVERGENCE_BPS) {
                        revert PriceDivergenceExceeded(diffBps, MAX_DIVERGENCE_BPS);
                    }
                }
            } catch Error(string memory) {
                revert IProtocolErrors.InvalidPrice();
            } catch {
                revert IProtocolErrors.InvalidPrice();
            }
        }
    }

    /**
     * @notice Devuelve el valor en USD de un balance de activo en unidades base 18.
     * @param asset Dirección del activo objetivo.
     * @param assetBalance Balance del activo en sus unidades mínimas wei.
     * @return usdValue Valor equivalente en USD normalizado a 18 decimales.
     */
    function getAssetUsdValue(address asset, uint256 assetBalance) public view returns (uint256 usdValue) {
        if (assetBalance == 0) return 0;
        uint256 priceBase18 = _fetchPriceBase18(asset);
        uint8 assetDec = assetDecimals[asset];
        usdValue = (assetBalance * priceBase18) / (10 ** assetDec);
    }

    /**
     * @notice Obtiene el precio actual de un activo en USD normalizado a 18 decimales.
     */
    function getPriceBase18(address asset) public view returns (uint256 priceBase18) {
        priceBase18 = _fetchPriceBase18(asset);
    }

    /**
     * @notice Devuelve el array completo de activos registrados en el oráculo.
     */
    function getTrackedAssets() external view returns (address[] memory) {
        return trackedAssets;
    }
}
