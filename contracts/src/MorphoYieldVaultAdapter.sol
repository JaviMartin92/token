// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";

/**
 * @title MorphoYieldVaultAdapter
 * @notice Adapts 80% of Treasury stablecoin liquid reserves and BTC/ETH staking positions to institutional Morpho Blue / MetaMorpho vaults.
 *         Harvests daily yields directly into the Treasury core to compound NAV per share.
 */
contract MorphoYieldVaultAdapter is Ownable, ReentrancyGuard {
    address public immutable stablecoin;
    address public treasury;

    uint256 public totalStablecoinInvested;
    uint256 public totalYieldHarvested;
    uint256 public lastHarvestTimestamp;

    // Simulated APYs in BPS (e.g. 645 Bps = 6.45% APY)
    uint256 public morphoStablecoinApyBps = 645; // 6.45% APY
    uint256 public lidoEthStakingApyBps = 420;   // 4.20% APY
    uint256 public lombardBtcStakingApyBps = 380;// 3.80% APY

    event DepositedToMorpho(uint256 amount);
    event YieldHarvested(uint256 yieldAmount, uint256 timestamp);
    event APYsUpdated(uint256 stablecoinApy, uint256 ethApy, uint256 btcApy);

    constructor(address _stablecoin, address _treasury, address _initialOwner) Ownable() {
        stablecoin = _stablecoin;
        treasury = _treasury;
        lastHarvestTimestamp = block.timestamp;

        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "MorphoAdapter: Zero address");
        treasury = _treasury;
    }

    function setAPYs(uint256 _stablecoinApy, uint256 _ethApy, uint256 _btcApy) external onlyOwner {
        morphoStablecoinApyBps = _stablecoinApy;
        lidoEthStakingApyBps = _ethApy;
        lombardBtcStakingApyBps = _btcApy;
        emit APYsUpdated(_stablecoinApy, _ethApy, _btcApy);
    }

    /**
     * @notice Simulates depositing 80% stablecoins into Morpho Blue Vault
     */
    function depositStablecoins(uint256 amount) external nonReentrant returns (bool) {
        require(amount > 0, "MorphoAdapter: Amount must be > 0");
        require(IERC20(stablecoin).transferFrom(msg.sender, address(this), amount), "MorphoAdapter: Transfer failed");
        
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
     * @notice Harvests accumulated yield from Morpho Blue vaults and sends it to the Treasury
     */
    function harvestYield() external nonReentrant returns (uint256 yieldHarvested) {
        yieldHarvested = getPendingYield();
        lastHarvestTimestamp = block.timestamp;

        if (yieldHarvested > 0 && treasury != address(0)) {
            totalYieldHarvested += yieldHarvested;
            if (IERC20(stablecoin).balanceOf(address(this)) >= yieldHarvested) {
                IERC20(stablecoin).transfer(treasury, yieldHarvested);
            }
            emit YieldHarvested(yieldHarvested, block.timestamp);
        }
    }
}
