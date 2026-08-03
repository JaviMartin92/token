// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Treasury.sol";
import "../src/GovernanceStaking.sol";
import "../src/CircuitBreaker.sol";
import "../src/lib/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    uint8 private _dec;
    constructor(string memory name, string memory symbol, uint8 dec_) ERC20(name, symbol) { _dec = dec_; }
    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockFeed {
    int256 public price;
    uint256 public updatedAt;
    constructor(int256 _price) {
        price = _price;
        updatedAt = block.timestamp;
    }
    function setPrice(int256 _price) external {
        price = _price;
        updatedAt = block.timestamp;
    }
    function decimals() external pure returns (uint8) { return 8; }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, price, updatedAt, updatedAt, 1);
    }
}

/**
 * @title ProtocolInvariantsTest
 * @notice Invariant and property-based fuzz tests for Alpha Centauri Protocol.
 */
contract ProtocolInvariantsTest is Test {
    Treasury public treasury;
    GovernanceStaking public staking;
    CircuitBreaker public breaker;
    MockUSDC public usdc;
    MockFeed public usdcFeed;

    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);

    function setUp() public {
        vm.startPrank(owner);
        usdc = new MockUSDC("USD Coin", "USDC", 6);
        usdcFeed = new MockFeed(1e8); // $1.00

        treasury = new Treasury(owner, address(usdc), 6);
        staking = new GovernanceStaking(address(usdc), address(usdc), owner);
        breaker = new CircuitBreaker(owner);

        breaker.setPriceFeed(address(usdc), address(usdcFeed));
        treasury.setTrackedAsset(address(usdc), address(usdcFeed), 6);
        treasury.setProtocolModules(
            address(0x10),
            address(0x11),
            address(0x12),
            address(staking),
            address(0x13),
            address(0x14)
        );

        usdc.mint(user1, 1_000_000 * 1e6);
        usdc.mint(user2, 1_000_000 * 1e6);
        vm.stopPrank();
    }

    /// @dev Invariant 1: Proof of Reserves collateral ratio must be >= 100% after normal deposits.
    function testFuzz_DepositCollateralRatio(uint256 amount) public {
        amount = bound(amount, 100 * 1e6, 50_000 * 1e6);

        vm.startPrank(user1);
        usdc.approve(address(treasury), amount);
        treasury.deposit(amount);
        vm.stopPrank();

        (uint256 totalAssets, uint256 totalLiabilities, uint256 ratioBps) = treasury.getProofOfReserves();
        assertGe(totalAssets, totalLiabilities, "Assets must be >= liabilities");
        assertGe(ratioBps, 10000, "Collateral ratio must be >= 100.00%");
    }

    /// @dev Invariant 2: Redemption fee (1%) must reduce liabilities proportionally without making assets < liabilities.
    function testFuzz_RedeemMaintainSolvency(uint256 depositAmt, uint256 redeemPct) public {
        depositAmt = bound(depositAmt, 1_000 * 1e6, 50_000 * 1e6);
        redeemPct = bound(redeemPct, 1, 100);

        vm.startPrank(user1);
        usdc.approve(address(treasury), depositAmt);
        uint256 shares = treasury.deposit(depositAmt);

        uint256 sharesToRedeem = (shares * redeemPct) / 100;
        if (sharesToRedeem > 0) {
            treasury.redeem(sharesToRedeem);
        }
        vm.stopPrank();

        (uint256 totalAssets, uint256 totalLiabilities, uint256 ratioBps) = treasury.getProofOfReserves();
        assertGe(totalAssets, totalLiabilities, "Protocol must remain solvent after redemption");
        assertGe(ratioBps, 10000, "Ratio must remain >= 100.00%");
    }

    /// @dev Invariant 3: CircuitBreaker circular buffer never reverts on repeated price checks.
    function testFuzz_CircuitBreakerBufferNoOverflow(uint256 steps) public {
        steps = bound(steps, 1, 50);

        vm.startPrank(owner);
        for (uint256 i = 0; i < steps; i++) {
            vm.warp(block.timestamp + 15 minutes);
            usdcFeed.setPrice(1e8); // updates timestamp in MockFeed
            breaker.checkAssetDeviation(address(usdc));
        }
        vm.stopPrank();

        assertEq(breaker.priceHistoryCount(address(usdc)), steps);
    }
}