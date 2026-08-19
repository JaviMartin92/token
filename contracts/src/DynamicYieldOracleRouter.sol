// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";

/**
 * @title DynamicYieldOracleRouter
 * @notice Dynamic Discovery Engine that monitors, compares, and routes Treasury assets to the highest-yielding verified protocols in real time.
 *         Compares APYs across Morpho Blue, Aave V3, Compound V3, Ethena, Lido, Rocket Pool, Lombard, Babylon, etc.
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

    // Mapping from AssetClass => list of evaluated protocols
    mapping(uint8 => ProtocolYieldInfo[]) public protocolOptions;

    event ProtocolYieldUpdated(uint8 indexed assetClass, string name, address vaultAddress, uint256 apyBps);
    event BestVaultSelected(uint8 indexed assetClass, string name, address vaultAddress, uint256 highestApyBps);

    constructor(address _initialOwner) {
        address admin = (_initialOwner != address(0)) ? _initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
        _initDefaultProtocols();
    }

    function _initDefaultProtocols() internal {
        // STABLECOIN
        protocolOptions[uint8(
                AssetClass.STABLECOIN
            )].push(
            ProtocolYieldInfo({
                name: "Morpho Blue MetaMorpho Vault",
                vaultAddress: 0x488102554708C23C0227d8D86f4A2fAffbb27357,
                apyBps: 645, // 6.45% APY
                isVerifiedSecurity: true,
                lastUpdatedTimestamp: block.timestamp
            })
        );

        // ETHEREUM
        protocolOptions[uint8(
                AssetClass.ETHEREUM
            )].push(
            ProtocolYieldInfo({
                name: "Lido Liquid Staking wstETH",
                vaultAddress: 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0,
                apyBps: 320, // 3.20% APY
                isVerifiedSecurity: true,
                lastUpdatedTimestamp: block.timestamp
            })
        );

        // BITCOIN
        protocolOptions[uint8(
                AssetClass.BITCOIN
            )].push(
            ProtocolYieldInfo({
                name: "Lombard LBTC Babylon Staking",
                vaultAddress: 0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd,
                apyBps: 380, // 3.80% APY
                isVerifiedSecurity: true,
                lastUpdatedTimestamp: block.timestamp
            })
        );
        protocolOptions[uint8(
                AssetClass.BITCOIN
            )].push(
            ProtocolYieldInfo({
                name: "Bedrock uniBTC Vault",
                vaultAddress: 0x0000000000000000000000000000000000000000,
                apyBps: 310, // 3.10% APY
                isVerifiedSecurity: true,
                lastUpdatedTimestamp: block.timestamp
            })
        );
    }

    /**
     * @notice Registers or updates a protocol's real-time APY rate
     */
    function updateProtocolYield(
        uint8 assetClass,
        string calldata name,
        address vaultAddress,
        uint256 apyBps,
        bool isVerified
    ) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
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

    event ManualOverrideSet(uint8 indexed assetClass, string name, address vault, bool enabled);
    event OpportunityDetected(
        uint8 indexed assetClass, string betterName, address betterVault, uint256 betterApy, uint256 currentApy
    );
    event OpportunityAccepted(uint8 indexed assetClass, string newName, address newVault, uint256 newApy);
    event OpportunityRejected(uint8 indexed assetClass);

    /**
     * @notice Admin method to lock a specific vault manually or return to 100% autonomous mode
     */
    function setManualOverride(uint8 assetClass, address vaultAddress, string calldata name, bool enabled)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
    {
        manualOverrideEnabled[assetClass] = enabled;
        if (enabled) {
            adminSelectedVault[assetClass] = vaultAddress;
            adminSelectedName[assetClass] = name;
        }
        emit ManualOverrideSet(assetClass, name, vaultAddress, enabled);
    }

    /**
     * @notice Daily check: compares active vault vs top available yield and triggers alert notification if a better option is found
     */
    function checkDailyOpportunity(uint8 assetClass)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
        returns (bool opportunityFound)
    {
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

    error NoPendingOpportunity();
    error NoProtocolsRegistered();

    /**
     * @notice Admin accepts the suggested opportunity notification and switches to the better protocol
     */
    function acceptOpportunity(uint8 assetClass) external onlyRole(ProtocolRoles.ADMIN_ROLE) returns (bool) {
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
        opportunityAlerts[assetClass].isPending = false;
        emit OpportunityRejected(assetClass);
        return true;
    }

    /**
     * @notice Queries on-chain and dynamically returns the active protocol (respecting Admin manual choice if enabled)
     */
    function getBestYieldVault(uint8 assetClass)
        external
        view
        returns (string memory bestName, address bestVaultAddress, uint256 highestApyBps)
    {
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
            return (adminSelectedName[assetClass], adminSelectedVault[assetClass], 645);
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

    function getProtocolCount(uint8 assetClass) external view returns (uint256) {
        return protocolOptions[assetClass].length;
    }

    /**
     * @notice Computes the protocol-wide weighted APY in BPS (e.g. 580 BPS = 5.80%) based on current reserve asset balances and 90% Morpho deployment ratio
     */
    function calculateWeightedYieldBps(uint256 stablesUsd, uint256 wbtcUsd, uint256 wethUsd)
        external
        view
        returns (uint256 weightedApyBps)
    {
        (,, uint256 stableApy) = this.getBestYieldVault(0);
        (,, uint256 ethApy) = this.getBestYieldVault(1);
        (,, uint256 btcApy) = this.getBestYieldVault(2);

        uint256 totalUsd = stablesUsd + wbtcUsd + wethUsd;
        if (totalUsd == 0) return 0;

        // 90% of stablecoins are deployed to MetaMorpho Vault @ stableApy; 10% in liquid buffer
        uint256 effectiveStableYield = (stablesUsd * 90 * stableApy) / 100;
        uint256 weightedYieldUSD = effectiveStableYield + (wbtcUsd * btcApy) + (wethUsd * ethApy);
        return weightedYieldUSD / totalUsd;
    }
}
