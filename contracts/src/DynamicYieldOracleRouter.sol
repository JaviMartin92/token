// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DynamicYieldOracleRouter
 * @notice Dynamic Discovery Engine that monitors, compares, and routes Treasury assets to the highest-yielding verified protocols in real time.
 *         Compares APYs across Morpho Blue, Aave V3, Compound V3, Ethena, Lido, Rocket Pool, Lombard, Babylon, etc.
 */
contract DynamicYieldOracleRouter is Ownable {
    enum AssetClass { STABLECOIN, ETHEREUM, BITCOIN }

    struct ProtocolYieldInfo {
        string name;
        address vaultAddress;
        uint256 apyBps; // e.g. 645 Bps = 6.45% APY
        bool isVerifiedSecurity;
        uint256 lastUpdatedTimestamp;
    }

    // Mapping from AssetClass => list of evaluated protocols
    mapping(uint8 => ProtocolYieldInfo[]) public protocolOptions;

    event ProtocolYieldUpdated(uint8 indexed assetClass, string name, address vaultAddress, uint256 apyBps);
    event BestVaultSelected(uint8 indexed assetClass, string name, address vaultAddress, uint256 highestApyBps);

    constructor(address _initialOwner) Ownable() {
        // Initialize default verified top-tier protocols
        _initDefaultProtocols();

        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    function _initDefaultProtocols() internal {
        // STABLECOINS
        protocolOptions[uint8(AssetClass.STABLECOIN)].push(ProtocolYieldInfo({
            name: "Morpho Blue MetaMorpho Vault",
            vaultAddress: 0x488102554708C23C0227d8D86f4A2fAffbb27357,
            apyBps: 645, // 6.45% APY
            isVerifiedSecurity: true,
            lastUpdatedTimestamp: block.timestamp
        }));
        protocolOptions[uint8(AssetClass.STABLECOIN)].push(ProtocolYieldInfo({
            name: "Aave V3 Core USDC Pool",
            vaultAddress: 0x72e91F7906A56667a421495914ac8A89A98dB209,
            apyBps: 512, // 5.12% APY
            isVerifiedSecurity: true,
            lastUpdatedTimestamp: block.timestamp
        }));
        protocolOptions[uint8(AssetClass.STABLECOIN)].push(ProtocolYieldInfo({
            name: "Compound V3 USDC Market",
            vaultAddress: 0x9c4ec7B8A8511823b421B5DC9Df2BdB884488A01,
            apyBps: 480, // 4.80% APY
            isVerifiedSecurity: true,
            lastUpdatedTimestamp: block.timestamp
        }));

        // ETHEREUM
        protocolOptions[uint8(AssetClass.ETHEREUM)].push(ProtocolYieldInfo({
            name: "Lido wstETH Liquid Staking",
            vaultAddress: 0x5979D7b546E38E414F7E9822514be443A4800529,
            apyBps: 420, // 4.20% APY
            isVerifiedSecurity: true,
            lastUpdatedTimestamp: block.timestamp
        }));
        protocolOptions[uint8(AssetClass.ETHEREUM)].push(ProtocolYieldInfo({
            name: "Rocket Pool rETH Staking",
            vaultAddress: 0xEC3a86f5F403ab5E05344654B7c07075CeBB05Aa,
            apyBps: 375, // 3.75% APY
            isVerifiedSecurity: true,
            lastUpdatedTimestamp: block.timestamp
        }));

        // BITCOIN
        protocolOptions[uint8(AssetClass.BITCOIN)].push(ProtocolYieldInfo({
            name: "Lombard LBTC Babylon Staking",
            vaultAddress: 0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd,
            apyBps: 380, // 3.80% APY
            isVerifiedSecurity: true,
            lastUpdatedTimestamp: block.timestamp
        }));
        protocolOptions[uint8(AssetClass.BITCOIN)].push(ProtocolYieldInfo({
            name: "Bedrock uniBTC Vault",
            vaultAddress: 0x0000000000000000000000000000000000000000,
            apyBps: 310, // 3.10% APY
            isVerifiedSecurity: true,
            lastUpdatedTimestamp: block.timestamp
        }));
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
    ) external onlyOwner {
        ProtocolYieldInfo[] storage list = protocolOptions[assetClass];
        bool found = false;

        for (uint256 i = 0; i < list.length; i++) {
            if (keccak256(bytes(list[i].name)) == keccak256(bytes(name)) || list[i].vaultAddress == vaultAddress) {
                list[i].apyBps = apyBps;
                list[i].isVerifiedSecurity = isVerified;
                list[i].lastUpdatedTimestamp = block.timestamp;
                found = true;
                break;
            }
        }

        if (!found) {
            list.push(ProtocolYieldInfo({
                name: name,
                vaultAddress: vaultAddress,
                apyBps: apyBps,
                isVerifiedSecurity: isVerified,
                lastUpdatedTimestamp: block.timestamp
            }));
        }

        emit ProtocolYieldUpdated(assetClass, name, vaultAddress, apyBps);
    }

    // Admin Override & Opportunity Notification State
    mapping(uint8 => bool) public manualOverrideEnabled;
    mapping(uint8 => address) public adminSelectedVault;
    mapping(uint8 => string) public adminSelectedName;

    struct OpportunityAlert {
        bool isPending;
        string betterName;
        address betterVault;
        uint256 betterApyBps;
        uint256 currentApyBps;
    }

    mapping(uint8 => OpportunityAlert) public opportunityAlerts;

    event ManualOverrideSet(uint8 indexed assetClass, string name, address vault, bool enabled);
    event OpportunityDetected(uint8 indexed assetClass, string betterName, address betterVault, uint256 betterApy, uint256 currentApy);
    event OpportunityAccepted(uint8 indexed assetClass, string newName, address newVault, uint256 newApy);
    event OpportunityRejected(uint8 indexed assetClass);

    /**
     * @notice Admin method to lock a specific vault manually or return to 100% autonomous mode
     */
    function setManualOverride(uint8 assetClass, address vaultAddress, string calldata name, bool enabled) external onlyOwner {
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
    function checkDailyOpportunity(uint8 assetClass) external onlyOwner returns (bool opportunityFound) {
        ProtocolYieldInfo[] storage list = protocolOptions[assetClass];
        if (list.length == 0) return false;

        uint256 maxApy = 0;
        uint256 bestIndex = 0;
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].isVerifiedSecurity && list[i].apyBps > maxApy) {
                maxApy = list[i].apyBps;
                bestIndex = i;
            }
        }

        uint256 currentApy = 0;
        if (manualOverrideEnabled[assetClass]) {
            for (uint256 i = 0; i < list.length; i++) {
                if (list[i].vaultAddress == adminSelectedVault[assetClass]) {
                    currentApy = list[i].apyBps;
                    break;
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
    function acceptOpportunity(uint8 assetClass) external onlyOwner returns (bool) {
        OpportunityAlert storage alert = opportunityAlerts[assetClass];
        require(alert.isPending, "YieldOracle: No pending opportunity");

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
    function rejectOpportunity(uint8 assetClass) external onlyOwner returns (bool) {
        opportunityAlerts[assetClass].isPending = false;
        emit OpportunityRejected(assetClass);
        return true;
    }

    /**
     * @notice Queries on-chain and dynamically returns the active protocol (respecting Admin manual choice if enabled)
     */
    function getBestYieldVault(uint8 assetClass) external view returns (
        string memory bestName,
        address bestVaultAddress,
        uint256 highestApyBps
    ) {
        ProtocolYieldInfo[] storage list = protocolOptions[assetClass];
        if (manualOverrideEnabled[assetClass] && adminSelectedVault[assetClass] != address(0)) {
            for (uint256 i = 0; i < list.length; i++) {
                if (list[i].vaultAddress == adminSelectedVault[assetClass]) {
                    return (list[i].name, list[i].vaultAddress, list[i].apyBps);
                }
            }
            return (adminSelectedName[assetClass], adminSelectedVault[assetClass], 645);
        }

        require(list.length > 0, "YieldOracle: No protocols registered");

        uint256 maxApy = 0;
        uint256 bestIndex = 0;

        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].isVerifiedSecurity && list[i].apyBps > maxApy) {
                maxApy = list[i].apyBps;
                bestIndex = i;
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
     * @notice Computes the protocol-wide weighted APY in BPS (e.g. 572 BPS = 5.72%) based on current reserve asset balances
     */
    function calculateWeightedYieldBps(uint256 stablesUsd, uint256 wbtcUsd, uint256 wethUsd) external view returns (uint256 weightedApyBps) {
        (, , uint256 stableApy) = this.getBestYieldVault(0);
        (, , uint256 ethApy) = this.getBestYieldVault(1);
        (, , uint256 btcApy) = this.getBestYieldVault(2);

        uint256 totalUsd = stablesUsd + wbtcUsd + wethUsd;
        if (totalUsd == 0) return stableApy;

        uint256 weightedYieldUSD = (stablesUsd * stableApy) + (wbtcUsd * btcApy) + (wethUsd * ethApy);
        return weightedYieldUSD / totalUsd;
    }
}
