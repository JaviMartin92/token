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
 * @notice Time-vested discount vault that allows purchasing assets with dynamic discounts based on lock duration.
 */
contract VestedDiscountVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Domain Custom Errors
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

    uint256 public tvlCap = 10_000_000 * 10 ** 6; // Default 10M cap for Sandbox (USDC 6 decimals)
    uint256 public totalInvested;

    function setTokenomicsEngine(address _tokenomicsEngine) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        tokenomicsEngine = _tokenomicsEngine;
    }

    function setCircuitBreaker(address _circuitBreaker) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        circuitBreaker = _circuitBreaker;
    }

    uint256 public baseYieldRateBps = 500; // 5.00% per year (5% 1yr, 10% 2yr, 15% 3yr, 20% 4yr, 25% 5yr)
    uint256 public haircutBps = 2000; // 20% haircut on yield
    uint256 public subsidyBps = 0; // 0% base subsidy
    uint256 public govTokenBonusBps = 100; // 1% extra bonus for gov token holders

    uint256 public constant REFERRAL_REWARD_BPS = 150; // 1.5% referral reward
    uint256 public constant RAGEQUIT_PENALTY_BPS = 1500; // 15%

    mapping(address => address) public referrers; // referrer tracking

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

    constructor(
        address _stablecoin,
        address _positionNFT,
        address _treasuryBunker,
        address _realYieldRouter,
        address _govToken,
        address _initialOwner
    ) {
        address admin = (_initialOwner != address(0)) ? _initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
        stablecoin = _stablecoin;
        positionNFT = VaultPositionNFT(_positionNFT);
        treasuryBunker = _treasuryBunker;
        realYieldRouter = _realYieldRouter;
        govToken = _govToken;
    }

    address public governanceStaking;

    function setGovernanceStaking(address _governanceStaking) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        governanceStaking = _governanceStaking;
    }

    function calculateDiscountBps(address user, uint256 lockYears) public view returns (uint256 discountBps) {
        if (lockYears < 1 || lockYears > 5) revert IProtocolErrors.InvalidLockYears();

        discountBps = (lockYears * baseYieldRateBps) + subsidyBps;

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

    mapping(uint256 => bool) public isVestedBond;

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

        uint256 preNavUSD = 0;
        if (treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            try ITreasury(treasuryBunker).getNAVPerShare() returns (uint256 nav) {
                preNavUSD = nav;
            } catch {
                // Ignore pre-NAV query revert
            }
        }

        uint256 discountBps = calculateDiscountBps(msg.sender, lockYears);
        uint256 discountedPrice = (principalAmount * (10000 - discountBps)) / 10000;

        uint256 refAmount = 0;
        if (referrer != address(0) && referrer != msg.sender) {
            referrers[msg.sender] = referrer;
            refAmount = (discountedPrice * REFERRAL_REWARD_BPS) / 10000; // 1.5%
        }

        uint256 mintFee = (discountedPrice * 150) / 10000; // 1.5% protocol mint fee to Real Yield pool
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
        if (netToTreasury > 0 && treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            IERC20(stablecoin).safeTransfer(treasuryBunker, netToTreasury);
        }

        totalInvested += principalAmount;

        // Mint Position NFT
        tokenId = positionNFT.mintPosition(msg.sender, stablecoin, principalAmount, discountedPrice, lockYears);

        isVestedBond[tokenId] = true;

        if (treasuryBunker != address(0) && treasuryBunker.code.length > 0 && preNavUSD > 0) {
            try ITreasury(treasuryBunker).getNAVPerShare() returns (uint256 postNavUSD) {
                if (postNavUSD < preNavUSD) revert NavInvariantViolated();
            } catch {
                // Ignore post-NAV query revert
            }
        }

        emit BondPurchased(msg.sender, tokenId, principalAmount, discountedPrice, lockYears, referrer);
    }

    function ragequit(uint256 tokenId) external nonReentrant {
        if (positionNFT.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        VaultPositionNFT.Position memory pos = positionNFT.getPosition(tokenId);
        if (pos.isRagequitted || pos.isMaturedClaimed) revert InactivePosition();

        uint256 penaltyTotal = (pos.discountedPricePaid * RAGEQUIT_PENALTY_BPS) / 10000; // 15%
        uint256 userReturn = pos.discountedPricePaid - penaltyTotal;

        // Ensure VestedVault has enough stablecoins to execute payouts by requesting reimbursement from Treasury
        uint256 currentBal = IERC20(stablecoin).balanceOf(address(this));
        if (currentBal < pos.discountedPricePaid && treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            uint256 needed = pos.discountedPricePaid - currentBal;
            ITreasury(treasuryBunker).releaseVaultPayout(address(this), needed);
        }

        // SECURITY FIX: Execute ALL transfers BEFORE burning the NFT (checks-effects-interactions)
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
            IERC20(stablecoin).safeTransfer(treasuryBunker, penaltyTotal);
        }

        // Burn NFT AFTER all transfers have succeeded
        positionNFT.markRagequitted(tokenId);
        positionNFT.burn(tokenId);

        if (totalInvested >= pos.principalAmount) {
            totalInvested -= pos.principalAmount;
        } else {
            totalInvested = 0;
        }

        if (treasuryBunker != address(0) && pos.principalAmount > 0) {
            try ITreasury(treasuryBunker).recordBurn(pos.principalAmount * 10 ** 12) {
                // Burn recorded
            } catch {
                // Ignore burn record revert
            }
        }

        emit Ragequitted(tokenId, msg.sender, userReturn, penaltyTotal);
    }

    function claimMatured(uint256 tokenId) external nonReentrant {
        if (positionNFT.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        VaultPositionNFT.Position memory pos = positionNFT.getPosition(tokenId);
        if (pos.isRagequitted || pos.isMaturedClaimed) revert InactivePosition();
        if (block.timestamp < pos.expirationTimestamp) revert LockupActive();

        // Ensure sufficient balance BEFORE any state changes (checks-effects-interactions)
        uint256 currentBal = IERC20(stablecoin).balanceOf(address(this));
        if (currentBal < pos.principalAmount && treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            uint256 needed = pos.principalAmount - currentBal;
            ITreasury(treasuryBunker).releaseVaultPayout(address(this), needed);
        }

        // SECURITY FIX: Execute payout BEFORE burning the NFT
        IERC20(stablecoin).safeTransfer(msg.sender, pos.principalAmount);

        // Mark and burn AFTER successful payout
        positionNFT.markClaimed(tokenId);
        positionNFT.burn(tokenId);

        if (totalInvested >= pos.principalAmount) {
            totalInvested -= pos.principalAmount;
        } else {
            totalInvested = 0;
        }

        emit MaturedClaimed(tokenId, msg.sender, pos.principalAmount);
    }

    /**
     * @notice Calculates the total Net Present Obligation Value of active vested bonds based on elapsed time lockup.
     */
    function totalPresentLiability() external view returns (uint256 totalLiabilityUSD) {
        return totalInvested;
    }

    struct UserVestedOverview {
        uint256 baseDiscount1YearBps;
        uint256 baseDiscount3YearsBps;
        uint256 baseDiscount5YearsBps;
        uint256 vipBonusBps;
        uint256 userStalphaBalance;
    }

    function getUserVestedOverview(address account) external view returns (UserVestedOverview memory overview) {
        overview.baseDiscount1YearBps = calculateDiscountBps(account, 1);
        overview.baseDiscount3YearsBps = calculateDiscountBps(account, 3);
        overview.baseDiscount5YearsBps = calculateDiscountBps(account, 5);

        if (governanceStaking != address(0)) {
            try IGovStakingForVault(governanceStaking).stakedBalances(account) returns (uint256 stBal) {
                overview.userStalphaBalance = stBal;
                if (stBal >= 100_000 * 1e18) {
                    overview.vipBonusBps = 300; // Tier 3: +3.00%
                } else if (stBal >= 25_000 * 1e18) {
                    overview.vipBonusBps = 200; // Tier 2: +2.00%
                } else if (stBal >= 5_000 * 1e18) {
                    overview.vipBonusBps = 100; // Tier 1: +1.00%
                }
            } catch {
                // Default to 0 staked balance on query revert
            }
        }
    }
}
