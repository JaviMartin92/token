// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/OracleHub.sol";
import "../src/TreasuryManager.sol";
import "../src/TreasuryProxy.sol";
import {AlphaVault} from "../src/AlphaVault.sol";
import {AlphaToken} from "../src/AlphaToken.sol";
import {ProtocolAddressProvider} from "../src/ProtocolAddressProvider.sol";
import {OracleHub} from "../src/OracleHub.sol";
import {AaveV3Adapter} from "../src/adapters/AaveV3Adapter.sol";
import {OndoRWAAdapter} from "../src/adapters/OndoRWAAdapter.sol";
import {ProtocolRoles} from "../src/ProtocolRoles.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

contract MockFeedCoverage {
    int256 public answer;
    uint8 public decimals_;

    constructor(int256 _answer, uint8 _decimals) {
        answer = _answer;
        decimals_ = _decimals;
    }

    function latestRoundData() external view returns (uint80, int256 p, uint256, uint256 u, uint80) {
        return (1, answer, block.timestamp, block.timestamp, 1);
    }

    function decimals() external view returns (uint8) {
        return decimals_;
    }
}

contract UniversalYield_ERC4626_Rotation_Test is Test {
    TreasuryManager public manager;
    AlphaVault public vault;
    AlphaToken public alphaToken;
    ProtocolAddressProvider public provider;
    OracleHub public oracle;

    AaveV3Adapter public aaveAdapter;
    OndoRWAAdapter public ondoAdapter;
    MockUSDC public usdc;
    MockFeedCoverage public usdcFeed;

    address public admin = address(0x1);
    address public user = address(0x2);

    function setUp() public {
        vm.startPrank(admin);

        usdc = new MockUSDC();
        usdcFeed = new MockFeedCoverage(1_00000000, 8); // $1.00 USD
        provider = new ProtocolAddressProvider(admin);

        vault = new AlphaVault(provider, admin);
        alphaToken = new AlphaToken(provider, admin);
        oracle = new OracleHub(provider, admin);
        TreasuryManager logic = new TreasuryManager(provider);
        TreasuryProxy proxy = new TreasuryProxy(address(logic));
        manager = TreasuryManager(address(proxy));
        manager.initialize(admin, address(usdc), 6);

        provider.setAddress(keccak256("TREASURY_MANAGER"), address(manager));
        provider.setAddress(provider.ID_ALPHA_VAULT(), address(vault));
        provider.setAddress(provider.ID_ALPHA_TOKEN(), address(alphaToken));
        provider.setAddress(provider.ID_ORACLE_HUB(), address(oracle));
        provider.setAddress(provider.ID_TREASURY_MANAGER(), address(manager));

        vault.grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, address(manager));
        alphaToken.grantRole(ProtocolRoles.MINTER_ROLE, address(manager));
        alphaToken.grantRole(ProtocolRoles.BURNER_ROLE, address(manager));
        manager.grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, admin);

        oracle.grantRole(ProtocolRoles.ORACLE_MANAGER_ROLE, admin);
        oracle.setTrackedAsset(address(usdc), address(usdcFeed), address(0), 6);

        aaveAdapter = new AaveV3Adapter(address(usdc));
        ondoAdapter = new OndoRWAAdapter(address(usdc));

        manager.addYieldAdapter(address(aaveAdapter));
        manager.addYieldAdapter(address(ondoAdapter));
        manager.grantRole(ProtocolRoles.COMPLIANCE_ROLE, admin);
        manager.setKYCStatus(user, true);

        vm.stopPrank();
    }

    function test_UniversalYield_ERC4626_Rotation() public {
        // 1. User deposits 2,000,000 USDC
        uint256 depositAmount = 2_000_000 * 10 ** 6;
        usdc.mint(user, depositAmount);

        vm.startPrank(user);
        usdc.approve(address(manager), depositAmount);
        uint256 sharesMinted = manager.deposit(depositAmount, 0);
        vm.stopPrank();

        (,, uint256 preRatioBps) = manager.getProofOfReserves();
        assertGe(preRatioBps, 10000, "PoR should be at least 100%");
        uint256 preNav = manager.getNAVPerShare();

        // 2. Admin deposits 1,000,000 USDC to Aave Yield Adapter
        vm.startPrank(admin);
        manager.depositToYieldAdapter(address(aaveAdapter), 1_000_000 * 10 ** 6);
        vm.stopPrank();

        // Verify balance moved
        assertEq(aaveAdapter.balanceOf(address(vault)), 1_000_000 * 10 ** 6);

        // 3. Simulate Yield Growth in Aave (+5%)
        aaveAdapter.simulateYield(10500);

        (,, uint256 midRatioBps) = manager.getProofOfReserves();
        assertGe(midRatioBps, 10000, "PoR should remain robust");
        uint256 midNav = manager.getNAVPerShare();
        assertGt(midNav, preNav, "NAV should increase from yield");

        // 4. Massive withdraw that triggers _ensureLiquidBuffer
        // User wants to redeem 75% of their shares
        vm.roll(block.number + 1); // bypass same-block cooldown
        uint256 redeemShares = (sharesMinted * 75) / 100;

        vm.startPrank(user);
        alphaToken.approve(address(manager), redeemShares);
        manager.redeem(redeemShares, 0);
        vm.stopPrank();

        (,, uint256 postRatioBps) = manager.getProofOfReserves();
        assertGe(postRatioBps, 10000, "PoR should not drop below 10000");
        uint256 postNav = manager.getNAVPerShare();
        assertGe(postNav, midNav, "NAV should be monotonic on redeem");

        // Validate that Aave Adapter was pulled from
        // Vault originally had 1,000,000 liquid. User redeemed 75% of 2M (approx 1.5M).
        // 1M liquid is not enough, so 500k was pulled from Aave.
        uint256 aaveSharesLeft = aaveAdapter.balanceOf(address(vault));
        assertLt(aaveSharesLeft, 1_000_000 * 10 ** 6, "Liquidity should have been pulled from Aave");
    }
}
