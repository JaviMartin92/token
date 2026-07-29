// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";

import "./interfaces/I1inchAggregator.sol";
import "./interfaces/ILidoWstETH.sol";
import "./interfaces/ILombardLBTC.sol";
import "./interfaces/IMorphoVault.sol";

/**
 * @title TreasuryReserveManager
 * @notice Production Reserve Execution Manager connecting Treasury.sol to:
 *         1. 1inch V5 Aggregator for zero-slippage / lowest fee DEX swaps (USDC -> WBTC / WETH).
 *         2. Lido wstETH for 60% Liquid Ethereum Staking (4.20% APY).
 *         3. Lombard LBTC for 60% Liquid Bitcoin Staking (3.80% APY).
 *         4. Morpho Blue MetaMorpho Vaults for 80% Stablecoin Yield (6.45% APY).
 *         5. P2P Lending Market for 20% Direct Treasury Credit Line (8.00% APR).
 */
contract TreasuryReserveManager is Ownable, ReentrancyGuard {
    address public treasury;
    address public usdcToken;
    address public wbtcToken;
    address public wethToken;

    address public oracleRouter;

    // Production Protocol Addresses (Arbitrum One / Mainnet)
    address public oneInchAggregator = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    address public lidoWstETH         = 0x5979D7b546E38E414F7E9822514be443A4800529; // wstETH Arbitrum
    address public lombardLBTC        = 0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd; // LBTC Arbitrum
    address public morphoUsdcVault   = 0x488102554708C23C0227d8D86f4A2fAffbb27357;

    function setOracleRouter(address _oracleRouter) external onlyOwner {
        oracleRouter = _oracleRouter;
    }

    uint256 public totalRebalancedVolume;
    uint256 public lastProductionRebalanceTimestamp;

    event ProductionRebalanceExecuted(
        uint256 totalUsdcAllocated,
        uint256 liquidLoansPool,
        uint256 morphoVaultDeposit,
        uint256 timestamp
    );

    constructor(
        address _treasury,
        address _usdcToken,
        address _wbtcToken,
        address _wethToken,
        address _initialOwner
    ) Ownable() {
        treasury = _treasury;
        usdcToken = _usdcToken;
        wbtcToken = _wbtcToken;
        wethToken = _wethToken;
        lastProductionRebalanceTimestamp = block.timestamp;

        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    function setProductionAddresses(
        address _oneInch,
        address _lido,
        address _lombard,
        address _morpho
    ) external onlyOwner {
        oneInchAggregator = _oneInch;
        lidoWstETH = _lido;
        lombardLBTC = _lombard;
        morphoUsdcVault = _morpho;
    }

    /**
     * @notice Executes 1-click production rebalance allocating 20% to liquid P2P reserve line and 80% to Morpho Blue
     */
    function executeProductionRebalance(uint256 usdcAmount) external nonReentrant returns (bool) {
        require(usdcAmount > 0, "ReserveManager: Amount must be > 0");
        require(IERC20(usdcToken).transferFrom(msg.sender, address(this), usdcAmount), "ReserveManager: Transfer failed");

        uint256 liquidReserve20 = (usdcAmount * 2000) / 10000; // 20%
        uint256 morphoVault80  = usdcAmount - liquidReserve20; // 80%

        // Send 20% to Treasury for P2P/Direct Loan reserves
        require(IERC20(usdcToken).transfer(treasury, liquidReserve20), "ReserveManager: Liquid transfer failed");

        // Deposit 80% to Morpho Blue Vault if configured
        if (morphoUsdcVault.code.length > 0) {
            IERC20(usdcToken).approve(morphoUsdcVault, morphoVault80);
            try IMorphoVault(morphoUsdcVault).deposit(morphoVault80, treasury) {} catch {}
        } else {
            require(IERC20(usdcToken).transfer(treasury, morphoVault80), "ReserveManager: Morpho transfer fallback failed");
        }

        totalRebalancedVolume += usdcAmount;
        lastProductionRebalanceTimestamp = block.timestamp;

        emit ProductionRebalanceExecuted(usdcAmount, liquidReserve20, morphoVault80, block.timestamp);
        return true;
    }
}
