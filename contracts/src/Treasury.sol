// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ITreasury.sol";
import "./interfaces/IAggregatorV3.sol";
import "./interfaces/ICircuitBreaker.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./GovernanceStaking.sol";
import "./RealYieldRouter.sol";

interface IVestedDiscountVault {
    function totalInvested() external view returns (uint256);
    function totalPresentLiability() external view returns (uint256);
}

interface IGovernanceStaking {
    function totalStaked() external view returns (uint256);
    function totalRewardBalance() external view returns (uint256);
}

interface IP2PLendingMarket {
    function totalActiveLoansReceivableUSD() external view returns (uint256);
    function totalEscrowedCollateralUSD() external view returns (uint256);
}

/**
 * @title Treasury
 * @notice Manages asset allocation weights, NAV valuation, direct redemption, and deposits.
 */
contract Treasury is ITreasury, ERC20, Ownable, ReentrancyGuard {
    AssetWeights public currentWeights;

    // Tracked assets & price feeds
    address[] public trackedAssets;
    mapping(address => address) public priceFeeds;
    mapping(address => uint8) public assetDecimals;

    // Stablecoin used for user redemptions & deposits (e.g. USDC)
    address public redemptionToken;
    uint8 public redemptionTokenDecimals;

    // Safety check threshold to detect stale oracles (default to 365 days for Sandbox)
    uint256 public oracleStalenessLimit = 365 days;

    // Sandbox Capped Vault TVL Cap (Default 50M USD)
    uint256 public tvlCap = 50_000_000 * 10**18;

    event ProofOfReservesAudited(uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps, uint256 timestamp);
    event TvlCapUpdated(uint256 newCap);

    constructor(
        address _initialOwner,
        address _redemptionToken,
        uint8 _redemptionTokenDecimals
    ) ERC20("Alpha Centauri Shares", "ALPHA") Ownable() {
        redemptionToken = _redemptionToken;
        redemptionTokenDecimals = _redemptionTokenDecimals;

        // Initialize target weights: Stables (50%), WBTC (25%), WETH (12.5%), Native ALPHA Staking (12.5%)
        currentWeights = AssetWeights({
            stablecoins: 50_00,
            wbtc: 25_00,
            weth: 12_50,
            alphaProtocolStaking: 12_50
        });

        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    /**
     * @notice Updates the oracle price feed staleness check limit. Restricted to owner.
     */
    function setOracleStalenessLimit(uint256 limit) external onlyOwner {
        oracleStalenessLimit = limit;
    }

    /**
     * @notice Adds or updates an asset tracking config.
     */
    function setTrackedAsset(
        address asset,
        address feed,
        uint8 decimals_
    ) external onlyOwner {
        require(asset != address(0), "Treasury: Zero asset");
        require(feed != address(0), "Treasury: Zero feed");
        
        if (priceFeeds[asset] == address(0)) {
            trackedAssets.push(asset);
        }
        priceFeeds[asset] = feed;
        assetDecimals[asset] = decimals_;
    }

    address public vestedVault;
    address public p2pMarket;
    address public realYieldRouter;
    address public governanceStaking;
    address public opsWallet;
    address public corporateRevenueWallet;
    address public circuitBreaker;

    function setCircuitBreaker(address _circuitBreaker) external onlyOwner {
        circuitBreaker = _circuitBreaker;
    }

    function setProtocolModules(
        address _vestedVault, 
        address _p2pMarket, 
        address _realYieldRouter, 
        address _governanceStaking,
        address _opsWallet,
        address _corporateRevenueWallet
    ) external onlyOwner {
        require(_vestedVault != address(0), "Treasury: Zero vestedVault");
        require(_p2pMarket != address(0), "Treasury: Zero p2pMarket");
        require(_realYieldRouter != address(0), "Treasury: Zero realYieldRouter");
        require(_governanceStaking != address(0), "Treasury: Zero governanceStaking");
        vestedVault = _vestedVault;
        p2pMarket = _p2pMarket;
        realYieldRouter = _realYieldRouter;
        governanceStaking = _governanceStaking;
        opsWallet = _opsWallet;
        corporateRevenueWallet = _corporateRevenueWallet;
    }

    /**
     * @notice Allows VestedDiscountVault to request reimbursement payouts upon ragequit/maturity.
     */
    function releaseVaultPayout(address to, uint256 amount) external nonReentrant {
        require(msg.sender == vestedVault, "Treasury: Only VestedVault can trigger payout");
        require(IERC20(redemptionToken).transfer(to, amount), "Treasury: Payout transfer failed");
    }

    /**
     * @notice Allows users to deposit stablecoins to mint native shares (0.5% entry fee split: 50% Treasury Reserves, 25% Ops, 25% Corporate Revenue).
     */
    function deposit(uint256 stableAmount) external nonReentrant returns (uint256 sharesMinted) {
        require(stableAmount > 0, "Treasury: Deposit amount must be > 0");

        // Auto-pause deposits if CircuitBreaker has frozen the asset
        if (circuitBreaker != address(0)) {
            require(!ICircuitBreaker(circuitBreaker).isFrozen(redemptionToken), "Treasury: Circuit breaker active for deposit asset");
        }

        // TVL Cap: prevent deposits that would exceed the sandbox/production cap
        uint256 currentTVL = IERC20(redemptionToken).balanceOf(address(this));
        require(currentTVL + stableAmount <= tvlCap, "Treasury: TVL cap exceeded");

        // 1. Measure NAV and total shares BEFORE new deposit funds arrive
        uint256 navBefore = getNAV();
        uint256 currentShares = totalSupply();

        // 2. Measure contract balance before transfer to handle fee-on-transfer tokens
        uint256 balanceBefore = IERC20(redemptionToken).balanceOf(address(this));

        // 3. Transfer stablecoin from user to this contract
        require(IERC20(redemptionToken).transferFrom(msg.sender, address(this), stableAmount), "Treasury: stablecoin transferFrom failed");

        uint256 balanceAfter = IERC20(redemptionToken).balanceOf(address(this));
        uint256 actualDeposited = balanceAfter - balanceBefore;
        require(actualDeposited > 0, "Treasury: Actual deposited amount is 0");

        // 4. 0.5% Deposit Entry Fee Split (50% Treasury Reserves, 25% Ops, 25% Corporate Revenue)
        uint256 feeAmount = (actualDeposited * 50) / 10000;
        uint256 treasuryReserveShare = feeAmount / 2; // 50% retained for Treasury reserves
        uint256 opsShare = feeAmount / 4;            // 25% for Operational Expenses
        uint256 corpRevenueShare = feeAmount - treasuryReserveShare - opsShare; // 25% for Corporate Revenue

        uint256 netDeposited = actualDeposited - feeAmount;

        if (opsShare > 0 && opsWallet != address(0)) {
            require(IERC20(redemptionToken).transfer(opsWallet, opsShare), "Treasury: Ops fee transfer failed");
        }
        if (corpRevenueShare > 0 && corporateRevenueWallet != address(0)) {
            require(IERC20(redemptionToken).transfer(corporateRevenueWallet, corpRevenueShare), "Treasury: Corp fee transfer failed");
        }

        // 5. Calculate deposit value in 18 decimals using net deposited amount
        uint256 depositValueUSD = netDeposited * (10**(18 - redemptionTokenDecimals));

        // 6. Calculate user's shares based on pre-deposit NAV and shares
        if (currentShares == 0 || navBefore == 0) {
            sharesMinted = depositValueUSD;
        } else {
            sharesMinted = (depositValueUSD * currentShares) / navBefore;
        }

        // 7. Mint net shares to user
        _mint(msg.sender, sharesMinted);

        return sharesMinted;
    }

    /**
     * @inheritdoc ITreasury
     */
    function redeem(uint256 sharesAmount) external override nonReentrant returns (uint256 assetsReceived) {
        require(sharesAmount > 0, "Treasury: Redeeming 0 shares");
        uint256 totalShares = totalSupply();
        require(totalShares > 0, "Treasury: No shares exist");

        // 1. Calculate NAV share price value in 18 decimals
        uint256 nav = getNAV();
        uint256 grossAssetValueUSD = (sharesAmount * nav) / totalShares;
        
        // 2. Charge 1% processing fee
        uint256 feeUSD = grossAssetValueUSD / 100;
        uint256 netValueUSD = grossAssetValueUSD - feeUSD;
        
        // 3. Convert 18 decimals USD value to redemption stablecoin decimals
        assetsReceived = netValueUSD / (10**(18 - redemptionTokenDecimals));
        uint256 feeCharged = feeUSD / (10**(18 - redemptionTokenDecimals));

        // 4. Burn shares and transfer stablecoins
        _burn(msg.sender, sharesAmount);
        require(IERC20(redemptionToken).transfer(msg.sender, assetsReceived), "Treasury: stablecoin transfer failed");

        emit Redeemed(msg.sender, sharesAmount, assetsReceived, feeCharged);
        return assetsReceived;
    }

    /**
     * @notice Disburses a Treasury reserve loan (up to 20% max of total reserves) to P2PLendingMarket.
     *         Enforces strict 20% max reserve lending cap on active receivables.
     */
    function disburseTreasuryLoan(address recipient, uint256 amount) external nonReentrant {
        require(msg.sender == owner() || msg.sender == p2pMarket, "Treasury: Only owner or P2PMarket");
        require(recipient != address(0), "Treasury: Invalid recipient");
        require(amount > 0, "Treasury: Loan amount must be > 0");

        (uint256 totalAssetsUSD, , ) = getProofOfReserves();
        uint256 mult = (10**(18 - redemptionTokenDecimals));
        uint256 maxLendableUSD = (totalAssetsUSD * 2000) / 10000; // 20.00% max of total reserves

        uint256 currentReceivablesUSD = 0;
        if (p2pMarket != address(0) && p2pMarket.code.length > 0) {
            currentReceivablesUSD = IP2PLendingMarket(p2pMarket).totalActiveLoansReceivableUSD() * mult;
        }

        uint256 newLoanUSD = amount * mult;
        require(currentReceivablesUSD + newLoanUSD <= maxLendableUSD, "Treasury: 20% max reserve lending cap exceeded");

        uint256 liquidBalance = IERC20(redemptionToken).balanceOf(address(this));
        require(liquidBalance >= amount, "Treasury: Insufficient liquid USDC reserves for loan disbursement");

        require(IERC20(redemptionToken).transfer(recipient, amount), "Treasury: Reserve loan disbursement failed");
    }

    /**
     * @notice Processes 1% staking entry fee ALPHA tokens transferred from GovernanceStaking.
     *         Burns the fee ALPHA tokens (deflationary / NAV-accretive) and transfers equivalent
     *         USDC value to RealYieldRouter for 50/25/25 Real Yield Flywheel distribution.
     */
    function processStakingFee(uint256 feeShares) external nonReentrant {
        require(msg.sender == governanceStaking, "Treasury: Only GovernanceStaking");
        if (feeShares == 0) return;

        // 1. Burn fee ALPHA shares held by Treasury
        _burn(address(this), feeShares);

        // 2. Calculate equivalent USDC value at current NAV
        uint256 nav = getNAV();
        uint256 totalShares = totalSupply();
        if (totalShares == 0 || nav == 0) return;

        uint256 feeUSD = (feeShares * nav) / totalShares;
        uint256 feeUSDC = feeUSD / (10**(18 - redemptionTokenDecimals));

        uint256 treasuryBal = IERC20(redemptionToken).balanceOf(address(this));
        if (feeUSDC > treasuryBal) feeUSDC = treasuryBal;

        // 3. Transfer USDC fee to RealYieldRouter for 50/25/25 flywheel distribution
        if (feeUSDC > 0 && realYieldRouter != address(0)) {
            require(IERC20(redemptionToken).transfer(realYieldRouter, feeUSDC), "Treasury: Fee payout failed");
            if (realYieldRouter.code.length > 0) {
                try RealYieldRouter(realYieldRouter).notifyYield(feeUSDC) {} catch {}
            }
        }
    }

    /**
     * @inheritdoc ITreasury
     */
    function getNAV() public view override returns (uint256) {
        uint256 totalNAV = 0;
        uint256 count = trackedAssets.length;
        
        for (uint256 i = 0; i < count; i++) {
            address asset = trackedAssets[i];
            address feed = priceFeeds[asset];
            uint8 decs = assetDecimals[asset];
            
            if (feed != address(0)) {
                totalNAV += getAssetValue(asset, feed, decs);
            }
        }
        
        // Return 0 when no assets are tracked (prevents first-depositor inflation attack via NAV=1)
        return totalNAV;
    }

    /**
     * @notice Helper to calculate the USD value of an asset in 18 decimals using Chainlink.
     */
    function getAssetValue(
        address asset,
        address feed,
        uint8 decimals_
    ) public view returns (uint256) {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        if (balance == 0) return 0;
        
        (, int256 price, , uint256 updatedAt, ) = IAggregatorV3(feed).latestRoundData();
        require(price > 0, "Treasury: Invalid price feedback");
        require(block.timestamp - updatedAt <= oracleStalenessLimit, "Treasury: Stale price feed");
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 usdPrice = uint256(price);
        uint8 feedDecimals = IAggregatorV3(feed).decimals();
        
        uint256 combinedDecimals = uint256(decimals_) + uint256(feedDecimals);
        if (combinedDecimals <= 18) {
            return balance * usdPrice * (10**(18 - combinedDecimals));
        } else {
            return (balance * usdPrice) / (10**(combinedDecimals - 18));
        }
    }

    /**
     * @inheritdoc ITreasury
     */
    function getAssetBalance(address asset) external view override returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    /**
     * @inheritdoc ITreasury
     */
    function validateSanityBounds() public view override returns (bool) {
        uint256 total = currentWeights.stablecoins +
            currentWeights.wbtc +
            currentWeights.weth +
            currentWeights.alphaProtocolStaking;
            
        if (total != 100_00) return false;

        bool stablesOk = currentWeights.stablecoins >= 40_00 && currentWeights.stablecoins <= 60_00;
        bool wbtcOk = currentWeights.wbtc >= 20_00 && currentWeights.wbtc <= 30_00;
        bool wethOk = currentWeights.weth >= 10_00 && currentWeights.weth <= 15_00;
        bool alphaOk = currentWeights.alphaProtocolStaking >= 5_00 && currentWeights.alphaProtocolStaking <= 15_00;

        return stablesOk && wbtcOk && wethOk && alphaOk;
    }

    /**
     * @notice Rebalances portfolio weights on-chain. Restricted to owner.
     */
    function rebalance() external override onlyOwner {
        require(validateSanityBounds(), "Treasury: Current configuration violates bounds");
        emit Rebalanced(block.timestamp);
    }

    /**
     * @notice Updates portfolio allocation targets.
     */
    function adjustWeights(AssetWeights calldata newWeights) external onlyOwner {
        currentWeights = newWeights;
        require(validateSanityBounds(), "Treasury: Adjusted weights exceed safety limits");
        emit WeightsAdjusted(newWeights);
    }

    /**
     * @notice Updates the TVL cap for the Treasury.
     */
    function setTvlCap(uint256 cap) external onlyOwner {
        tvlCap = cap;
        emit TvlCapUpdated(cap);
    }

    /**
     * @notice View-only Proof of Reserves calculation (no event emitted, safe for polling).
     */
    function getProofOfReserves() public view returns (uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps) {
        uint256 treasuryNav = getNAV();
        uint256 mult = (10**(18 - redemptionTokenDecimals));

        uint256 vaultBal = vestedVault != address(0) ? IERC20(redemptionToken).balanceOf(vestedVault) * mult : 0;
        uint256 p2pBal = p2pMarket != address(0) ? IERC20(redemptionToken).balanceOf(p2pMarket) * mult : 0;
        uint256 yieldBal = realYieldRouter != address(0) ? IERC20(redemptionToken).balanceOf(realYieldRouter) * mult : 0;

        // Native ALPHA Staking asset value = staked ALPHA tokens valued at current NAV per share
        // + USDC rewards accumulated in the pool.
        uint256 stakedAlphaValue = 0;
        uint256 stakingRewardBal = 0;
        if (governanceStaking != address(0) && governanceStaking.code.length > 0) {
            uint256 totalGovStakedTokens = balanceOf(governanceStaking);
            if (totalGovStakedTokens == 0) {
                try IGovernanceStaking(governanceStaking).totalStaked() returns (uint256 staked) {
                    totalGovStakedTokens = staked;
                } catch {}
            }
            uint256 supply = totalSupply();
            if (supply > 0 && totalGovStakedTokens > 0) {
                stakedAlphaValue = (totalGovStakedTokens * treasuryNav) / supply;
            }
            try IGovernanceStaking(governanceStaking).totalRewardBalance() returns (uint256 rBal) {
                stakingRewardBal = rBal * mult;
            } catch {
                stakingRewardBal = IERC20(redemptionToken).balanceOf(governanceStaking) * mult;
            }
        }

        uint256 p2pActiveReceivables = 0;
        uint256 p2pEscrowCollateral = 0;
        if (p2pMarket != address(0) && p2pMarket.code.length > 0) {
            try IP2PLendingMarket(p2pMarket).totalActiveLoansReceivableUSD() returns (uint256 rec) {
                p2pActiveReceivables = rec * mult;
            } catch {}
            try IP2PLendingMarket(p2pMarket).totalEscrowedCollateralUSD() returns (uint256 col) {
                p2pEscrowCollateral = col * mult;
            } catch {}
        }

        uint256 unencumberedP2pBal = p2pBal > p2pEscrowCollateral ? p2pBal - p2pEscrowCollateral : 0;

        // NOTE: opsWallet and corporateRevenueWallet are NOT included in protocol assets.
        // Those wallets are external and not under protocol custody — including them
        // would inflate PoR with funds the protocol does not control.
        totalAssetsUSD = treasuryNav + vaultBal + unencumberedP2pBal + p2pActiveReceivables + yieldBal + stakingRewardBal;
        
        // Total Liabilities = Native ALPHA Shares outstanding + Vested Vault NPV obligations
        uint256 vaultLiabilities = 0;
        if (vestedVault != address(0) && vestedVault.code.length > 0) {
            try IVestedDiscountVault(vestedVault).totalPresentLiability() returns (uint256 liability) {
                vaultLiabilities = liability * mult;
            } catch {
                try IVestedDiscountVault(vestedVault).totalInvested() returns (uint256 inv) {
                    vaultLiabilities = inv * mult;
                } catch {}
            }
        }

        totalLiabilitiesUSD = totalSupply() + vaultLiabilities;

        if (totalLiabilitiesUSD == 0) {
            collateralRatioBps = 10000; // 100.00%
        } else {
            collateralRatioBps = (totalAssetsUSD * 10000) / totalLiabilitiesUSD;
        }
    }

    /**
     * @notice Writes an on-chain audit record (emits ProofOfReservesAudited event). Restricted to owner.
     *         For polling/reading use getProofOfReserves() instead.
     */
    function auditProofOfReserves() external onlyOwner returns (uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps) {
        (totalAssetsUSD, totalLiabilitiesUSD, collateralRatioBps) = getProofOfReserves();
        emit ProofOfReservesAudited(totalAssetsUSD, totalLiabilitiesUSD, collateralRatioBps, block.timestamp);
    }

    /**
     * @notice Returns a per-asset USD breakdown for the Proof of Reserves dashboard.
     *         Values are in 18-decimal USD.
     * @return stablesBal    Treasury USDC/stablecoin balance (USD 18-dec)
     * @return wbtcBal       Treasury WBTC balance valued in USD
     * @return wethBal       Treasury WETH balance valued in USD
     * @return alphaStakingBal  Staked ALPHA tokens valued at NAV + staking reward pool
     */
    function getAssetBreakdown() external view returns (
        uint256 stablesBal,
        uint256 wbtcBal,
        uint256 wethBal,
        uint256 alphaStakingBal
    ) {
        uint256 mult = (10**(18 - redemptionTokenDecimals));

        // 1. Stablecoins Breakdown
        {
            uint256 vaultBal = vestedVault != address(0) ? IERC20(redemptionToken).balanceOf(vestedVault) * mult : 0;
            uint256 p2pBal = p2pMarket != address(0) ? IERC20(redemptionToken).balanceOf(p2pMarket) * mult : 0;
            uint256 yieldBal = realYieldRouter != address(0) ? IERC20(redemptionToken).balanceOf(realYieldRouter) * mult : 0;

            uint256 p2pActiveRec = 0;
            uint256 p2pEscrow = 0;
            if (p2pMarket != address(0) && p2pMarket.code.length > 0) {
                try IP2PLendingMarket(p2pMarket).totalActiveLoansReceivableUSD() returns (uint256 rec) {
                    p2pActiveRec = rec * mult;
                } catch {}
                try IP2PLendingMarket(p2pMarket).totalEscrowedCollateralUSD() returns (uint256 col) {
                    p2pEscrow = col * mult;
                } catch {}
            }
            uint256 unencumberedP2pBal = p2pBal > p2pEscrow ? p2pBal - p2pEscrow : 0;

            stablesBal = (IERC20(redemptionToken).balanceOf(address(this)) * mult) + vaultBal + unencumberedP2pBal + p2pActiveRec + yieldBal;
        }

        // 2. WBTC and WETH Breakdown
        {
            for (uint256 i = 0; i < trackedAssets.length; i++) {
                address asset = trackedAssets[i];
                if (asset == redemptionToken) continue;
                address feed = priceFeeds[asset];
                if (feed == address(0)) continue;
                uint256 val = getAssetValue(asset, feed, assetDecimals[asset]);
                if (wbtcBal == 0) {
                    wbtcBal = val;
                } else if (wethBal == 0) {
                    wethBal = val;
                }
            }
        }

        // 3. Staking Breakdown
        {
            uint256 totalShares = totalSupply();
            uint256 nav = getNAV();
            if (governanceStaking != address(0) && governanceStaking.code.length > 0) {
                uint256 totalGovStakedTokens = balanceOf(governanceStaking);
                if (totalGovStakedTokens == 0) {
                    try IGovernanceStaking(governanceStaking).totalStaked() returns (uint256 staked) {
                        totalGovStakedTokens = staked;
                    } catch {}
                }
                if (totalShares > 0 && totalGovStakedTokens > 0) {
                    alphaStakingBal += (totalGovStakedTokens * nav) / totalShares;
                }
                try IGovernanceStaking(governanceStaking).totalRewardBalance() returns (uint256 rBal) {
                    alphaStakingBal += rBal * mult;
                } catch {
                    alphaStakingBal += IERC20(redemptionToken).balanceOf(governanceStaking) * mult;
                }
            }
        }
    }
}
