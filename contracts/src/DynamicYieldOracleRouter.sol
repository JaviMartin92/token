// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title DynamicYieldOracleRouter
 * @author Alpha Centauri Architecture Team
 * @notice Dynamic Discovery Engine that monitors, compares, and routes Treasury assets
 *         to the highest-yielding verified protocols in real time (e.g. Morpho Blue, Aave V3,
 *         Lido, Lombard, Babylon).
 * @dev Enforces conservative Sanity Bounds to reject abnormal yield reporting, protecting
 *      the protocol from economic manipulation or oracle failure.
 */
contract DynamicYieldOracleRouter is AccessControl {
    enum AssetClass {
        STABLECOIN,
        ETHEREUM,
        BITCOIN
    }

    struct ProtocolYieldInfo {
        string name;
        address vaultAddress;
        bool isVerifiedSecurity;
        uint256 apyBps; // e.g. 645 Bps = 6.45% APY
        uint256 lastUpdatedTimestamp;
    }

    // --- Custom Errors ---
    error YieldRateOutOfBounds(uint8 assetClass, uint256 apyBps, uint256 minBps, uint256 maxBps);
    error InvalidSanityBounds();
    error NoPendingOpportunity();
    error NoProtocolsRegistered();
    error ProtocolNotFound();

    struct SanityBounds {
        uint256 minApyBps;
        uint256 maxApyBps;
    }

    // Mapping from AssetClass => min/max allowed APY in BPS (Sanity Bounds)
    mapping(uint8 => SanityBounds) public sanityBounds;

    // Mapping from AssetClass => list of evaluated protocols
    mapping(uint8 => ProtocolYieldInfo[]) public protocolOptions;

    // Constants
    uint256 public constant MAX_SANITY_APY_BPS = 5000; // 50.00% max plausible institutional yield
    uint256 public constant DEPLOYED_STABLE_RATIO_BPS = 9000; // 90% deployed to yield; 10% in buffer

    // Events
    event ProtocolYieldUpdated(uint8 indexed assetClass, string name, address vaultAddress, uint256 apyBps);
    event BestVaultSelected(uint8 indexed assetClass, string name, address vaultAddress, uint256 highestApyBps);
    event SanityBoundsUpdated(uint8 indexed assetClass, uint256 minApyBps, uint256 maxApyBps);
    event ManualOverrideSet(uint8 indexed assetClass, string name, address vault, bool enabled);
    event OpportunityDetected(
        uint8 indexed assetClass, string betterName, address betterVault, uint256 betterApy, uint256 currentApy
    );
    event OpportunityAccepted(uint8 indexed assetClass, string newName, address newVault, uint256 newApy);
    event OpportunityRejected(uint8 indexed assetClass);

    // Admin Override & Opportunity Notification State
    mapping(uint8 => bool) public manualOverrideEnabled;
    mapping(uint8 => address) public adminSelectedVault;
    mapping(uint8 => string) public adminSelectedName;

    struct OpportunityAlert {
        string betterName;
        address betterVault;
        bool isPending;
        uint256 betterApyBps;
        uint256 currentApyBps;
    }

    mapping(uint8 => OpportunityAlert) public opportunityAlerts;

    /**
     * @notice Initializes the router with governance roles and default protocol baselines
     * @param _initialOwner Governance timelock or admin address
     */
    constructor(address _initialOwner) {
        if (_initialOwner == address(0)) revert IProtocolErrors.ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialOwner);

        // Conservative Sanity Bounds (Protocol Survival Baseline)
        sanityBounds[uint8(AssetClass.STABLECOIN)] = SanityBounds({minApyBps: 100, maxApyBps: 1500}); // 1.00% - 15.00%
        sanityBounds[uint8(AssetClass.ETHEREUM)] = SanityBounds({minApyBps: 100, maxApyBps: 800});   // 1.00% - 8.00%
        sanityBounds[uint8(AssetClass.BITCOIN)] = SanityBounds({minApyBps: 50, maxApyBps: 800});     // 0.50% - 8.00%

        _initDefaultProtocols();
    }

    /**
     * @notice Updates the conservative sanity bounds for an asset class
     * @param assetClass 0 = Stablecoin, 1 = Ethereum, 2 = Bitcoin
     * @param minApyBps Lower bound in basis points
     * @param maxApyBps Upper bound in basis points
     */
    function setSanityBounds(uint8 assetClass, uint256 minApyBps, uint256 maxApyBps)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
    {
        if (assetClass > uint8(AssetClass.BITCOIN)) revert IProtocolErrors.InvalidParameters();
        if (minApyBps > maxApyBps || maxApyBps > MAX_SANITY_APY_BPS) revert InvalidSanityBounds();
        sanityBounds[assetClass] = SanityBounds({minApyBps: minApyBps, maxApyBps: maxApyBps});
        emit SanityBoundsUpdated(assetClass, minApyBps, maxApyBps);
    }

    function _initDefaultProtocols() internal {
        // STABLECOIN
        protocolOptions[uint8(AssetClass.STABLECOIN)].push(
            ProtocolYieldInfo({
                name: "Morpho Blue MetaMorpho Vault",
                vaultAddress: 0x488102554708C23C0227d8D86f4A2fAffbb27357,
                apyBps: 645, // 6.45% APY
                isVerifiedSecurity: true,
                lastUpdatedTimestamp: block.timestamp
            })
        );

        // ETHEREUM
        protocolOptions[uint8(AssetClass.ETHEREUM)].push(
            ProtocolYieldInfo({
                name: "Lido Liquid Staking wstETH",
                vaultAddress: 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0,
                apyBps: 320, // 3.20% APY
                isVerifiedSecurity: true,
                lastUpdatedTimestamp: block.timestamp
            })
        );

        // BITCOIN
        protocolOptions[uint8(AssetClass.BITCOIN)].push(
            ProtocolYieldInfo({
                name: "Lombard LBTC Babylon Staking",
                vaultAddress: 0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd,
                apyBps: 380, // 3.80% APY
                isVerifiedSecurity: true,
                lastUpdatedTimestamp: block.timestamp
            })
        );
        protocolOptions[uint8(AssetClass.BITCOIN)].push(
            ProtocolYieldInfo({
                name: "Bedrock uniBTC Vault",
                vaultAddress: 0x0000000000000000000000000000000000000001,
                apyBps: 310, // 3.10% APY
                isVerifiedSecurity: true,
                lastUpdatedTimestamp: block.timestamp
            })
        );
    }

    /**
     * @notice Registers or updates a protocol's real-time APY rate
     * @param assetClass Asset class index
     * @param name Descriptive protocol name
     * @param vaultAddress On-chain vault/adapter address
     * @param apyBps APY in basis points
     * @param isVerified Security verification flag
     */
    function updateProtocolYield(
        uint8 assetClass,
        string calldata name,
        address vaultAddress,
        uint256 apyBps,
        bool isVerified
    ) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (assetClass > uint8(AssetClass.BITCOIN)) revert IProtocolErrors.InvalidParameters();
        if (vaultAddress == address(0)) revert IProtocolErrors.ZeroAddress();

        SanityBounds memory bounds = sanityBounds[assetClass];
        if (bounds.maxApyBps > 0) {
            if (apyBps < bounds.minApyBps || apyBps > bounds.maxApyBps) {
                revert YieldRateOutOfBounds(assetClass, apyBps, bounds.minApyBps, bounds.maxApyBps);
            }
        }

        ProtocolYieldInfo[] storage list = protocolOptions[assetClass];
        bool found = false;

        for (uint256 i = 0; i < list.length;) {
            if (keccak256(bytes(list[i].name)) == keccak256(bytes(name)) || list[i].vaultAddress == vaultAddress) {
                list[i].apyBps = apyBps;
                list[i].isVerifiedSecurity = isVerified;
                list[i].lastUpdatedTimestamp = block.timestamp;
                found = true;
                break;
            }
            unchecked {
                ++i;
            }
        }

        if (!found) {
            list.push(
                ProtocolYieldInfo({
                    name: name,
                    vaultAddress: vaultAddress,
                    apyBps: apyBps,
                    isVerifiedSecurity: isVerified,
                    lastUpdatedTimestamp: block.timestamp
                })
            );
        }

        emit ProtocolYieldUpdated(assetClass, name, vaultAddress, apyBps);
    }

    /**
     * @notice Admin method to lock a specific vault manually or return to 100% autonomous mode
     * @param assetClass Asset class index
     * @param vaultAddress Selected vault address
     * @param name Descriptive name of the vault
     * @param enabled True to enable manual override, false for autonomous routing
     */
    function setManualOverride(uint8 assetClass, address vaultAddress, string calldata name, bool enabled)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
    {
        if (assetClass > uint8(AssetClass.BITCOIN)) revert IProtocolErrors.InvalidParameters();
        if (enabled && vaultAddress == address(0)) revert IProtocolErrors.ZeroAddress();

        manualOverrideEnabled[assetClass] = enabled;
        if (enabled) {
            adminSelectedVault[assetClass] = vaultAddress;
            adminSelectedName[assetClass] = name;
        }
        emit ManualOverrideSet(assetClass, name, vaultAddress, enabled);
    }

    /**
     * @notice Daily check: compares active vault vs top available yield and triggers alert notification if a better option is found
     * @param assetClass Asset class index
     */
    function checkDailyOpportunity(uint8 assetClass)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
        returns (bool opportunityFound)
    {
        if (assetClass > uint8(AssetClass.BITCOIN)) revert IProtocolErrors.InvalidParameters();
        ProtocolYieldInfo[] storage list = protocolOptions[assetClass];
        uint256 len = list.length;
        if (len == 0) return false;

        uint256 maxApy = 0;
        uint256 bestIndex = 0;
        for (uint256 i = 0; i < len;) {
            if (list[i].isVerifiedSecurity && list[i].apyBps > maxApy) {
                maxApy = list[i].apyBps;
                bestIndex = i;
            }
            unchecked {
                ++i;
            }
        }

        uint256 currentApy = 0;
        if (manualOverrideEnabled[assetClass]) {
            for (uint256 i = 0; i < len;) {
                if (list[i].vaultAddress == adminSelectedVault[assetClass]) {
                    currentApy = list[i].apyBps;
                    break;
                }
                unchecked {
                    ++i;
                }
            }
        } else {
            currentApy = maxApy;
        }

        if (maxApy > currentApy) {
            opportunityAlerts[assetClass] = OpportunityAlert({
                isPending: true,
                betterName: list[bestIndex].name,
                betterVault: list[bestIndex].vaultAddress,
                betterApyBps: maxApy,
                currentApyBps: currentApy
            });
            emit OpportunityDetected(assetClass, list[bestIndex].name, list[bestIndex].vaultAddress, maxApy, currentApy);
            return true;
        }
        return false;
    }

    /**
     * @notice Admin accepts the suggested opportunity notification and switches to the better protocol
     */
    function acceptOpportunity(uint8 assetClass) external onlyRole(ProtocolRoles.ADMIN_ROLE) returns (bool) {
        if (assetClass > uint8(AssetClass.BITCOIN)) revert IProtocolErrors.InvalidParameters();
        OpportunityAlert storage alert = opportunityAlerts[assetClass];
        if (!alert.isPending) revert NoPendingOpportunity();

        adminSelectedVault[assetClass] = alert.betterVault;
        adminSelectedName[assetClass] = alert.betterName;
        manualOverrideEnabled[assetClass] = true;
        alert.isPending = false;

        emit OpportunityAccepted(assetClass, alert.betterName, alert.betterVault, alert.betterApyBps);
        return true;
    }

    /**
     * @notice Admin rejects the suggested opportunity notification and keeps the current selection
     */
    function rejectOpportunity(uint8 assetClass) external onlyRole(ProtocolRoles.ADMIN_ROLE) returns (bool) {
        if (assetClass > uint8(AssetClass.BITCOIN)) revert IProtocolErrors.InvalidParameters();
        opportunityAlerts[assetClass].isPending = false;
        emit OpportunityRejected(assetClass);
        return true;
    }

    /**
     * @notice Queries on-chain and dynamically returns the active protocol (respecting Admin manual choice if enabled)
     * @param assetClass Asset class index
     * @return bestName Name of the chosen protocol
     * @return bestVaultAddress Vault contract address
     * @return highestApyBps Reported APY in basis points
     */
    function getBestYieldVault(uint8 assetClass)
        public
        view
        returns (string memory bestName, address bestVaultAddress, uint256 highestApyBps)
    {
        if (assetClass > uint8(AssetClass.BITCOIN)) revert IProtocolErrors.InvalidParameters();
        ProtocolYieldInfo[] storage list = protocolOptions[assetClass];
        uint256 len = list.length;

        if (manualOverrideEnabled[assetClass] && adminSelectedVault[assetClass] != address(0)) {
            for (uint256 i = 0; i < len;) {
                if (list[i].vaultAddress == adminSelectedVault[assetClass]) {
                    return (list[i].name, list[i].vaultAddress, list[i].apyBps);
                }
                unchecked {
                    ++i;
                }
            }
            // If manual vault is registered with custom name, return it with minimum baseline
            SanityBounds memory bounds = sanityBounds[assetClass];
            uint256 baselineApy = bounds.minApyBps > 0 ? bounds.minApyBps : 100;
            return (adminSelectedName[assetClass], adminSelectedVault[assetClass], baselineApy);
        }

        if (len == 0) revert NoProtocolsRegistered();

        uint256 maxApy = 0;
        uint256 bestIndex = 0;

        for (uint256 i = 0; i < len;) {
            if (list[i].isVerifiedSecurity && list[i].apyBps > maxApy) {
                maxApy = list[i].apyBps;
                bestIndex = i;
            }
            unchecked {
                ++i;
            }
        }

        bestName = list[bestIndex].name;
        bestVaultAddress = list[bestIndex].vaultAddress;
        highestApyBps = list[bestIndex].apyBps;
    }

    /**
     * @notice Returns total number of registered protocols for an asset class
     */
    function getProtocolCount(uint8 assetClass) external view returns (uint256) {
        if (assetClass > uint8(AssetClass.BITCOIN)) revert IProtocolErrors.InvalidParameters();
        return protocolOptions[assetClass].length;
    }

    /**
     * @notice Computes the protocol-wide weighted APY in BPS based on reserve asset balances
     * @param stablesUsd Total stablecoin reserves in USD (18 decimals)
     * @param wbtcUsd Total Bitcoin reserves in USD (18 decimals)
     * @param wethUsd Total Ethereum reserves in USD (18 decimals)
     * @return weightedApyBps Weighted protocol APY in basis points
     */
    function calculateWeightedYieldBps(uint256 stablesUsd, uint256 wbtcUsd, uint256 wethUsd)
        external
        view
        returns (uint256 weightedApyBps)
    {
        (,, uint256 stableApy) = getBestYieldVault(0);
        (,, uint256 ethApy) = getBestYieldVault(1);
        (,, uint256 btcApy) = getBestYieldVault(2);

        uint256 totalUsd = stablesUsd + wbtcUsd + wethUsd;
        if (totalUsd == 0) return 0;

        // 90% of stablecoins are deployed to yield (e.g. MetaMorpho Vault); 10% in liquid buffer
        uint256 effectiveStableYield = (stablesUsd * DEPLOYED_STABLE_RATIO_BPS * stableApy) / (10000 * 100);
        uint256 weightedYieldUSD = (effectiveStableYield * 100) + (wbtcUsd * btcApy) + (wethUsd * ethApy);
        return weightedYieldUSD / totalUsd;
    }
}
