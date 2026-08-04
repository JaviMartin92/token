// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/lib/token/ERC20/ERC20.sol";
import "../src/ProtocolAddressProvider.sol";
import "../src/AlphaToken.sol";
import "../src/AlphaVault.sol";
import "../src/OracleHub.sol";
import "../src/TreasuryManager.sol";
import "../src/ProtocolRoles.sol";

contract MockERC20 is ERC20 {
    uint8 private _dec;
    constructor(string memory name, string memory symbol, uint8 dec_) ERC20(name, symbol) {
        _dec = dec_;
    }
    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockChainlinkFeed {
    int256 private _price;
    uint8 private _decimals;
    constructor(int256 price, uint8 dec) {
        _price = price;
        _decimals = dec;
    }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, _price, block.timestamp, block.timestamp, 1);
    }
    function decimals() external view returns (uint8) { return _decimals; }
}

contract ModularProtocolTest is Test {
    ProtocolAddressProvider public provider;
    AlphaToken public alphaToken;
    AlphaVault public vault;
    OracleHub public oracleHub;
    TreasuryManager public manager;

    MockERC20 public usdc;
    MockERC20 public wbtc;
    MockChainlinkFeed public usdcFeed;
    MockChainlinkFeed public wbtcFeed;

    address public admin = address(0x1);
    address public user = address(0x2);

    function setUp() public {
        vm.startPrank(admin);
        
        // Mocks
        usdc = new MockERC20("USDC", "USDC", 6);
        wbtc = new MockERC20("WBTC", "WBTC", 8);
        usdcFeed = new MockChainlinkFeed(1_00000000, 8); // $1
        wbtcFeed = new MockChainlinkFeed(60000_00000000, 8); // $60,000

        // 1. Address Provider
        provider = new ProtocolAddressProvider(admin);
        
        // 2. Token
        alphaToken = new AlphaToken(provider, admin);
        provider.setAddress(keccak256("ALPHA_TOKEN"), address(alphaToken));

        // 3. Vault
        vault = new AlphaVault(provider, admin);
        provider.setAddress(keccak256("ALPHA_VAULT"), address(vault));

        // 4. Oracle Hub
        oracleHub = new OracleHub(provider, admin);
        provider.setAddress(keccak256("ORACLE_HUB"), address(oracleHub));
        oracleHub.grantRole(ProtocolRoles.ORACLE_MANAGER_ROLE, admin);
        oracleHub.setTrackedAsset(address(usdc), address(usdcFeed), 6);
        oracleHub.setTrackedAsset(address(wbtc), address(wbtcFeed), 8);

        // 5. Treasury Manager
        manager = new TreasuryManager(provider, admin, address(usdc), 6);
        provider.setAddress(keccak256("TREASURY_MANAGER"), address(manager));

        // Roles
        alphaToken.grantRole(ProtocolRoles.MINTER_ROLE, address(manager));
        alphaToken.grantRole(ProtocolRoles.BURNER_ROLE, address(manager));
        vault.grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, address(manager));

        vm.stopPrank();
    }

    function test_DepositAndMint() public {
        // Setup user funds
        usdc.mint(user, 1000 * 10**6); // 1000 USDC
        
        vm.startPrank(user);
        usdc.approve(address(manager), 1000 * 10**6);
        
        // Calculate expected: 1000 USDC -> 1000 ALPHA (minus 0.5% fee = 995 ALPHA)
        uint256 expectedMint = manager.deposit(1000 * 10**6);
        
        assertEq(expectedMint, 995 * 10**18);
        assertEq(alphaToken.balanceOf(user), 995 * 10**18);
        assertEq(usdc.balanceOf(address(vault)), 1000 * 10**6); // All USDC sits in the vault
        vm.stopPrank();
    }

    function test_Redeem() public {
        usdc.mint(user, 1000 * 10**6);
        vm.startPrank(user);
        usdc.approve(address(manager), 1000 * 10**6);
        uint256 minted = manager.deposit(1000 * 10**6); // 995 ALPHA

        // Now Redeem half (497.5 ALPHA)
        uint256 redeemAmount = 4975 * 10**17;
        alphaToken.approve(address(manager), redeemAmount);
        
        // 497.5 ALPHA at $1 NAV -> 497.5 USDC (minus 0.5% exit fee -> 495.0125 USDC)
        manager.redeem(redeemAmount);
        
        assertEq(alphaToken.balanceOf(user), 4975 * 10**17);
        vm.stopPrank();
    }

    function test_Invariant_ProofOfReserves() public {
        usdc.mint(user, 1000 * 10**6);
        vm.startPrank(user);
        usdc.approve(address(manager), 1000 * 10**6);
        manager.deposit(1000 * 10**6); // 995 ALPHA minted

        // Manually check PoR
        uint256 totalReservesUsd = manager.getTotalNavUSD();
        uint256 totalSupply = alphaToken.totalSupply();
        uint256 nav = (totalReservesUsd * 10**18) / totalSupply;

        // 1000 USDC = 1000 USD (scaled to 1e18)
        assertEq(totalReservesUsd, 1000 * 10**18);
        
        // NAV = 1000 / 990 = ~1.0101
        assert(nav > 1 * 10**18); // NAV has increased due to the 1% entry fee!
        vm.stopPrank();
    }

    function test_RevertIf_MintWithoutRole() public {
        vm.startPrank(user);
        vm.expectRevert("AccessControl: account is missing role");
        alphaToken.mint(user, 1000);
        vm.stopPrank();
    }
}
