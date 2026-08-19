// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IAtomicSwapReceiver.sol";
import "./interfaces/ISwapRouter.sol";
import "./interfaces/IProtocolErrors.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";

/**
 * @title AtomicSwapReceiver
 * @notice Accepts USDT deposits and atomically swaps them to USDC via Uniswap V3.
 */
contract AtomicSwapReceiver is IAtomicSwapReceiver, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public immutable usdtToken;
    address public immutable usdcToken;
    address public immutable swapRouter;
    address public treasury;

    constructor(address _usdtToken, address _usdcToken, address _swapRouter, address _treasury, address _initialOwner) {
        usdtToken = _usdtToken;
        usdcToken = _usdcToken;
        swapRouter = _swapRouter;
        treasury = _treasury;

        address admin = (_initialOwner != address(0)) ? _initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
    }

    /**
     * @notice Updates the treasury address. Restricted to owner.
     */
    function setTreasury(address _treasury) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_treasury == address(0)) revert IProtocolErrors.ZeroAddress();
        treasury = _treasury;
    }

    /**
     * @inheritdoc IAtomicSwapReceiver
     */
    function depositUSDT(uint256 usdtAmount, uint256 minUsdcExpected)
        external
        override
        nonReentrant
        returns (uint256 usdcDeposited)
    {
        if (usdtAmount == 0) revert IProtocolErrors.ZeroAmount();
        if (treasury == address(0)) revert IProtocolErrors.ZeroAddress();

        // Enforce maximum 0.05% slippage check on-chain (USDT -> USDC)
        uint256 maxSlippageLimit = (usdtAmount * 9995) / 10000;
        if (minUsdcExpected < maxSlippageLimit) {
            revert IProtocolErrors.SlippageExceeded(maxSlippageLimit, minUsdcExpected);
        }

        // 1. Pull USDT from sender to this contract
        IERC20(usdtToken).safeTransferFrom(msg.sender, address(this), usdtAmount);

        // 2. Approve SwapRouter to spend USDT
        if (!IERC20(usdtToken).approve(swapRouter, usdtAmount)) {
            revert IProtocolErrors.ApproveFailed();
        }

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
        IERC20(usdcToken).safeTransfer(treasury, usdcDeposited);

        emit AtomicSwapExecuted(msg.sender, usdtAmount, usdcDeposited, 0);
        return usdcDeposited;
    }
}
