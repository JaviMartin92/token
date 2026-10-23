// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/DynamicYieldOracleRouter.sol";
import "../src/ProtocolRoles.sol";

contract DynamicYieldOracleRouterTest is Test {
    DynamicYieldOracleRouter public router;
    address public admin = address(0x1);
    address public unauth = address(0x2);

    function setUp() public {
        vm.startPrank(admin);
        router = new DynamicYieldOracleRouter(admin);
        vm.stopPrank();
    }

    function test_DefaultProtocols_Loaded() public view {
        (string memory sName,, uint256 sApy) = router.getBestYieldVault(0); // STABLECOIN
        assertEq(sName, "Morpho Blue MetaMorpho Vault");
        assertEq(sApy, 645);

        (string memory eName,, uint256 eApy) = router.getBestYieldVault(1); // ETHEREUM
        assertEq(eName, "Lido Liquid Staking wstETH");
        assertEq(eApy, 320);

        (string memory bName,, uint256 bApy) = router.getBestYieldVault(2); // BITCOIN
        assertEq(bName, "Lombard LBTC Babylon Staking");
        assertEq(bApy, 380);
    }

    function test_SanityBounds_RejectsAbnormalRates() public {
        vm.startPrank(admin);

        // STABLECOIN bound is 100 bps - 1500 bps (1.00% - 15.00%)
        // 1. Try to set an anomalous 25% APY (2500 bps)
        vm.expectRevert(
            abi.encodeWithSelector(
                DynamicYieldOracleRouter.YieldRateOutOfBounds.selector,
                0, // STABLECOIN
                2500, // apyBps
                100, // min
                1500 // max
            )
        );
        router.updateProtocolYield(0, "Morpho Blue MetaMorpho Vault", address(0x4881), 2500, true);

        // 2. Try to set an anomalous 0.20% APY (20 bps)
        vm.expectRevert(
            abi.encodeWithSelector(
                DynamicYieldOracleRouter.YieldRateOutOfBounds.selector,
                0, // STABLECOIN
                20, // apyBps
                100, // min
                1500 // max
            )
        );
        router.updateProtocolYield(0, "Morpho Blue MetaMorpho Vault", address(0x4881), 20, true);

        // 3. Valid rate within bounds: 6.85% (685 bps) should succeed
        router.updateProtocolYield(0, "Morpho Blue MetaMorpho Vault", address(0x4881), 685, true);
        (,, uint256 updatedApy) = router.getBestYieldVault(0);
        assertEq(updatedApy, 685);

        vm.stopPrank();
    }

    function test_SanityBounds_AdminCanUpdate() public {
        vm.startPrank(admin);

        // Admin widens stablecoin bounds to 50 - 2000 bps
        router.setSanityBounds(0, 50, 2000);
        (uint256 minBps, uint256 maxBps) = router.sanityBounds(0);
        assertEq(minBps, 50);
        assertEq(maxBps, 2000);

        // Invalid bounds (min > max) must revert
        vm.expectRevert(DynamicYieldOracleRouter.InvalidSanityBounds.selector);
        router.setSanityBounds(0, 2000, 500);

        vm.stopPrank();
    }

    function test_Unauthorized_CannotUpdate() public {
        vm.startPrank(unauth);
        vm.expectRevert();
        router.updateProtocolYield(0, "Morpho Blue MetaMorpho Vault", address(0x4881), 600, true);
        vm.stopPrank();
    }
}
