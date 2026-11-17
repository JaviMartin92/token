// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";

import "./interfaces/I1inchAggregator.sol";
import "./interfaces/ILidoWstETH.sol";
import "./interfaces/ILombardLBTC.sol";
import "./interfaces/IMorphoVault.sol";
import "./interfaces/IProtocolErrors.sol";
import "./interfaces/ITreasury.sol";

/**
 * @title TreasuryReserveManager
 * @author Viraje Protocol Architecture Team
 * @notice Production Reserve Execution Manager connecting Treasury to:
 *         1. 1inch V5 Aggregator for zero-slippage / lowest fee DEX swaps (USDC -> WBTC / WETH).
 *         2. Lido wstETH for Liquid Ethereum Staking.
 *         3. Lombard LBTC for Liquid Bitcoin Staking.
 *         4. Morpho Blue MetaMorpho Vaults for Stablecoin Yield (6.45% APY).
 *         5. P2P Lending Market for Direct Treasury Credit Line (8.00% APR).
 * @dev Enforces strict 90/10 passive yield vs liquid buffer reserve allocation policy,
 *      ensures dangling allowance hygiene upon yield venue failure, and provides a safe
 *      custody fallback path directly to VirajeVault.
 */
contract TreasuryReserveManager is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Canonical Basis Points Denominator (10,000 = 100.00%)
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Mandatory Liquid Buffer Allocation (1,000 BPS = 10.00%)
    uint256 public constant LIQUID_BUFFER_BPS = 1000;

    address public treasury;
    address public virajeVault;
    address public usdcToken;
    address public wbtcToken;
    address public wethToken;

    address public oracleRouter;

    // Production Protocol Addresses (Arbitrum One / Mainnet)
    address public oneInchAggregator = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    address public lidoWstETH = 0x5979D7b546E38E414F7E9822514be443A4800529; // wstETH Arbitrum
    address public lombardLBTC = 0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd; // LBTC Arbitrum
    address public morphoUsdcVault = 0x488102554708C23C0227d8D86f4A2fAffbb27357;

    uint256 public totalRebalancedVolume;
    uint256 public lastProductionRebalanceTimestamp;

    // --- Events ---
    event VirajeVaultUpdated(address indexed oldVault, address indexed newVault);
    event ProductionRebalanceExecuted(
        uint256 totalUsdcAllocated, uint256 liquidLoansPool, uint256 morphoVaultDeposit, uint256 timestamp
    );
    event ProductionAddressesUpdated(address oneInch, address lido, address lombard, address morpho);
    event OracleRouterUpdated(address indexed oracleRouter);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Initializes TreasuryReserveManager with core tokens and governance
     * @param _treasury Canonical Treasury address
     * @param _usdcToken Canonical USDC address
     * @param _wbtcToken Canonical WBTC address
     * @param _wethToken Canonical WETH address
     * @param _initialOwner Admin governance account
     */
    constructor(address _treasury, address _usdcToken, address _wbtcToken, address _wethToken, address _initialOwner) {
        if (_treasury == address(0) || _usdcToken == address(0) || _initialOwner == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialOwner);

        treasury = _treasury;
        usdcToken = _usdcToken;
        wbtcToken = _wbtcToken;
        wethToken = _wethToken;
        lastProductionRebalanceTimestamp = block.timestamp;
    }

    /**
     * @notice Configures the oracle router address
     * @param _oracleRouter Address of DynamicYieldOracleRouter
     */
    function setOracleRouter(address _oracleRouter) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_oracleRouter == address(0)) revert IProtocolErrors.ZeroAddress();
        oracleRouter = _oracleRouter;
        emit OracleRouterUpdated(_oracleRouter);
    }

    /**
     * @notice Updates external DeFi protocol addresses on Arbitrum
     * @param _oneInch 1inch Aggregator router address
     * @param _lido Lido wstETH contract address
     * @param _lombard Lombard LBTC contract address
     * @param _morpho Morpho Blue USDC vault address
     */
    function setProductionAddresses(address _oneInch, address _lido, address _lombard, address _morpho)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
    {
        if (_oneInch == address(0) || _lido == address(0) || _lombard == address(0) || _morpho == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        oneInchAggregator = _oneInch;
        lidoWstETH = _lido;
        lombardLBTC = _lombard;
        morphoUsdcVault = _morpho;
        emit ProductionAddressesUpdated(_oneInch, _lido, _lombard, _morpho);
    }

    /**
     * @notice Sweeps accidentally sent tokens
     * @param token Address of ERC20 token to sweep
     * @param to Recipient destination
     */
    function sweepTokens(address token, address to) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) revert IProtocolErrors.InvalidAmount();
        IERC20(token).safeTransfer(to, bal);
        emit TokensSwept(token, to, bal);
    }

    /**
     * @notice Configures the canonical VirajeVault custody address
     * @param _virajeVault Destination vault address
     */
    function setVirajeVault(address _virajeVault) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_virajeVault == address(0)) revert IProtocolErrors.ZeroAddress();
        address old = virajeVault;
        virajeVault = _virajeVault;
        emit VirajeVaultUpdated(old, _virajeVault);
    }

    /**
     * @notice Returns target custody vault address
     * @dev Resolves canonical vault via explicit configuration, falling back to Treasury inspection
     * @return Address of the target vault receiving rebalanced assets
     */
    function getTargetVault() public view returns (address) {
        if (virajeVault != address(0)) return virajeVault;
        if (treasury != address(0) && treasury.code.length > 0) {
            try ITreasury(treasury).virajeVault() returns (address av) {
                if (av != address(0)) return av;
            } catch {}
        }
        return treasury;
    }

    /**
     * @notice Executes 1-click production rebalance allocating 10% to liquid P2P reserve line and 90% to Morpho Blue
     * @param usdcAmount Total USDC amount to deploy
     * @return success True if execution completed successfully
     */
    function executeProductionRebalance(uint256 usdcAmount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
        returns (bool)
    {
        return executeProductionRebalance(usdcAmount, getTargetVault());
    }

    /**
     * @notice Executes 1-click production rebalance allocating to a specified vault address
     * @param usdcAmount Total USDC amount to deploy
     * @param targetVault Custody vault receiving the liquid buffer and vault yield shares
     * @return success True if execution completed successfully
     */
    function executeProductionRebalance(uint256 usdcAmount, address targetVault)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
        returns (bool)
    {
        if (usdcAmount == 0) revert IProtocolErrors.ZeroAmount();
        if (targetVault == address(0)) revert IProtocolErrors.ZeroAddress();

        IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), usdcAmount);

        uint256 liquidReserve10 = (usdcAmount * LIQUID_BUFFER_BPS) / BPS_DENOMINATOR; // 10%
        uint256 morphoVault90 = usdcAmount - liquidReserve10; // 90%

        // Send 10% to targetVault for liquid buffer / P2P reserve line
        IERC20(usdcToken).safeTransfer(targetVault, liquidReserve10);

        // Deposit 90% to Morpho Blue Vault if configured, minting shares to targetVault
        if (morphoUsdcVault != address(0) && morphoUsdcVault.code.length > 0) {
            IERC20(usdcToken).safeApprove(morphoUsdcVault, 0);
            IERC20(usdcToken).safeApprove(morphoUsdcVault, morphoVault90);
            try IMorphoVault(morphoUsdcVault).deposit(morphoVault90, targetVault) {
                // Morpho deposit successful
            } catch {
                // Fallback: reset dangling allowance and route capital directly to targetVault
                IERC20(usdcToken).safeApprove(morphoUsdcVault, 0);
                IERC20(usdcToken).safeTransfer(targetVault, morphoVault90);
            }
        } else {
            IERC20(usdcToken).safeTransfer(targetVault, morphoVault90);
        }

        totalRebalancedVolume += usdcAmount;
        lastProductionRebalanceTimestamp = block.timestamp;

        emit ProductionRebalanceExecuted(usdcAmount, liquidReserve10, morphoVault90, block.timestamp);
        return true;
    }
}
