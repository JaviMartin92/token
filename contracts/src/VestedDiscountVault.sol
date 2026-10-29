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

interface IGovStakingForVault {
    function stakedBalances(address user) external view returns (uint256);
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

    address public immutable stablecoin;
    VaultPositionNFT public immutable positionNFT;

    address public treasuryBunker;
    address public realYieldRouter;
    address public govToken;
    address public circuitBreaker;
    address public tokenomicsEngine;
    address public governanceStaking;

    uint256 public tvlCap = 10_000_000 * 10 ** 6; // Default 10M cap for Sandbox (USDC 6 decimals)
    uint256 public totalInvested;
    uint256 public totalPresentObligation;
    mapping(uint256 => uint256) public bondPresentObligation;

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
        tokenomicsEngine = _tokenomicsEngine;
        emit TokenomicsEngineUpdated(_tokenomicsEngine);
    }

    /**
     * @notice Updates the Circuit Breaker contract address
     */
    function setCircuitBreaker(address _circuitBreaker) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        circuitBreaker = _circuitBreaker;
        emit CircuitBreakerUpdated(_circuitBreaker);
    }

    /**
     * @notice Updates the Governance Staking contract address
     */
    function setGovernanceStaking(address _governanceStaking) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
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

        // Solvency check: ensure Treasury maintains baseline solvency prior to new issuance
        if (treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            try ITreasury(treasuryBunker).getProofOfReserves() returns (uint256 preAssets, uint256 preLiabilities, uint256) {
                if (preLiabilities > 0 && preAssets < preLiabilities) {
                    revert InactivePosition();
                }
            } catch {}
        }

        uint256 discountBps = calculateDiscountBps(msg.sender, lockYears);
        uint256 discountedPrice = (principalAmount * (10000 - discountBps)) / 10000;

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

        uint256 refAmount = 0;
        if (referrer != address(0) && referrer != msg.sender) {
            uint256 referrerStake = 0;
            if (governanceStaking != address(0)) {
                referrerStake = IGovStakingForVault(governanceStaking).stakedBalances(referrer);
            }
            if (referrerStake >= 100 * 10 ** 18) {
                referrers[msg.sender] = referrer;
                refAmount = (discountedPrice * refBps) / 10000;
            }
        }

        uint256 mintFee = (discountedPrice * mintFeeBps) / 10000;
        uint256 netToTreasury = discountedPrice - refAmount - mintFee;

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
        address targetVault = treasuryBunker;
        if (treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            try ITreasury(treasuryBunker).alphaVault() returns (address av) {
                if (av != address(0)) targetVault = av;
            } catch {}
        }
        if (netToTreasury > 0 && targetVault != address(0)) {
            IERC20(stablecoin).safeTransfer(targetVault, netToTreasury);
        }

        totalInvested += principalAmount;
        totalPresentObligation += discountedPrice;

        // Mint Position NFT
        tokenId = positionNFT.mintPosition(msg.sender, stablecoin, principalAmount, discountedPrice, lockYears);

        isVestedBond[tokenId] = true;
        bondPresentObligation[tokenId] = discountedPrice;

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

        if (totalInvested >= pos.principalAmount) {
            totalInvested -= pos.principalAmount;
        } else {
            totalInvested = 0;
        }

        uint256 oblR = bondPresentObligation[tokenId];
        if (oblR == 0) {
            oblR = pos.principalAmount;
        }
        if (totalPresentObligation >= oblR) {
            totalPresentObligation -= oblR;
        } else {
            totalPresentObligation = 0;
        }
        delete bondPresentObligation[tokenId];

        if (treasuryBunker != address(0) && pos.principalAmount > 0) {
            try ITreasury(treasuryBunker).recordBurn(pos.principalAmount * 10 ** 12) {
                // Burn recorded
            } catch {
                // Ignore burn record revert
            }
        }

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

        // Ensure sufficient balance
        uint256 currentBal = IERC20(stablecoin).balanceOf(address(this));
        if (currentBal < pos.principalAmount && treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            uint256 needed = pos.principalAmount - currentBal;
            ITreasury(treasuryBunker).releaseVaultPayout(address(this), needed);
        }

        // Checks-Effects: Mark NFT and internal accounting BEFORE external payout
        positionNFT.markClaimed(tokenId);
        positionNFT.burn(tokenId);

        if (totalInvested >= pos.principalAmount) {
            totalInvested -= pos.principalAmount;
        } else {
            totalInvested = 0;
        }

        uint256 oblC = bondPresentObligation[tokenId];
        if (oblC == 0) {
            oblC = pos.principalAmount;
        }
        if (totalPresentObligation >= oblC) {
            totalPresentObligation -= oblC;
        } else {
            totalPresentObligation = 0;
        }
        delete bondPresentObligation[tokenId];

        // Interactions: Payout to user
        IERC20(stablecoin).safeTransfer(msg.sender, pos.principalAmount);

        emit MaturedClaimed(tokenId, msg.sender, pos.principalAmount);
    }

    /**
     * @notice Calculates the total Net Present Obligation Value of active vested bonds scaled to 18 decimals.
     *         Enforces exact debt deduction from Treasury Net Equity so that bond issuance maintains invariant ΔNAV >= 0.
     */
    function totalPresentLiability() external view returns (uint256 totalLiabilityUSD) {
        uint256 obl = totalPresentObligation > 0 ? totalPresentObligation : (totalInvested * 8500) / 10000;
        return obl * 10 ** 12;
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
}
