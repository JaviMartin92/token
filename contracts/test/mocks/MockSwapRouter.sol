// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../src/interfaces/ISwapRouter.sol";
import "../../src/interfaces/IProtocolErrors.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../../src/ProtocolRoles.sol";

interface IMockMintableERC20 {
    function mint(address to, uint256 amount) external;
    function decimals() external view returns (uint8);
}

/**
 * @title MockSwapRouter
 * @notice Mock Uniswap V3 SwapRouter for sandbox local devnet (Anvil) and testing.
 *         Executes real ERC20 swaps enforcing deadline and slippage bounds.
 *         WARNING: TEST FIXTURE ONLY - NEVER DEPLOY TO MAINNET.
 */
contract MockSwapRouter is ISwapRouter, AccessControl {
    using SafeERC20 for IERC20;

    address public immutable usdcToken;
    address public immutable wbtcToken;
    address public immutable wethToken;

    uint256 public btcPriceUsd = 60000;
    uint256 public ethPriceUsd = 3000;

    event PricesUpdated(uint256 btcPriceUsd, uint256 ethPriceUsd);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    constructor(address _usdcToken, address _wbtcToken, address _wethToken, address _initialOwner) {
        if (_usdcToken == address(0) || _wbtcToken == address(0) || _wethToken == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        usdcToken = _usdcToken;
        wbtcToken = _wbtcToken;
        wethToken = _wethToken;

        address admin = (_initialOwner != address(0)) ? _initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
    }

    function setPrices(uint256 _btcPriceUsd, uint256 _ethPriceUsd) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_btcPriceUsd == 0 || _ethPriceUsd == 0) revert IProtocolErrors.InvalidPrice();
        btcPriceUsd = _btcPriceUsd;
        ethPriceUsd = _ethPriceUsd;
        emit PricesUpdated(_btcPriceUsd, _ethPriceUsd);
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        if (params.amountIn == 0) revert IProtocolErrors.ZeroAmount();
        if (params.deadline != 0 && block.timestamp > params.deadline) {
            revert IProtocolErrors.InvalidParameters();
        }

        // 1. Pull tokenIn from recipient (AlphaVault) or sender
        address payer = (params.recipient != address(0)
                && IERC20(params.tokenIn).allowance(params.recipient, address(this)) >= params.amountIn)
            ? params.recipient
            : msg.sender;
        IERC20(params.tokenIn).safeTransferFrom(payer, address(this), params.amountIn);

        // 2. Compute amountOut based on token pair
        if (params.tokenIn == usdcToken && params.tokenOut == wbtcToken) {
            // USDC (6 dec) -> WBTC (8 dec) @ $60,000
            amountOut = (params.amountIn * 10 ** 8) / (btcPriceUsd * 10 ** 6);
        } else if (params.tokenIn == usdcToken && params.tokenOut == wethToken) {
            // USDC (6 dec) -> WETH (18 dec) @ $3,000
            amountOut = (params.amountIn * 10 ** 18) / (ethPriceUsd * 10 ** 6);
        } else if (params.tokenIn == wbtcToken && params.tokenOut == usdcToken) {
            // WBTC (8 dec) -> USDC (6 dec) @ $60,000
            amountOut = (params.amountIn * btcPriceUsd * 10 ** 6) / 10 ** 8;
        } else if (params.tokenIn == wethToken && params.tokenOut == usdcToken) {
            // WETH (18 dec) -> USDC (6 dec) @ $3,000
            amountOut = (params.amountIn * ethPriceUsd * 10 ** 6) / 10 ** 18;
        } else {
            // 1:1 fallback for equal decimal mock pairs
            amountOut = params.amountIn;
        }

        // 3. Enforce slippage bounds
        if (amountOut < params.amountOutMinimum) {
            revert IProtocolErrors.SlippageExceeded(params.amountOutMinimum, amountOut);
        }

        // 4. Deliver tokenOut to recipient
        uint256 routerBal = IERC20(params.tokenOut).balanceOf(address(this));
        if (routerBal >= amountOut) {
            IERC20(params.tokenOut).safeTransfer(params.recipient, amountOut);
        } else {
            // Mint if mock token allows minting
            try IMockMintableERC20(params.tokenOut).mint(params.recipient, amountOut) {
                // Mock tokens minted
            } catch {
                if (routerBal > 0) {
                    IERC20(params.tokenOut).safeTransfer(params.recipient, routerBal);
                }
            }
        }
    }

    /**
     * @notice Rescues erroneously transferred tokens.
     */
    function sweepTokens(address token, address to, uint256 amount) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit TokensSwept(token, to, amount);
    }
}
