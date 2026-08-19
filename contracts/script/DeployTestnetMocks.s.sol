// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/mocks/MockERC20.sol";
import "../src/mocks/MockV3Aggregator.sol";
import "../src/mocks/TestnetFaucet.sol";
import "../src/TreasuryManager.sol";
import "../src/ProtocolRoles.sol";

contract DeployTestnetMocks is Script {
    function run() external {
        require(block.chainid != 1 && block.chainid != 8453, "Cannot deploy faucet on mainnet");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Mock Tokens
        MockERC20 mockUSDC = new MockERC20("Mock USDC", "USDC", 6);
        MockERC20 mockWBTC = new MockERC20("Mock Wrapped BTC", "WBTC", 8);
        MockERC20 mockWETH = new MockERC20("Mock Wrapped ETH", "WETH", 18);

        console.log("Mock USDC deployed at:", address(mockUSDC));
        console.log("Mock WBTC deployed at:", address(mockWBTC));
        console.log("Mock WETH deployed at:", address(mockWETH));

        // 2. Deploy Mock Aggregators (Chainlink Feeds)
        // USDC: $1 (8 decimals is standard for USD pairs in Chainlink)
        MockV3Aggregator usdcFeed = new MockV3Aggregator(8, 1 * 1e8);
        // WBTC: $60,000
        MockV3Aggregator wbtcFeed = new MockV3Aggregator(8, 60000 * 1e8);
        // WETH: $3,000
        MockV3Aggregator wethFeed = new MockV3Aggregator(8, 3000 * 1e8);

        console.log("Mock USDC Feed deployed at:", address(usdcFeed));
        console.log("Mock WBTC Feed deployed at:", address(wbtcFeed));
        console.log("Mock WETH Feed deployed at:", address(wethFeed));

        // NOTE: The TreasuryManager would need to be deployed next,
        // passing in these token addresses and feeds to the OracleHub.
        // For the sake of this script, let's assume TreasuryManager is already deployed
        // or will be deployed by another script.

        address treasuryAddress = vm.envOr("TREASURY_ADDRESS", address(0));

        if (treasuryAddress != address(0)) {
            // 3. Deploy Testnet Faucet
            TestnetFaucet faucet = new TestnetFaucet(address(mockUSDC), treasuryAddress);
            console.log("TestnetFaucet deployed at:", address(faucet));

            // 4. Grant COMPLIANCE_ROLE to the Faucet so it can auto-whitelist testers
            TreasuryManager treasury = TreasuryManager(payable(treasuryAddress));
            treasury.grantRole(ProtocolRoles.COMPLIANCE_ROLE, address(faucet));
            console.log("COMPLIANCE_ROLE granted to TestnetFaucet");
        } else {
            console.log("WARNING: TREASURY_ADDRESS not set in env. TestnetFaucet not deployed.");
            console.log("Set TREASURY_ADDRESS and run again to deploy the faucet and grant permissions.");
        }

        vm.stopBroadcast();
    }
}
