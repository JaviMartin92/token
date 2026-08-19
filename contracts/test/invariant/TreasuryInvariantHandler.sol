// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/lib/token/ERC20/ERC20.sol";
import "../../src/ProtocolAddressProvider.sol";
import "../../src/AlphaToken.sol";
import "../../src/AlphaVault.sol";
import "../../src/TreasuryProxy.sol";
import "../../src/OracleHub.sol";
import "../../src/TreasuryManager.sol";
import "../../src/ProtocolRoles.sol";

contract FuzzMockERC20 is ERC20 {
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

contract FuzzMockFeed {
    int256 public price;
    uint8 public dec;

    constructor(int256 _p, uint8 _d) {
        price = _p;
        dec = _d;
    }

    function setPrice(int256 _newP) external {
        price = _newP;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, price, block.timestamp, block.timestamp, 1);
    }

    function decimals() external view returns (uint8) {
        return dec;
    }
}

/**
 * @title TreasuryInvariantHandler
 * @notice Stateful Invariant Handler simulating random protocol actions across actors and price conditions.
 */
contract TreasuryInvariantHandler is Test {
    TreasuryManager public manager;
    AlphaToken public alphaToken;
    AlphaVault public vault;
    FuzzMockERC20 public usdc;
    FuzzMockFeed public usdcFeed;

    address[] public actors;
    address public currentActor;

    uint256 public totalDepositedUSDC;
    uint256 public totalRedeemedUSDC;

    constructor(
        TreasuryManager _manager,
        AlphaToken _token,
        AlphaVault _vault,
        FuzzMockERC20 _usdc,
        FuzzMockFeed _feed
    ) {
        manager = _manager;
        alphaToken = _token;
        vault = _vault;
        usdc = _usdc;
        usdcFeed = _feed;

        for (uint160 i = 100; i < 105; i++) {
            actors.push(address(i));
        }
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        currentActor = actors[actorSeed % actors.length];
        amount = bound(amount, 100 * 1e6, 50_000 * 1e6); // 100 to 50k USDC

        usdc.mint(currentActor, amount);

        vm.startPrank(currentActor);
        usdc.approve(address(manager), amount);

        try manager.deposit(amount, 0) returns (uint256) {
            totalDepositedUSDC += amount;
        } catch {}
        vm.stopPrank();

        vm.roll(block.number + 1);
    }

    function redeem(uint256 actorSeed, uint256 sharesRatioSeed) external {
        currentActor = actors[actorSeed % actors.length];
        uint256 bal = alphaToken.balanceOf(currentActor);
        if (bal == 0) return;

        uint256 redeemShares = bound(sharesRatioSeed, 1, bal);

        vm.startPrank(currentActor);
        alphaToken.approve(address(manager), redeemShares);

        try manager.redeem(redeemShares, 0) returns (uint256 out) {
            totalRedeemedUSDC += out;
        } catch {}
        vm.stopPrank();

        vm.roll(block.number + 1);
    }
}
