// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../script/DeployMainnet.s.sol";
import "../src/ProtocolRoles.sol";
import "../src/TreasuryProxy.sol";

/**
 * @title DeployRolesTokenMock
 * @notice Stateless ERC-20 metadata/movement stub. Values are immutables so the runtime code can
 *         be installed at the canonical Arbitrum token addresses with `vm.etch` (no storage).
 */
contract DeployRolesTokenMock {
    uint8 private immutable _decimals;

    constructor(uint8 decimals_) {
        _decimals = decimals_;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function name() external pure returns (string memory) {
        return "Etched Token";
    }

    function symbol() external pure returns (string memory) {
        return "ETCH";
    }

    function totalSupply() external pure returns (uint256) {
        return 0;
    }

    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }

    function allowance(address, address) external pure returns (uint256) {
        return 0;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return true;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return true;
    }

    function approve(address, uint256) external pure returns (bool) {
        return true;
    }
}

/**
 * @title DeployRolesFeedMock
 * @notice Stateless Chainlink aggregator stub returning a fresh, positive answer.
 */
contract DeployRolesFeedMock {
    uint8 private immutable _decimals;
    int256 private immutable _answer;

    constructor(uint8 decimals_, int256 answer_) {
        _decimals = decimals_;
        _answer = answer_;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (1, _answer, block.timestamp, block.timestamp, 1);
    }
}

/**
 * @title DeployMainnetRolesTest
 * @notice C-04 regression: after the production script completes, the deployer EOA must not
 *         retain any administrative, compliance, oracle, keeper, emergency or quantum role.
 */
