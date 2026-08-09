// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ISwapRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IMockMintableERC20 {
    function mint(address to, uint256 amount) external;
    function decimals() external view returns (uint8);
}

/**
 * @title MockSwapRouter
 * @notice Mock Uniswap V3 SwapRouter for sandbox local devnet (Anvil).
 *         Executes real ERC20 swaps using mock prices ($60,000 WBTC, $3,000 WETH, $1 USDC).
 */
contract MockSwapRouter is ISwapRouter, Ownable {
    address public immutable usdcToken;
    address public immutable wbtcToken;
    address public immutable wethToken;

    uint256 public btcPriceUsd = 60000;
    uint256 public ethPriceUsd = 3000;

    constructor(
        address _usdcToken,
        address _wbtcToken,
        address _wethToken,
        address _initialOwner
    ) Ownable() {
        usdcToken = _usdcToken;
        wbtcToken = _wbtcToken;
        wethToken = _wethToken;

        if (_initialOwner != msg.sender && _initialOwner != address(0)) {
            transferOwnership(_initialOwner);
        }
    }

    function setPrices(uint256 _btcPriceUsd, uint256 _ethPriceUsd) external onlyOwner {
        btcPriceUsd = _btcPriceUsd;
        ethPriceUsd = _ethPriceUsd;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable override returns (uint256 amountOut) {
        require(params.amountIn > 0, "MockSwapRouter: Zero amountIn");

        // 1. Pull tokenIn from recipient (AlphaVault) or sender
        address payer = (params.recipient != address(0) && IERC20(params.tokenIn).allowance(params.recipient, address(this)) >= params.amountIn) 
            ? params.recipient 
            : msg.sender;
        require(IERC20(params.tokenIn).transferFrom(payer, address(this), params.amountIn), "MockSwapRouter: transferFrom failed");

        // 2. Compute amountOut based on token pair
        if (params.tokenIn == usdcToken && params.tokenOut == wbtcToken) {
            // USDC (6 dec) -> WBTC (8 dec) @ $60,000
            // amountIn is in 6 decimals (1e6 = $1)
            // amountOut = (amountIn * 1e8) / (60000 * 1e6)
            amountOut = (params.amountIn * 10**8) / (btcPriceUsd * 10**6);
        } else if (params.tokenIn == usdcToken && params.tokenOut == wethToken) {
            // USDC (6 dec) -> WETH (18 dec) @ $3,000
            // amountOut = (amountIn * 1e18) / (3000 * 1e6)
            amountOut = (params.amountIn * 10**18) / (ethPriceUsd * 10**6);
        } else if (params.tokenIn == wbtcToken && params.tokenOut == usdcToken) {
            // WBTC (8 dec) -> USDC (6 dec) @ $60,000
            amountOut = (params.amountIn * btcPriceUsd * 10**6) / 10**8;
        } else if (params.tokenIn == wethToken && params.tokenOut == usdcToken) {
            // WETH (18 dec) -> USDC (6 dec) @ $3,000
            amountOut = (params.amountIn * ethPriceUsd * 10**6) / 10**18;
        } else {
            // 1:1 fallback for equal decimal mock pairs
            amountOut = params.amountIn;
        }

        // 3. Deliver tokenOut to recipient
        uint256 routerBal = IERC20(params.tokenOut).balanceOf(address(this));
        if (routerBal >= amountOut) {
            require(IERC20(params.tokenOut).transfer(params.recipient, amountOut), "MockSwapRouter: transfer failed");
        } else {
            // Mint if mock token allows minting
            try IMockMintableERC20(params.tokenOut).mint(params.recipient, amountOut) {} catch {
                if (routerBal > 0) {
                    IERC20(params.tokenOut).transfer(params.recipient, routerBal);
                }
            }
        }
    }
}
