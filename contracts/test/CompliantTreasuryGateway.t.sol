// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/lib/token/ERC20/ERC20.sol";
import "../src/ProtocolAddressProvider.sol";
import "../src/AlphaToken.sol";
import "../src/AlphaVault.sol";
import "../src/TreasuryProxy.sol";
import "../src/OracleHub.sol";
import "../src/TreasuryManager.sol";
import "../src/ProtocolRoles.sol";
import "../src/adapters/CompliantTreasuryGateway.sol";

contract MockERC20Gateway is ERC20 {
    uint8 private _dec;

    constructor(string memory name, string memory symbol, uint8 dec_) ERC20(name, symbol) {
        _dec = dec_;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockChainlinkFeedGateway {
    int256 private _price;
    uint8 private _decimals;

    constructor(int256 price, uint8 dec) {
        _price = price;
        _decimals = dec;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, _price, block.timestamp, block.timestamp, 1);
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }
}

contract CompliantTreasuryGatewayTest is Test {
    ProtocolAddressProvider public provider;
    AlphaToken public alphaToken;
    AlphaVault public vault;
    OracleHub public oracleHub;
    TreasuryManager public manager;
    CompliantTreasuryGateway public gateway;

    MockERC20Gateway public usdc;
    MockChainlinkFeedGateway public usdcFeed;

    address public admin = address(0x1);
    address public institution = address(0x100);
    address public nonKycUser = address(0x200);

    function setUp() public {
        vm.startPrank(admin);

        usdc = new MockERC20Gateway("USDC", "USDC", 6);
        usdcFeed = new MockChainlinkFeedGateway(1_00000000, 8);

        provider = new ProtocolAddressProvider(admin);

        alphaToken = new AlphaToken(provider, admin);
        provider.setAddress(keccak256("ALPHA_TOKEN"), address(alphaToken));

        vault = new AlphaVault(provider, admin);
        provider.setAddress(keccak256("ALPHA_VAULT"), address(vault));

        oracleHub = new OracleHub(provider, admin);
        oracleHub.setTrackedAsset(address(usdc), address(usdcFeed), address(0), 6);
        provider.setAddress(keccak256("ORACLE_HUB"), address(oracleHub));

        TreasuryManager impl = new TreasuryManager(provider);
        TreasuryProxy proxy = new TreasuryProxy(address(impl));
        manager = TreasuryManager(address(proxy));
        manager.initialize(admin, address(usdc), 6);
        provider.setAddress(keccak256("TREASURY_MANAGER"), address(manager));

        alphaToken.grantRole(ProtocolRoles.MINTER_ROLE, address(manager));
        alphaToken.grantRole(ProtocolRoles.BURNER_ROLE, address(manager));
        vault.grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, address(manager));

        gateway = new CompliantTreasuryGateway(address(manager), address(alphaToken), admin);

        // Authorize institution
        gateway.setKYCStatus(institution, true);

        vm.stopPrank();
    }

    function test_RevertIf_NonKYCAttemptsDeposit() public {
        usdc.mint(nonKycUser, 1000 * 10 ** 6);
        vm.startPrank(nonKycUser);
        usdc.approve(address(gateway), 1000 * 10 ** 6);
        vm.expectRevert(abi.encodeWithSelector(CompliantTreasuryGateway.KYCVerificationFailed.selector, nonKycUser));
        gateway.depositCompliant(1000 * 10 ** 6, 0);
        vm.stopPrank();
    }

    function test_InstitutionalDepositAndRedeem_StatelessExecution() public {
        uint256 depositUsdc = 1000 * 10 ** 6; // $1,000
        usdc.mint(institution, depositUsdc);

        vm.startPrank(institution);
        usdc.approve(address(gateway), depositUsdc);
        uint256 mintedShares = gateway.depositCompliant(depositUsdc, 0);

        // Verify institution received Alpha tokens directly
        assertGt(mintedShares, 0);
        assertEq(alphaToken.balanceOf(institution), mintedShares);

        // Verify Gateway is 100% stateless (0 residual tokens)
        assertEq(usdc.balanceOf(address(gateway)), 0);
        assertEq(alphaToken.balanceOf(address(gateway)), 0);

        // Warp block to bypass same-block cooldown
        vm.roll(block.number + 1);

        // Execute redemption of half shares via gateway
        uint256 redeemShares = mintedShares / 2;
        alphaToken.approve(address(gateway), redeemShares);
        uint256 usdcReturned = gateway.redeemCompliant(redeemShares, 0);

        assertGt(usdcReturned, 0);
        assertEq(alphaToken.balanceOf(institution), mintedShares - redeemShares);

        // Verify Gateway remains 100% stateless (0 residual tokens)
        assertEq(usdc.balanceOf(address(gateway)), 0);
        assertEq(alphaToken.balanceOf(address(gateway)), 0);

        vm.stopPrank();
    }
}