contract DeployMainnetRolesTest is Test {
    uint256 internal constant DEPLOYER_PK = 0xA11CE5EED;
    address internal deployer;
    address internal founderBeneficiary = address(0xF0DE4);

    // Canonical Arbitrum One addresses referenced by the production script.
    address internal constant ARB_USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address internal constant ARB_USDT = 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9;
    address internal constant ARB_WBTC = 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f;
    address internal constant ARB_WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address internal constant ARB_FEED_USDC = 0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3;
    address internal constant ARB_FEED_USDT = 0x3F3F5DF88Dc9F13EaC63DF89Ec16eF64E8184250;
    address internal constant ARB_FEED_BTC = 0x6ce185860a4963106506C203335A2910413708e9;
    address internal constant ARB_FEED_ETH = 0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612;

    DeployMainnet internal script;

    function setUp() public {
        deployer = vm.addr(DEPLOYER_PK);
        vm.setEnv("DEPLOYER_PRIVATE_KEY", vm.toString(DEPLOYER_PK));
        vm.setEnv("FOUNDER_BENEFICIARY", vm.toString(founderBeneficiary));

        _installExternalMocks();

        script = new DeployMainnet();
        script.run();
    }

    /// @dev The script hardcodes canonical Arbitrum addresses and performs real external calls
    ///      (ERC-20 metadata, Chainlink `latestRoundData`). The local EVM has no code there, so
    ///      stateless stubs are etched in place to exercise the deployment path itself.
    function _installExternalMocks() internal {
        _etchToken(ARB_USDC, 6);
        _etchToken(ARB_USDT, 6);
        _etchToken(ARB_WBTC, 8);
        _etchToken(ARB_WETH, 18);

        _etchFeed(ARB_FEED_USDC, 1e8); // $1.00
        _etchFeed(ARB_FEED_USDT, 1e8); // $1.00
        _etchFeed(ARB_FEED_BTC, 60_000e8); // $60,000
        _etchFeed(ARB_FEED_ETH, 3_000e8); // $3,000
    }

    function _etchToken(address target, uint8 decimals_) internal {
        DeployRolesTokenMock mock = new DeployRolesTokenMock(decimals_);
        vm.etch(target, address(mock).code);
    }

    function _etchFeed(address target, int256 answer) internal {
        DeployRolesFeedMock mock = new DeployRolesFeedMock(8, answer);
        vm.etch(target, address(mock).code);
    }

    function test_DeployerRetainsNoRoles() public view {
        assertEq(script.treasury().hasRole(ProtocolRoles.VAULT_MANAGER_ROLE, deployer), false);
        assertEq(script.treasury().hasRole(ProtocolRoles.COMPLIANCE_ROLE, deployer), false);
        assertEq(script.oracleHub().hasRole(ProtocolRoles.ORACLE_MANAGER_ROLE, deployer), false);
        assertEq(script.circuitBreaker().hasRole(ProtocolRoles.EMERGENCY_ADMIN_ROLE, deployer), false);
        assertEq(script.pqcGuard().hasRole(script.pqcGuard().QUANTUM_OPERATOR_ROLE(), deployer), false);
        assertEq(script.buybackEngine().hasRole(ProtocolRoles.KEEPER_ROLE, deployer), false);
        assertEq(script.gateway().hasRole(ProtocolRoles.COMPLIANCE_ROLE, deployer), false);
        assertEq(script.founderVault().beneficiary(), founderBeneficiary);
    }

    function test_DeployerLosesDefaultAdminEverywhere() public view {
        _assertNoDefaultAdmin(address(script.addressProvider()), deployer);
        _assertNoDefaultAdmin(address(script.alphaVault()), deployer);
        _assertNoDefaultAdmin(address(script.alphaToken()), deployer);
        _assertNoDefaultAdmin(address(script.oracleHub()), deployer);
        _assertNoDefaultAdmin(address(script.circuitBreaker()), deployer);
        _assertNoDefaultAdmin(address(script.treasury()), deployer);
        _assertNoDefaultAdmin(address(script.tokenomicsEngine()), deployer);
        _assertNoDefaultAdmin(address(script.communityVault()), deployer);
        _assertNoDefaultAdmin(address(script.staking()), deployer);
        _assertNoDefaultAdmin(address(script.realYieldRouter()), deployer);
        _assertNoDefaultAdmin(address(script.positionNFT()), deployer);
        _assertNoDefaultAdmin(address(script.vestedVault()), deployer);
        _assertNoDefaultAdmin(address(script.timelock()), deployer);
        _assertNoDefaultAdmin(address(script.governor()), deployer);
        _assertNoDefaultAdmin(address(script.pqcGuard()), deployer);
        _assertNoDefaultAdmin(address(script.buybackEngine()), deployer);
        _assertNoDefaultAdmin(address(script.founderVault()), deployer);
        _assertNoDefaultAdmin(address(script.gateway()), deployer);
        _assertNoDefaultAdmin(address(script.atomicSwap()), deployer);
    }

    function test_TimelockReceivesOperationalControl() public view {
        address timelock = address(script.timelock());

        assertEq(script.treasury().hasRole(script.treasury().DEFAULT_ADMIN_ROLE(), timelock), true);
        assertEq(script.treasury().hasRole(ProtocolRoles.ADMIN_ROLE, timelock), true);
        assertEq(script.treasury().hasRole(ProtocolRoles.VAULT_MANAGER_ROLE, timelock), true);
        assertEq(script.treasury().hasRole(ProtocolRoles.COMPLIANCE_ROLE, timelock), true);

        assertEq(script.oracleHub().hasRole(ProtocolRoles.ORACLE_MANAGER_ROLE, timelock), true);
        assertEq(script.circuitBreaker().hasRole(ProtocolRoles.EMERGENCY_ADMIN_ROLE, timelock), true);
        assertEq(script.pqcGuard().hasRole(script.pqcGuard().QUANTUM_OPERATOR_ROLE(), timelock), true);
        assertEq(script.buybackEngine().hasRole(ProtocolRoles.KEEPER_ROLE, timelock), true);
        assertEq(script.gateway().hasRole(ProtocolRoles.COMPLIANCE_ROLE, timelock), true);
        assertEq(script.governor().hasRole(script.governor().DEFAULT_ADMIN_ROLE(), timelock), true);

        assertEq(script.p2pMarket().owner(), timelock);
        assertEq(TreasuryProxy(payable(address(script.treasury()))).owner(), timelock);
        assertEq(script.positionNFT().minter(), address(script.vestedVault()));
    }

    function test_GatewayWhitelistedInTreasury() public view {
        assertEq(script.treasury().kycWhitelist(address(script.gateway())), true);
    }

    function _assertNoDefaultAdmin(address target, address account) internal view {
        AccessControl ac = AccessControl(target);
        assertEq(ac.hasRole(ac.DEFAULT_ADMIN_ROLE(), account), false);
        assertEq(ac.hasRole(ProtocolRoles.ADMIN_ROLE, account), false);
    }
}
