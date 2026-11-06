// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./VaultPositionNFT.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/ICircuitBreaker.sol";
import "./interfaces/IProtocolErrors.sol";
import "./RealYieldRouter.sol";
import "./ProtocolTokenomicsEngine.sol";

interface IGovStakingForVault {
    function stakedBalances(address user) external view returns (uint256);
}

interface IERC20MetadataLike {
    function decimals() external view returns (uint8);
}

/**
 * @title VestedDiscountVault
 * @author Alpha Centauri Architecture Team
 * @notice Time-vested discount vault that allows purchasing bond positions with dynamic
 *         discounts based on lock duration (1 to 5 years).
 * @dev Positions are minted as ERC-721 NFTs. Early exits (ragequit) incur a 15% penalty.
 *      Tracks present debt obligations to guarantee treasury invariant ΔNAV >= 0.
 */
contract VestedDiscountVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Domain Custom Errors ---
    error InactivePosition();
    error CircuitBreakerActive();
    error TvlCapExceeded(uint256 attempted, uint256 cap);
    error NavInvariantViolated();
    error LockupActive();
    error NotTokenOwner();
    error TreasuryInsolvent(uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD);

    address public immutable stablecoin;
    uint8 public immutable stablecoinDecimals;
    VaultPositionNFT public immutable positionNFT;

    address public treasuryBunker;
    address public realYieldRouter;
    address public govToken;
    address public circuitBreaker;
    address public tokenomicsEngine;
    address public governanceStaking;

    uint256 public tvlCap = 10_000_000 * 10 ** 6; // Default 10M cap for Sandbox (USDC 6 decimals)
    /// @notice Outstanding bond principal at face value, denominated in stablecoin units.
    /// @dev Sum of the face values of every bond that has not been settled yet (including
    ///      matured-but-unclaimed bonds). It bounds the aggregate liability and drives the
    ///      TVL cap.
    uint256 public totalInvested;
    /// @notice Per-position face-value obligation, in stablecoin units (ABI compatibility).
    mapping(uint256 => uint256) public bondPrincipalObligation;

    /// @notice Discount accretion schedule for each outstanding bond (C-02).
    /// @dev A bond is a zero-coupon instrument: the holder pays `discounted` at `startTime`
    ///      and receives `principal` at `expiry`. The liability therefore accretes linearly
    ///      from `discounted` to `principal`, instead of being recognised at either extreme.
    ///      `accrualRate` is the per-second accretion in stablecoin units scaled by 1e18:
    ///      `(principal - discounted) * 1e18 / (expiry - startTime)`.
    struct BondAccounting {
        uint256 principal;
        uint256 discounted;
        uint256 accrualRate;
        uint256 startTime;
        uint256 expiry;
        bool settled;
    }

    /// @notice Accounting record per bond token.
    mapping(uint256 => BondAccounting) public bondAccounting;

    /// @notice Sum of discounted prices of bonds still tracked in the linear accumulator.
    uint256 public discountedOutstanding;
    /// @notice Sum of per-second accrual rates (1e18-scaled) of bonds in the linear accumulator.
    uint256 public accrualRateSum;
    /// @notice Sum of `accrualRate * startTime` of bonds in the linear accumulator.
    uint256 public accrualStartSum;
    /// @notice Sum of face values of bonds that reached maturity and were moved to the fixed bucket.
    uint256 public settledPrincipal;

    /// @notice Min-heap of token IDs ordered by expiry, so expired bonds can be settled in O(log n).
    uint256[] private _expiryHeap;
    /// @notice 1-based position of a token inside `_expiryHeap`; zero means "not in heap".
    mapping(uint256 => uint256) private _heapIndex;

    uint256 public baseYieldRateBps = 500; // 5.00% per year (5% 1yr, 10% 2yr, 15% 3yr, 20% 4yr, 25% 5yr)
    uint256 public haircutBps = 2000; // 20% haircut on yield
    uint256 public subsidyBps = 0; // 0% base subsidy
    uint256 public govTokenBonusBps = 100; // 1% extra bonus for gov token holders

    uint256 public constant REFERRAL_REWARD_BPS = 150; // 1.5% referral reward
    uint256 public constant RAGEQUIT_PENALTY_BPS = 1500; // 15%

    mapping(address => address) public referrers; // referrer tracking
    mapping(uint256 => bool) public isVestedBond;

    // --- Events ---
    event BondPurchased(
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 principalAmount,
        uint256 discountedPricePaid,
        uint256 lockYears,
        address referrer
    );
    event Ragequitted(uint256 indexed tokenId, address indexed user, uint256 returnedAmount, uint256 penaltyTotal);
    event MaturedClaimed(uint256 indexed tokenId, address indexed user, uint256 principalAmount);
    event BondSettled(uint256 indexed tokenId, uint256 principalAmount, uint256 timestamp);
    event TvlCapUpdated(uint256 newCap);
    event TokenomicsEngineUpdated(address indexed newEngine);
    event CircuitBreakerUpdated(address indexed newBreaker);
    event GovernanceStakingUpdated(address indexed newStaking);
    event ProtocolVaultsUpdated(address indexed treasuryBunker, address indexed realYieldRouter);

    /**
     * @notice Initializes the vested discount vault with core dependencies
     */
    constructor(
        address _stablecoin,
        address _positionNFT,
        address _treasuryBunker,
        address _realYieldRouter,
        address _govToken,
        address _initialOwner
    ) {
        if (_stablecoin == address(0) || _positionNFT == address(0) || _initialOwner == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialOwner);

        stablecoinDecimals = IERC20MetadataLike(_stablecoin).decimals();
        if (stablecoinDecimals > 18) revert IProtocolErrors.InvalidParameters();

        stablecoin = _stablecoin;
        positionNFT = VaultPositionNFT(_positionNFT);
        treasuryBunker = _treasuryBunker;
        realYieldRouter = _realYieldRouter;
        govToken = _govToken;
    }

    /**
     * @notice Updates the maximum TVL deposit cap
     * @param newCap New cap in stablecoin units (must be >= current totalInvested)
     */
    function setTvlCap(uint256 newCap) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (newCap < totalInvested) revert IProtocolErrors.InvalidParameters();
        tvlCap = newCap;
        emit TvlCapUpdated(newCap);
    }

    /**
     * @notice Updates the Tokenomics Engine address
     */
    function setTokenomicsEngine(address _tokenomicsEngine) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_tokenomicsEngine == address(0)) revert IProtocolErrors.ZeroAddress();
        tokenomicsEngine = _tokenomicsEngine;
        emit TokenomicsEngineUpdated(_tokenomicsEngine);
    }

    /**
     * @notice Updates the Circuit Breaker contract address
     */
    function setCircuitBreaker(address _circuitBreaker) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_circuitBreaker == address(0)) revert IProtocolErrors.ZeroAddress();
        circuitBreaker = _circuitBreaker;
        emit CircuitBreakerUpdated(_circuitBreaker);
    }

    /**
     * @notice Updates the Governance Staking contract address
     */
    function setGovernanceStaking(address _governanceStaking) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_governanceStaking == address(0)) revert IProtocolErrors.ZeroAddress();
        governanceStaking = _governanceStaking;
        emit GovernanceStakingUpdated(_governanceStaking);
    }

    /**
     * @notice Configures protocol vault destinations
     */
    function setProtocolVaults(address _treasuryBunker, address _realYieldRouter)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
    {
        if (_treasuryBunker == address(0) || _realYieldRouter == address(0)) revert IProtocolErrors.ZeroAddress();
        treasuryBunker = _treasuryBunker;
        realYieldRouter = _realYieldRouter;
        emit ProtocolVaultsUpdated(_treasuryBunker, _realYieldRouter);
    }

    /**
     * @notice Calculates the total discount in basis points for a user and lock duration
     */
    function calculateDiscountBps(address user, uint256 lockYears) public view returns (uint256 discountBps) {
        if (lockYears < 1 || lockYears > 5) revert IProtocolErrors.InvalidLockYears();

        uint256 effectiveBaseRate = baseYieldRateBps;
        if (tokenomicsEngine != address(0)) {
            try ProtocolTokenomicsEngine(tokenomicsEngine).baseYieldRateBps() returns (uint256 r) {
                if (r > 0) effectiveBaseRate = r;
            } catch {}
        }
        discountBps = (lockYears * effectiveBaseRate) + subsidyBps;

        // Tiered Governance Staking Extra Discount:
        // < 5,000 ALPHA staked: +0%
        // >= 5,000 ALPHA staked: +1.0% (+100 Bps)
        // >= 10,000 ALPHA staked: +2.0% (+200 Bps)
        // >= 20,000 ALPHA staked: +3.0% (+300 Bps)
        uint256 stakedAmount = 0;
        if (governanceStaking != address(0)) {
            stakedAmount = IGovStakingForVault(governanceStaking).stakedBalances(user);
        }

        if (stakedAmount >= 20_000 * 10 ** 18) {
            discountBps += 300; // +3.0% Extra Bonus for 20,000+ ALPHA staked
        } else if (stakedAmount >= 10_000 * 10 ** 18) {
            discountBps += 200; // +2.0% Extra Bonus for 10,000+ ALPHA staked
        } else if (stakedAmount >= 5_000 * 10 ** 18) {
            discountBps += 100; // +1.0% Extra Bonus for 5,000+ ALPHA staked
        }

        if (discountBps > 5000) {
            // Max cap 50%
            discountBps = 5000;
        }
    }

    /**
     * @notice Purchases a time-vested bond position NFT with discounted price
     * @param principalAmount Full face value of the bond
     * @param lockYears Lockup period (1 to 5 years)
     * @param referrer Referral address (optional)
     * @return tokenId Newly minted position NFT ID
     */
    function buyVestedBond(uint256 principalAmount, uint256 lockYears, address referrer)
        external
        nonReentrant
        returns (uint256 tokenId)
    {
        if (principalAmount == 0) revert IProtocolErrors.ZeroAmount();
        if (lockYears < 1 || lockYears > 5) revert IProtocolErrors.InvalidLockYears();
        if (totalInvested + principalAmount > tvlCap) {
            revert TvlCapExceeded(totalInvested + principalAmount, tvlCap);
        }

        // CircuitBreaker check: prevent purchases if payment token is frozen
        if (circuitBreaker != address(0)) {
            if (ICircuitBreaker(circuitBreaker).isFrozen(stablecoin)) revert CircuitBreakerActive();
        }

        // Settle any bond whose maturity already elapsed so the solvency check and the new
        // bond's entry into the accumulator use an up-to-date liability curve.
        _accrue();

        // Solvency check: ensure Treasury maintains baseline solvency prior to new issuance
        _validateSolvency();

        uint256 discountedPrice = (principalAmount * (10000 - calculateDiscountBps(msg.sender, lockYears))) / 10000;
        (uint256 refAmount, uint256 mintFee, uint256 netToTreasury) = _calculateFees(discountedPrice, referrer, msg.sender);

        // Pull stablecoin from buyer
        IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), discountedPrice);

        if (refAmount > 0) {
            IERC20(stablecoin).safeTransfer(referrer, refAmount);
        }
        if (mintFee > 0 && realYieldRouter != address(0)) {
            IERC20(stablecoin).safeTransfer(realYieldRouter, mintFee);
            if (realYieldRouter.code.length > 0) {
                try RealYieldRouter(realYieldRouter).routeUniversalFee(stablecoin) {
                    // Fee routed successfully
                } catch {
                    // Ignore yield routing revert during bond purchase
                }
            }
        }
        address targetVault = _getTargetVault();
        if (netToTreasury > 0 && targetVault != address(0)) {
            IERC20(stablecoin).safeTransfer(targetVault, netToTreasury);
        }

        totalInvested += principalAmount;

        // Mint Position NFT
        tokenId = positionNFT.mintPosition(msg.sender, stablecoin, principalAmount, discountedPrice, lockYears);

        uint256 expiry = block.timestamp + (lockYears * 365 days);
        uint256 accrualRate = ((principalAmount - discountedPrice) * 1e18) / (expiry - block.timestamp);

        bondAccounting[tokenId] = BondAccounting({
            principal: principalAmount,
            discounted: discountedPrice,
            accrualRate: accrualRate,
            startTime: block.timestamp,
            expiry: expiry,
            settled: false
        });
        discountedOutstanding += discountedPrice;
        accrualRateSum += accrualRate;
        accrualStartSum += accrualRate * block.timestamp;
        _heapPush(tokenId);

        isVestedBond[tokenId] = true;
        bondPrincipalObligation[tokenId] = principalAmount;

        emit BondPurchased(msg.sender, tokenId, principalAmount, discountedPrice, lockYears, referrer);
    }

    /**
     * @notice Early exit from a bond position with a 15% penalty
     * @param tokenId Target bond position NFT ID
     */
    function ragequit(uint256 tokenId) external nonReentrant {
        if (positionNFT.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        VaultPositionNFT.Position memory pos = positionNFT.getPosition(tokenId);
        if (pos.isRagequitted || pos.isMaturedClaimed) revert InactivePosition();

        // Settle matured bonds first so the removed liability is exactly the face value.
        _accrue();

        uint256 penaltyBps = RAGEQUIT_PENALTY_BPS;
        if (tokenomicsEngine != address(0)) {
            try ProtocolTokenomicsEngine(tokenomicsEngine).ragequitPenaltyBps() returns (uint256 p) {
                if (p > 0) penaltyBps = p;
            } catch {}
        }
        uint256 penaltyTotal = (pos.discountedPricePaid * penaltyBps) / 10000;
        uint256 userReturn = pos.discountedPricePaid - penaltyTotal;

        // Ensure VestedVault has enough stablecoins to execute payouts by requesting reimbursement from Treasury
        uint256 currentBal = IERC20(stablecoin).balanceOf(address(this));
        if (currentBal < pos.discountedPricePaid && treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            uint256 needed = pos.discountedPricePaid - currentBal;
            ITreasury(treasuryBunker).releaseVaultPayout(address(this), needed);
        }

        // Checks-Effects: Mark NFT and internal accounting BEFORE external transfers
        positionNFT.markRagequitted(tokenId);
        positionNFT.burn(tokenId);

        _purgeBond(tokenId);

        // External asset transfers
        IERC20(stablecoin).safeTransfer(msg.sender, userReturn);

        if (penaltyTotal > 0 && realYieldRouter != address(0)) {
            IERC20(stablecoin).safeTransfer(realYieldRouter, penaltyTotal);
            if (realYieldRouter.code.length > 0) {
                try RealYieldRouter(realYieldRouter).routeUniversalFee(stablecoin) {
                    // Penalty routed to real yield
                } catch {
                    // Ignore yield routing revert during ragequit
                }
            }
        } else if (penaltyTotal > 0 && treasuryBunker != address(0)) {
            address targetVault = treasuryBunker;
            if (treasuryBunker.code.length > 0) {
                try ITreasury(treasuryBunker).alphaVault() returns (address av) {
                    if (av != address(0)) targetVault = av;
                } catch {}
            }
            IERC20(stablecoin).safeTransfer(targetVault, penaltyTotal);
        }

        emit Ragequitted(tokenId, msg.sender, userReturn, penaltyTotal);
    }

    /**
     * @notice Claims full face value principal upon bond maturity
     * @param tokenId Target bond position NFT ID
     */
    function claimMatured(uint256 tokenId) external nonReentrant {
        if (positionNFT.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        VaultPositionNFT.Position memory pos = positionNFT.getPosition(tokenId);
        if (pos.isRagequitted || pos.isMaturedClaimed) revert InactivePosition();
        if (block.timestamp < pos.expirationTimestamp) revert LockupActive();

        // Move every matured bond into the fixed-principal bucket before settling this one.
        _accrue();

        // Ensure sufficient balance
        uint256 currentBal = IERC20(stablecoin).balanceOf(address(this));
        if (currentBal < pos.principalAmount && treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            uint256 needed = pos.principalAmount - currentBal;
            ITreasury(treasuryBunker).releaseVaultPayout(address(this), needed);
        }

        // Checks-Effects: Mark NFT and internal accounting BEFORE external payout
        positionNFT.markClaimed(tokenId);
        positionNFT.burn(tokenId);

        _purgeBond(tokenId);

        // Interactions: Payout to user
        IERC20(stablecoin).safeTransfer(msg.sender, pos.principalAmount);

        emit MaturedClaimed(tokenId, msg.sender, pos.principalAmount);
    }

    /**
     * @notice Accrues all matured bonds into the fixed-principal bucket.
     * @dev Permissionless: anyone can close the accounting gap between a bond's maturity and
     *      the next treasury interaction. Each call costs O(k log n), where k is the number of
     *      bonds that expired since the previous call.
     */
    function accrue() external {
        _accrue();
    }

    /**
     * @notice Total present value of outstanding vested bonds, scaled to 18 decimals.
     * @dev C-02: zero-coupon bonds accrete linearly from the discounted price paid at
     *      issuance to their face value at maturity. Recognising only the purchase price
     *      understated the treasury's debt for the whole life of every bond and created a
     *      NAV cliff at maturity; recognising the full principal upfront overstated it and
     *      made the treasury look insolvent at issuance.
     *
     *      The aggregate curve is maintained in O(1) with moments:
     *          active(t) = discountedOutstanding + (t * accrualRateSum - accrualStartSum) / 1e18
     *      Bonds past maturity are moved to `settledPrincipal` by `accrue()`, so each one
     *      contributes exactly its face value and the curve is continuous at every expiry.
     *
     *      Between two `accrue()` calls a just-matured bond is still counted on its linear
     *      curve, which overstates (never understates) the liability. The Treasury calls
     *      `accrue()` before every NAV-based deposit/redemption, closing that window.
     */
    function totalPresentLiability() external view returns (uint256 totalLiabilityUSD) {
        uint256 liability = settledPrincipal + discountedOutstanding;

        uint256 rateSum = accrualRateSum;
        if (rateSum > 0) {
            uint256 accruedScaled = (block.timestamp * rateSum) - accrualStartSum;
            liability += accruedScaled / 1e18;
        }

        // A bond can never be worth more than its face value: cap at aggregate principal.
        uint256 principalCap = totalInvested;
        if (liability > principalCap) {
            liability = principalCap;
        }

        return liability * (10 ** (18 - stablecoinDecimals));
    }

    /**
     * @notice Removes a bond from the liability accumulator and the expiry heap.
     * @dev `_accrue()` must have run first so every matured bond is already in the fixed
     *      bucket; this keeps the removal exact (face value) and prevents NAV jumps.
     */
    function _purgeBond(uint256 tokenId) private {
        BondAccounting memory bond = bondAccounting[tokenId];

        _heapRemove(tokenId);

        if (bond.settled) {
            settledPrincipal -= bond.principal;
        } else {
            discountedOutstanding -= bond.discounted;
            accrualRateSum -= bond.accrualRate;
            accrualStartSum -= bond.accrualRate * bond.startTime;
        }

        if (totalInvested >= bond.principal) {
            totalInvested -= bond.principal;
        } else {
            totalInvested = 0;
        }

        delete bondAccounting[tokenId];
        delete bondPrincipalObligation[tokenId];
    }

    /// @notice Settles every bond whose expiry is at or before the current timestamp.
    function _accrue() private {
        uint256 nowTs = block.timestamp;
        while (_expiryHeap.length > 0) {
            uint256 tokenId = _expiryHeap[0];
            BondAccounting storage bond = bondAccounting[tokenId];
            if (bond.expiry > nowTs) break;

            discountedOutstanding -= bond.discounted;
            accrualRateSum -= bond.accrualRate;
            accrualStartSum -= bond.accrualRate * bond.startTime;
            settledPrincipal += bond.principal;
            bond.settled = true;

            _heapRemove(tokenId);
            emit BondSettled(tokenId, bond.principal, nowTs);
        }
    }

    // --- Expiry min-heap -----------------------------------------------------

    function _heapPush(uint256 tokenId) private {
        _expiryHeap.push(tokenId);
        uint256 idx = _expiryHeap.length;
        _heapIndex[tokenId] = idx;
        _siftUp(idx);
    }

    function _heapRemove(uint256 tokenId) private {
        uint256 idx = _heapIndex[tokenId];
        if (idx == 0) return;

        uint256 lastIdx = _expiryHeap.length;
        if (idx != lastIdx) {
            uint256 lastToken = _expiryHeap[lastIdx - 1];
            _expiryHeap[idx - 1] = lastToken;
            _heapIndex[lastToken] = idx;
            _expiryHeap.pop();
            delete _heapIndex[tokenId];
            _siftDown(idx);
            _siftUp(_heapIndex[lastToken]);
        } else {
            _expiryHeap.pop();
            delete _heapIndex[tokenId];
        }
    }

    function _siftUp(uint256 idx) private {
        while (idx > 1) {
            uint256 parent = idx / 2;
            if (!_heapLess(_expiryHeap[idx - 1], _expiryHeap[parent - 1])) break;
            _heapSwap(idx, parent);
            idx = parent;
        }
    }

    function _siftDown(uint256 idx) private {
        uint256 len = _expiryHeap.length;
        while (true) {
            uint256 left = idx * 2;
            uint256 right = left + 1;
            uint256 smallest = idx;

            if (left <= len && _heapLess(_expiryHeap[left - 1], _expiryHeap[smallest - 1])) {
                smallest = left;
            }
            if (right <= len && _heapLess(_expiryHeap[right - 1], _expiryHeap[smallest - 1])) {
                smallest = right;
            }
            if (smallest == idx) break;

            _heapSwap(idx, smallest);
            idx = smallest;
        }
    }

    function _heapSwap(uint256 a, uint256 b) private {
        uint256 tokenA = _expiryHeap[a - 1];
        uint256 tokenB = _expiryHeap[b - 1];
        _expiryHeap[a - 1] = tokenB;
        _expiryHeap[b - 1] = tokenA;
        _heapIndex[tokenA] = b;
        _heapIndex[tokenB] = a;
    }

    function _heapLess(uint256 a, uint256 b) private view returns (bool) {
        uint256 expiryA = bondAccounting[a].expiry;
        uint256 expiryB = bondAccounting[b].expiry;
        return expiryA < expiryB || (expiryA == expiryB && a < b);
    }

    struct UserVestedOverview {
        uint256 baseDiscount1YearBps;
        uint256 baseDiscount3YearsBps;
        uint256 baseDiscount5YearsBps;
        uint256 vipBonusBps;
        uint256 userStalphaBalance;
    }

    /**
     * @notice Aggregates user discount rates and VIP tiers for UI display
     */
    function getUserVestedOverview(address account) external view returns (UserVestedOverview memory overview) {
        overview.baseDiscount1YearBps = calculateDiscountBps(account, 1);
        overview.baseDiscount3YearsBps = calculateDiscountBps(account, 3);
        overview.baseDiscount5YearsBps = calculateDiscountBps(account, 5);

        if (governanceStaking != address(0)) {
            try IGovStakingForVault(governanceStaking).stakedBalances(account) returns (uint256 stBal) {
                overview.userStalphaBalance = stBal;
                if (stBal >= 20_000 * 1e18) {
                    overview.vipBonusBps = 300; // Tier 3: +3.00% (20,000+ stALPHA)
                } else if (stBal >= 10_000 * 1e18) {
                    overview.vipBonusBps = 200; // Tier 2: +2.00% (10,000+ stALPHA)
                } else if (stBal >= 5_000 * 1e18) {
                    overview.vipBonusBps = 100; // Tier 1: +1.00% (5,000+ stALPHA)
                }
            } catch {
                // Default to 0 staked balance on query revert
            }
        }
    }

    /// @notice Reverts if the treasury cannot cover its existing liabilities before new debt is issued.
    function _validateSolvency() private view {
        if (treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            try ITreasury(treasuryBunker).getProofOfReserves() returns (
                uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps
            ) {
                if (totalAssetsUSD < totalLiabilitiesUSD || collateralRatioBps < 10000) {
                    revert TreasuryInsolvent(totalAssetsUSD, totalLiabilitiesUSD);
                }
            } catch {}
        }
    }

    function _calculateFees(
        uint256 discountedPrice,
        address referrer,
        address buyer
    ) private returns (uint256 refAmount, uint256 mintFee, uint256 netToTreasury) {
        uint256 refBps = REFERRAL_REWARD_BPS;
        uint256 mintFeeBps = 150;
        if (tokenomicsEngine != address(0)) {
            try ProtocolTokenomicsEngine(tokenomicsEngine).referralFeeBps() returns (uint256 rf) {
                if (rf > 0) refBps = rf;
            } catch {}
            try ProtocolTokenomicsEngine(tokenomicsEngine).mintFeeBps() returns (uint256 mf) {
                if (mf > 0) mintFeeBps = mf;
            } catch {}
        }

        if (referrer != address(0) && referrer != buyer) {
            uint256 referrerStake = 0;
            if (governanceStaking != address(0)) {
                referrerStake = IGovStakingForVault(governanceStaking).stakedBalances(referrer);
            }
            if (referrerStake >= 100 * 10 ** 18) {
                referrers[buyer] = referrer;
                refAmount = (discountedPrice * refBps) / 10000;
            }
        }

        mintFee = (discountedPrice * mintFeeBps) / 10000;
        netToTreasury = discountedPrice - refAmount - mintFee;
    }

    function _getTargetVault() private view returns (address targetVault) {
        targetVault = treasuryBunker;
        if (treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            try ITreasury(treasuryBunker).alphaVault() returns (address av) {
                if (av != address(0)) targetVault = av;
            } catch {}
        }
    }
}
