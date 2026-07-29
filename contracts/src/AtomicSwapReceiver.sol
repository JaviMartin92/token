// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IAtomicSwapReceiver.sol";
import "./interfaces/ISwapRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";

/**
 * @title AtomicSwapReceiver
 * @notice Accepts USDT deposits and atomically swaps them to USDC via Uniswap V3.
 */
contract AtomicSwapReceiver is IAtomicSwapReceiver, Ownable, ReentrancyGuard {
    address public immutable usdtToken;
    address public immutable usdcToken;
    address public immutable swapRouter;
    address public treasury;

    constructor(
        address _usdtToken,
        address _usdcToken,
        address _swapRouter,
        address _treasury,
        address _initialOwner
    ) Ownable() {
        usdtToken = _usdtToken;
        usdcToken = _usdcToken;
        swapRouter = _swapRouter;
        treasury = _treasury;

        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    /**
     * @notice Updates the treasury address. Restricted to owner.
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "AtomicSwapReceiver: Zero address");
        treasury = _treasury;
    }

    /**
     * @inheritdoc IAtomicSwapReceiver
     */
    function depositUSDT(
        uint256 usdtAmount,
        uint256 minUsdcExpected
    ) external override nonReentrant returns (uint256 usdcDeposited) {
        require(usdtAmount > 0, "AtomicSwapReceiver: Deposit amount must be > 0");
        require(treasury != address(0), "AtomicSwapReceiver: Treasury not configured");

        // Enforce maximum 0.05% slippage check on-chain (USDT -> USDC)
        uint256 maxSlippageLimit = (usdtAmount * 9995) / 10000;
        require(minUsdcExpected >= maxSlippageLimit, "AtomicSwapReceiver: Slippage input exceeds 0.05% limit");

        // 1. Pull USDT from sender to this contract
        require(IERC20(usdtToken).transferFrom(msg.sender, address(this), usdtAmount), "AtomicSwapReceiver: USDT transferFrom failed");

        // 2. Approve SwapRouter to spend USDT
        require(IERC20(usdtToken).approve(swapRouter, usdtAmount), "AtomicSwapReceiver: USDT approve failed");

        // 3. Configure Uniswap swap parameters
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: usdtToken,
            tokenOut: usdcToken,
            fee: 100, // 0.01% fee pool (standard stablecoin pool fee)
            recipient: address(this),
            deadline: block.timestamp + 15 minutes,
            amountIn: usdtAmount,
            amountOutMinimum: minUsdcExpected,
            sqrtPriceLimitX96: 0
        });

        // 4. Execute atomic swap on Uniswap V3
        usdcDeposited = ISwapRouter(swapRouter).exactInputSingle(params);

        // 5. Transfer resulting USDC to Treasury
        require(IERC20(usdcToken).transfer(treasury, usdcDeposited), "AtomicSwapReceiver: USDC transfer failed");

        emit AtomicSwapExecuted(msg.sender, usdtAmount, usdcDeposited, 0);
        return usdcDeposited;
    }
}
