// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import "../src/ProtocolAddressProvider.sol";
import "../src/ProtocolRoles.sol";
import "../src/AlphaVault.sol";
import "../src/AlphaToken.sol";
import "../src/OracleHub.sol";
import "../src/CircuitBreaker.sol";
import "../src/TreasuryManager.sol";
import "../src/TreasuryProxy.sol";
import "../src/ProtocolTokenomicsEngine.sol";
import "../src/CommunityYieldVault.sol";
import "../src/GovernanceStaking.sol";
import "../src/RealYieldRouter.sol";
import "../src/VaultPositionNFT.sol";
import "../src/VestedDiscountVault.sol";
import "../src/P2PLendingMarket.sol";
import "../src/TimelockController.sol";
import "../src/GovernorAlphaCentauri.sol";
import "../src/PostQuantumGuard.sol";
import "../src/DiscountBuybackEngine.sol";
import "../src/FounderReserveVestingVault.sol";
import "../src/adapters/CompliantTreasuryGateway.sol";
import "../src/AtomicSwapReceiver.sol";

/**
 * @title DeployMainnet
 * @notice Official Production Deployment Script for Arbitrum One (ChainID: 42161).
 *         Connects verified external tokens, Chainlink price feeds, Uniswap V3, and DAO Timelock.
 *         NO MOCKS OR TEST FIXTURES ARE REFERENCED.
 */
