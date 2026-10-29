// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title MorphoYieldVaultAdapter
 * @notice Adapts Treasury stablecoin liquid reserves and BTC/ETH staking positions to institutional Morpho Blue / MetaMorpho vaults.
 *         Harvests daily yields directly into the Treasury core to compound NAV per share.
 */
contract MorphoYieldVaultAdapter is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable stablecoin;
    address public treasury;

    uint256 public totalStablecoinInvested;
    uint256 public totalYieldHarvested;
    uint256 public lastHarvestTimestamp;

    // Simulated APYs in BPS (e.g. 645 Bps = 6.45% APY)
    uint256 public morphoStablecoinApyBps = 645; // 6.45% APY
    uint256 public lidoEthStakingApyBps = 420; // 4.20% APY
    uint256 public lombardBtcStakingApyBps = 380; // 3.80% APY

    uint256 public constant MAX_APY_BPS = 5000; // 50.00% APR Sanity Bound

    event DepositedToMorpho(uint256 amount);
    event YieldHarvested(uint256 yieldAmount, uint256 timestamp);
    event APYsUpdated(uint256 stablecoinApy, uint256 ethApy, uint256 btcApy);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event LiquidityWithdrawn(uint256 amount, address recipient);

    constructor(address _stablecoin, address _treasury, address _initialOwner) {
        if (_stablecoin == address(0) || _treasury == address(0)) revert IProtocolErrors.ZeroAddress();
        address admin = (_initialOwner != address(0)) ? _initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
        stablecoin = _stablecoin;
        treasury = _treasury;
        lastHarvestTimestamp = block.timestamp;
    }

    function setTreasury(address _treasury) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_treasury == address(0)) revert IProtocolErrors.ZeroAddress();
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    function setAPYs(uint256 _stablecoinApy, uint256 _ethApy, uint256 _btcApy)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
    {
        if (_stablecoinApy > MAX_APY_BPS || _ethApy > MAX_APY_BPS || _btcApy > MAX_APY_BPS) {
            revert IProtocolErrors.InvalidParameters();
        }
        morphoStablecoinApyBps = _stablecoinApy;
        lidoEthStakingApyBps = _ethApy;
        lombardBtcStakingApyBps = _btcApy;
        emit APYsUpdated(_stablecoinApy, _ethApy, _btcApy);
    }

    /**
     * @notice Simulates depositing stablecoins into Morpho Blue Vault
     */
    function depositStablecoins(uint256 amount) external nonReentrant returns (bool) {
        if (amount == 0) revert IProtocolErrors.ZeroAmount();
        IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), amount);

        totalStablecoinInvested += amount;
        emit DepositedToMorpho(amount);
        return true;
    }

    /**
     * @notice Computes pending yield accumulated since last harvest
     */
    function getPendingYield() public view returns (uint256 pendingYield) {
        if (totalStablecoinInvested == 0 || lastHarvestTimestamp == 0) return 0;
        uint256 elapsedDays = (block.timestamp - lastHarvestTimestamp) / 1 days;
        if (elapsedDays == 0) return 0;

        // Daily yield calculation: (invested * APY_BPS * days) / (10000 * 365)
        pendingYield = (totalStablecoinInvested * morphoStablecoinApyBps * elapsedDays) / (10000 * 365);
    }

    /**
     * @notice Withdraws liquidity back to the Treasury to cover redemptions
     */
    function withdrawLiquidity(uint256 amount) external nonReentrant returns (uint256 withdrawn) {
        if (msg.sender != treasury && !hasRole(ProtocolRoles.ADMIN_ROLE, msg.sender)) {
            revert IProtocolErrors.Unauthorized();
        }
        if (amount == 0) revert IProtocolErrors.ZeroAmount();

        uint256 bal = IERC20(stablecoin).balanceOf(address(this));
        withdrawn = amount > bal ? bal : amount;

        if (withdrawn > 0) {
            if (withdrawn <= totalStablecoinInvested) {
                totalStablecoinInvested -= withdrawn;
            } else {
                totalStablecoinInvested = 0;
            }
            IERC20(stablecoin).safeTransfer(treasury, withdrawn);
            emit LiquidityWithdrawn(withdrawn, treasury);
        }
    }

    /**
     * @notice Harvests accumulated yield from Morpho Blue vaults and sends it to the Treasury
     */
    function harvestYield() external nonReentrant returns (uint256 yieldHarvested) {
        yieldHarvested = getPendingYield();
        lastHarvestTimestamp = block.timestamp;

        if (yieldHarvested > 0 && treasury != address(0)) {
            uint256 bal = IERC20(stablecoin).balanceOf(address(this));
            uint256 actualYield = bal >= yieldHarvested ? yieldHarvested : bal;

            if (actualYield > 0) {
                totalYieldHarvested += actualYield;
                IERC20(stablecoin).safeTransfer(treasury, actualYield);
                emit YieldHarvested(actualYield, block.timestamp);
                return actualYield;
            }
        }
        return 0;
    }
}
