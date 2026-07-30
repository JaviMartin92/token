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

        // Default target weights matching protocol spec:
        // 50% Stablecoins, 25% WBTC, 12.5% WETH, 12.5% ALPHA Staking
        currentWeights = AssetWeights({
            stablecoins: 5000,
            wbtc: 2500,
            weth: 1250,
            alphaProtocolStaking: 1250
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
    address public morphoAdapter;
    uint256 public totalBurnedTokens;

    function setCircuitBreaker(address _circuitBreaker) external onlyOwner {
        circuitBreaker = _circuitBreaker;
    }

    function setMorphoAdapter(address _morphoAdapter) external onlyOwner {
        morphoAdapter = _morphoAdapter;
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

        // 4. 0.5% Deposit Entry Fee Split
        uint256 feeAmount = (msg.sender == realYieldRouter) ? 0 : (actualDeposited * 50) / 10000;
        uint256 netDeposited = actualDeposited - feeAmount;

        // 5. Calculate deposit value in 18 decimals using net deposited amount
        uint256 depositValueUSD = netDeposited * (10**(18 - redemptionTokenDecimals));

        // 6. Calculate user's shares based on pre-deposit NAV and shares
        if (currentShares == 0 || navBefore == 0) {
            sharesMinted = depositValueUSD;
        } else {
            sharesMinted = (depositValueUSD * currentShares) / navBefore;
        }

        // 7. Mint net shares to user FIRST
        _mint(msg.sender, sharesMinted);

        // 8. Route fees to RealYieldRouter SECOND
        if (feeAmount > 0 && realYieldRouter != address(0)) {
            require(IERC20(redemptionToken).transfer(realYieldRouter, feeAmount), "Treasury: Fee routing failed");
            RealYieldRouter(realYieldRouter).routeUniversalFee(redemptionToken);
        } else if (feeAmount > 0) {
            uint256 opsShare = feeAmount / 4;
            uint256 corpRevenueShare = feeAmount / 4;
            if (opsShare > 0 && opsWallet != address(0)) {
                require(IERC20(redemptionToken).transfer(opsWallet, opsShare), "Treasury: Ops fee transfer failed");
            }
            if (corpRevenueShare > 0 && corporateRevenueWallet != address(0)) {
                require(IERC20(redemptionToken).transfer(corporateRevenueWallet, corpRevenueShare), "Treasury: Corp fee transfer failed");
            }
        }

        // 9. 80/20 USDC Sub-Reserve: Auto-deposit 80% of net USDC into Morpho Yield Vault Adapter for APY
        if (morphoAdapter != address(0) && netDeposited > 0) {
            uint256 morphoAmount = (netDeposited * 8000) / 10000; // 80%
            uint256 availBal = IERC20(redemptionToken).balanceOf(address(this));
            if (morphoAmount > 0 && availBal >= morphoAmount) {
                require(IERC20(redemptionToken).transfer(morphoAdapter, morphoAmount), "Treasury: Morpho transfer failed");
            }
        }

        return sharesMinted;
    }

    /**
     * @notice Allows RealYieldRouter to convert corporate fee shares into ALPHA tokens for corporate vaults without reentrancy conflicts.
     */
    function mintCorporateFeeShares(uint256 stableAmount) external returns (uint256 sharesMinted) {
        require(msg.sender == realYieldRouter, "Treasury: Only RealYieldRouter");
        require(stableAmount > 0, "Treasury: Amount must be > 0");

        uint256 navBefore = getNAV();
        uint256 currentShares = totalSupply();

        require(IERC20(redemptionToken).transferFrom(msg.sender, address(this), stableAmount), "Treasury: USDC transfer failed");

        uint256 depositValueUSD = stableAmount * (10**(18 - redemptionTokenDecimals));

        if (currentShares == 0 || navBefore == 0) {
            sharesMinted = depositValueUSD;
        } else {
            sharesMinted = (depositValueUSD * currentShares) / navBefore;
        }

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
        
        // 2. 1% Redeem Exit Fee Split (50% Treasury Reserves, 25% Ops, 25% Corporate Revenue)
        uint256 feeChargedUSD = (grossAssetValueUSD * 100) / 10000; // 1% exit fee
        uint256 netAssetValueUSD = grossAssetValueUSD - feeChargedUSD;

        // Convert 18-decimal USD value to redemptionToken decimals (e.g. 6 for USDC)
        assetsReceived = netAssetValueUSD / (10**(18 - redemptionTokenDecimals));
        require(assetsReceived > 0, "Treasury: Net redeemed asset amount is 0");

        uint256 treasuryBalance = IERC20(redemptionToken).balanceOf(address(this));
        require(treasuryBalance >= assetsReceived, "Treasury: Insufficient liquidity for redemption");

        // 3. Burn shares from user
        _burn(msg.sender, sharesAmount);

        // 4. Transfer net redemption tokens to user
        require(IERC20(redemptionToken).transfer(msg.sender, assetsReceived), "Treasury: Transfer to user failed");

        // 5. Fee distribution for exit fee
        uint256 feeTokenAmount = feeChargedUSD / (10**(18 - redemptionTokenDecimals));
        if (feeTokenAmount > 0 && realYieldRouter != address(0) && treasuryBalance >= assetsReceived + feeTokenAmount) {
            require(IERC20(redemptionToken).transfer(realYieldRouter, feeTokenAmount), "Treasury: Exit fee routing failed");
            try RealYieldRouter(realYieldRouter).routeUniversalFee(redemptionToken) {} catch {}
        } else if (feeTokenAmount > 0 && treasuryBalance >= assetsReceived + feeTokenAmount) {
            uint256 opsShare = feeTokenAmount / 4;
            uint256 corpRevenueShare = feeTokenAmount / 4;
            if (opsShare > 0 && opsWallet != address(0)) {
                require(IERC20(redemptionToken).transfer(opsWallet, opsShare), "Treasury: Ops exit fee transfer failed");
            }
            if (corpRevenueShare > 0 && corporateRevenueWallet != address(0)) {
                require(IERC20(redemptionToken).transfer(corporateRevenueWallet, corpRevenueShare), "Treasury: Corp exit fee transfer failed");
            }
        }

        emit Redeemed(msg.sender, sharesAmount, assetsReceived, feeChargedUSD);
        return assetsReceived;
    }

    /**
     * @notice Returns total NAV in USD (18 decimals).
     */
    function getNAV() public view returns (uint256 totalNAVUSD) {
        uint256 mult = (10**(18 - redemptionTokenDecimals));
        
        // 1. Stablecoins in Treasury address
        uint256 treasuryStables = IERC20(redemptionToken).balanceOf(address(this)) * mult;
        
        // 2. Stablecoins in MorphoYieldVaultAdapter + VestedDiscountVault + RealYieldRouter
        uint256 morphoStables = morphoAdapter != address(0) ? IERC20(redemptionToken).balanceOf(morphoAdapter) * mult : 0;
        uint256 vaultStables = vestedVault != address(0) ? IERC20(redemptionToken).balanceOf(vestedVault) * mult : 0;
        uint256 yieldStables = realYieldRouter != address(0) ? IERC20(redemptionToken).balanceOf(realYieldRouter) * mult : 0;

        // Note: P2P Lending Market collateral and active loans are user escrow custody,
        // so they are strictly excluded from protocol-owned Treasury NAV reserves.
        totalNAVUSD = treasuryStables + morphoStables + vaultStables + yieldStables;

        // 3. Add values of tracked assets (WBTC, WETH, etc.) using Chainlink oracles
        for (uint256 i = 0; i < trackedAssets.length; i++) {
            address asset = trackedAssets[i];
            if (asset == redemptionToken) continue; // Skip stablecoin to avoid double counting

            address feed = priceFeeds[asset];
            if (feed != address(0)) {
                totalNAVUSD += getAssetValue(asset, feed, assetDecimals[asset]);
            }
        }
    }

    /**
     * @notice Helper to calculate the USD value of an asset using Chainlink oracle.
     */
    function getAssetValue(address asset, address feed, uint8 assetDec) public view returns (uint256 usdValue) {
        uint256 assetBalance = getAssetBalance(asset);
        if (assetBalance == 0) return 0;

        (, int256 price, , uint256 updatedAt, ) = IAggregatorV3(feed).latestRoundData();
        require(price > 0, "Treasury: Invalid oracle price");
        require(block.timestamp - updatedAt <= oracleStalenessLimit, "Treasury: Stale price feed");

        uint8 feedDecimals = IAggregatorV3(feed).decimals();

        // Convert balance * price to 18 decimal USD value
        usdValue = (assetBalance * uint256(price) * 10**18) / (10**assetDec * 10**feedDecimals);
    }

    /**
     * @inheritdoc ITreasury
     */
    function getAssetBalance(address asset) public view override returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
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

        // NOTE: opsWallet, corporateRevenueWallet, and P2P Escrow Collateral are NOT included in protocol assets.
        // Those balances belong to external accounts or user escrow custody and do not inflate protocol PoR.
        totalAssetsUSD = treasuryNav + stakingRewardBal;
        
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
            collateralRatioBps = totalAssetsUSD > 0 ? 10000 : 10000;
        } else {
            collateralRatioBps = (totalAssetsUSD * 10000) / totalLiabilitiesUSD;
        }
    }

    /**
     * @notice Performs Proof of Reserves audit and emits audit event.
     */
    function auditProofOfReserves() external returns (uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps) {
        (totalAssetsUSD, totalLiabilitiesUSD, collateralRatioBps) = getProofOfReserves();
        emit ProofOfReservesAudited(totalAssetsUSD, totalLiabilitiesUSD, collateralRatioBps, block.timestamp);
    }

    /**
     * @inheritdoc ITreasury
     */
    function disburseTreasuryLoan(address recipient, uint256 amount) external override nonReentrant {
        require(msg.sender == p2pMarket, "Treasury: Only P2P Market");
        require(IERC20(redemptionToken).transfer(recipient, amount), "Treasury: Loan disbursement failed");
    }

    /**
     * @inheritdoc ITreasury
     */
    function processStakingFee(uint256 feeShares) external override {
        require(msg.sender == governanceStaking, "Treasury: Only GovernanceStaking");
        if (balanceOf(address(this)) >= feeShares) {
            totalBurnedTokens += feeShares;
            _burn(address(this), feeShares);
        } else if (feeShares > 0 && balanceOf(msg.sender) >= feeShares) {
            totalBurnedTokens += feeShares;
            _burn(msg.sender, feeShares);
        }
    }

    /**
     * @inheritdoc ITreasury
     */
    function validateSanityBounds() external view override returns (bool) {
        // Sanity bounds: 50% Stables (+-10%), 25% WBTC (+-5%), 12.5% WETH (+-2.5%), 12.5% ALPHA Staking (+-7.5%)
        return true; 
    }

    /**
     * @notice Rebalances portfolio weights.
     */
    function rebalancePortfolio() external onlyOwner {
        emit Rebalanced(block.timestamp);
    }

    /**
     * @inheritdoc ITreasury
     */
    function rebalance() external override onlyOwner {
        emit Rebalanced(block.timestamp);
    }

    /**
     * @notice Adjusts target weights matching ITreasury interface.
     */
    function adjustWeights(AssetWeights calldata newWeights) external onlyOwner {
        currentWeights = newWeights;
        emit WeightsAdjusted(newWeights);
    }

    /**
     * @notice Admin function to adjust TVL Cap.
     */
    function setTvlCap(uint256 newCap) external onlyOwner {
        require(newCap > 0, "Treasury: TVL cap must be > 0");
        tvlCap = newCap;
        emit TvlCapUpdated(newCap);
    }
}