contract DeployMainnet is Script {
    // --- Arbitrum One Canonical Asset Addresses ---
    address public constant ARB_USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831; // Native Circle USDC
    address public constant ARB_USDT = 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9; // Tether USDT
    address public constant ARB_WBTC = 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f; // Wrapped BTC
    address public constant ARB_WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1; // Wrapped ETH

    // --- Arbitrum One Uniswap V3 Router ---
    address public constant ARB_UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;

    // --- Arbitrum One Chainlink Price Feeds (8 decimals) ---
    address public constant ARB_FEED_USDC = 0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3;
    address public constant ARB_FEED_BTC = 0x6ce185860a4963106506C203335A2910413708e9;
    address public constant ARB_FEED_ETH = 0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612;
    address public constant ARB_FEED_USDT = 0x3F3F5DF88Dc9F13EaC63DF89Ec16eF64E8184250;

    // --- Arbitrum One Sequencer Uptime Feed ---
    address public constant ARB_SEQUENCER_UPTIME = 0xFdB631F5EE196F0ed6FAa767959853A9F217697D;

    // --- Deployed Protocol State Instances ---
    ProtocolAddressProvider public addressProvider;
    AlphaVault public alphaVault;
    AlphaToken public alphaToken;
    OracleHub public oracleHub;
    CircuitBreaker public circuitBreaker;
    TreasuryManager public treasury;
    ProtocolTokenomicsEngine public tokenomicsEngine;
    CommunityYieldVault public communityVault;
    GovernanceStaking public staking;
    RealYieldRouter public realYieldRouter;
    VaultPositionNFT public positionNFT;
    VestedDiscountVault public vestedVault;
    P2PLendingMarket public p2pMarket;
    TimelockController public timelock;
    GovernorAlphaCentauri public governor;
    PostQuantumGuard public pqcGuard;
    DiscountBuybackEngine public buybackEngine;
    FounderReserveVestingVault public founderVault;
    CompliantTreasuryGateway public gateway;
    AtomicSwapReceiver public atomicSwap;

    function run() external {
        require(
            block.chainid == 42161 || block.chainid == 31337,
            "CRITICAL: DeployMainnet script is restricted to Arbitrum One (42161) or Local Fork (31337)"
        );

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== INITIATING ARBITRUM ONE MAINNET DEPLOYMENT ===");
        console.log("Deployer Address:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        _deployCore(deployer);
        _deployYieldAndStaking(deployer);
        _deployMarketsAndGovernance(deployer);
        _deploySecurityAndExtensions(deployer);
        _wirePermissions();

        console.log("=== ARBITRUM ONE MAINNET DEPLOYMENT COMPLETED SUCCESSFULLY ===");

        vm.stopBroadcast();
    }

    function _deployCore(address deployer) private {
        addressProvider = new ProtocolAddressProvider(deployer);
        console.log("[1] ProtocolAddressProvider deployed:", address(addressProvider));

        alphaVault = new AlphaVault(addressProvider, deployer);
        addressProvider.setAddress(addressProvider.ID_ALPHA_VAULT(), address(alphaVault));
        console.log("[2] AlphaVault deployed:", address(alphaVault));

        alphaToken = new AlphaToken(addressProvider, deployer);
        addressProvider.setAddress(addressProvider.ID_ALPHA_TOKEN(), address(alphaToken));
        console.log("[3] AlphaToken deployed:", address(alphaToken));

        oracleHub = new OracleHub(addressProvider, deployer);
        addressProvider.setAddress(addressProvider.ID_ORACLE_HUB(), address(oracleHub));
        oracleHub.setTrackedAsset(ARB_USDC, ARB_FEED_USDC, address(0), 6);
        oracleHub.setTrackedAsset(ARB_USDT, ARB_FEED_USDT, address(0), 6);
        oracleHub.setTrackedAsset(ARB_WBTC, ARB_FEED_BTC, address(0), 8);
        oracleHub.setTrackedAsset(ARB_WETH, ARB_FEED_ETH, address(0), 18);
        oracleHub.setSequencerUptimeFeed(ARB_SEQUENCER_UPTIME);
        console.log("[4] OracleHub deployed and configured with Chainlink feeds:", address(oracleHub));

        circuitBreaker = new CircuitBreaker(deployer);
        addressProvider.setAddress(addressProvider.ID_CIRCUIT_BREAKER(), address(circuitBreaker));
        console.log("[5] CircuitBreaker deployed:", address(circuitBreaker));

        TreasuryManager treasuryImpl = new TreasuryManager(addressProvider);
        TreasuryProxy treasuryProxy = new TreasuryProxy(address(treasuryImpl));
        treasury = TreasuryManager(payable(address(treasuryProxy)));
        treasury.initialize(deployer, ARB_USDC, 6);
        addressProvider.setAddress(addressProvider.ID_TREASURY_MANAGER(), address(treasury));
        console.log("[6] TreasuryManager Proxy deployed:", address(treasury));

        tokenomicsEngine = new ProtocolTokenomicsEngine(deployer);
        addressProvider.setAddress(keccak256("TOKENOMICS_ENGINE"), address(tokenomicsEngine));
        console.log("[7] ProtocolTokenomicsEngine deployed:", address(tokenomicsEngine));
    }

    function _deployYieldAndStaking(address deployer) private {
        communityVault = new CommunityYieldVault(ARB_USDC, deployer);
        addressProvider.setAddress(addressProvider.ID_COMMUNITY_YIELD_VAULT(), address(communityVault));
        console.log("[8] CommunityYieldVault deployed:", address(communityVault));

        staking = new GovernanceStaking(address(alphaToken), ARB_USDC, deployer);
        staking.setTreasury(address(treasury));
        staking.setProtocolVaults(address(communityVault));
        addressProvider.setAddress(addressProvider.ID_GOVERNANCE_STAKING(), address(staking));
        console.log("[9] GovernanceStaking deployed:", address(staking));

        realYieldRouter = new RealYieldRouter(
            ARB_USDC,
            ARB_WBTC,
            ARB_UNISWAP_V3_ROUTER,
            address(staking),
            deployer
        );
        realYieldRouter.setProtocolVaults(address(alphaVault), address(communityVault));
        realYieldRouter.setBasketAssets(ARB_WBTC, ARB_WETH, address(alphaToken));
        realYieldRouter.setOracleConfig(address(oracleHub), 300);
        realYieldRouter.setCircuitBreaker(address(circuitBreaker));
        addressProvider.setAddress(addressProvider.ID_REAL_YIELD_ROUTER(), address(realYieldRouter));
        console.log("[10] RealYieldRouter deployed:", address(realYieldRouter));
    }

    function _deployMarketsAndGovernance(address deployer) private {
        positionNFT = new VaultPositionNFT(deployer);
        console.log("[11] VaultPositionNFT deployed:", address(positionNFT));

        vestedVault = new VestedDiscountVault(
            ARB_USDC,
            address(positionNFT),
            address(alphaVault),
            address(realYieldRouter),
            address(alphaToken),
            deployer
        );
        vestedVault.setTokenomicsEngine(address(tokenomicsEngine));
        vestedVault.setCircuitBreaker(address(circuitBreaker));
        vestedVault.setGovernanceStaking(address(staking));
        positionNFT.grantRole(ProtocolRoles.MINTER_ROLE, address(vestedVault));
        addressProvider.setAddress(keccak256("VESTED_VAULT"), address(vestedVault));
        console.log("[12] VestedDiscountVault deployed:", address(vestedVault));

        p2pMarket = new P2PLendingMarket(
            ARB_USDC,
            address(positionNFT),
            deployer,
            ARB_FEED_USDC,
            deployer
        );
        p2pMarket.setTreasury(address(treasury));
        p2pMarket.setTokenomicsEngine(address(tokenomicsEngine));
        p2pMarket.setCircuitBreaker(address(circuitBreaker));
        p2pMarket.setAlphaToken(address(alphaToken));
        p2pMarket.setWbtcToken(ARB_WBTC);
        p2pMarket.setWethToken(ARB_WETH);
        addressProvider.setAddress(keccak256("P2P_MARKET"), address(p2pMarket));
        console.log("[13] P2PLendingMarket deployed:", address(p2pMarket));

        timelock = new TimelockController(72 hours, deployer);
        governor = new GovernorAlphaCentauri(
            address(staking),
            address(timelock),
            address(alphaVault),
            address(communityVault),
            address(treasury),
            deployer
        );
        timelock.grantRole(ProtocolRoles.ADMIN_ROLE, address(governor));
        console.log("[14] TimelockController and Governor deployed:", address(timelock), address(governor));
    }

    function _deploySecurityAndExtensions(address deployer) private {
        pqcGuard = new PostQuantumGuard(deployer, address(addressProvider));
        addressProvider.setAddress(keccak256("POST_QUANTUM_GUARD"), address(pqcGuard));
        console.log("[15] PostQuantumGuard deployed:", address(pqcGuard));

        buybackEngine = new DiscountBuybackEngine(
            addressProvider,
            ARB_USDC,
            6,
            ARB_UNISWAP_V3_ROUTER,
            deployer
        );
        addressProvider.setAddress(keccak256("DISCOUNT_BUYBACK_ENGINE"), address(buybackEngine));
        console.log("[16] DiscountBuybackEngine deployed:", address(buybackEngine));

        founderVault = new FounderReserveVestingVault(
            address(alphaToken),
            address(treasury),
            deployer,
            deployer
        );
        console.log("[17] FounderReserveVestingVault deployed:", address(founderVault));

        gateway = new CompliantTreasuryGateway(
            address(treasury),
            address(alphaToken),
            deployer
        );
        treasury.setKYCStatus(address(gateway), true);
        console.log("[18] CompliantTreasuryGateway deployed:", address(gateway));

        atomicSwap = new AtomicSwapReceiver(
            ARB_USDT,
            ARB_USDC,
            ARB_UNISWAP_V3_ROUTER,
            address(treasury),
            deployer
        );
        atomicSwap.setCircuitBreaker(address(circuitBreaker));
        console.log("[19] AtomicSwapReceiver deployed:", address(atomicSwap));
    }

    function _wirePermissions() private {
        alphaToken.grantRole(ProtocolRoles.MINTER_ROLE, address(treasury));
        alphaToken.grantRole(ProtocolRoles.BURNER_ROLE, address(treasury));
        alphaVault.grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, address(treasury));
        alphaVault.grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, address(buybackEngine));
        treasury.grantRole(ProtocolRoles.COMPLIANCE_ROLE, address(gateway));
    }
}
