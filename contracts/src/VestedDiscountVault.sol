// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./VaultPositionNFT.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/ICircuitBreaker.sol";
import "./RealYieldRouter.sol";

interface IGovStakingForVault {
    function stakedBalances(address user) external view returns (uint256);
}

/**
 * @title VestedDiscountVault
 * @notice Time-vested discount vault that allows purchasing assets with dynamic discounts based on lock duration.
 */
contract VestedDiscountVault is Ownable, ReentrancyGuard {
    address public immutable stablecoin;
    VaultPositionNFT public immutable positionNFT;

    address public treasuryBunker;
    address public opsWallet;
    address public realYieldRouter;
    address public govToken;
    address public circuitBreaker;
    address public tokenomicsEngine;

    uint256 public tvlCap = 10_000_000 * 10**6; // Default 10M cap for Sandbox (USDC 6 decimals)
    uint256 public totalInvested;

    function setTokenomicsEngine(address _tokenomicsEngine) external onlyOwner {
        tokenomicsEngine = _tokenomicsEngine;
    }

    function setCircuitBreaker(address _circuitBreaker) external onlyOwner {
        circuitBreaker = _circuitBreaker;
    }

    uint256 public baseYieldRateBps = 500;   // 5.00% per year (5% 1yr, 10% 2yr, 15% 3yr, 20% 4yr, 25% 5yr)
    uint256 public haircutBps = 2000;        // 20% haircut on yield
    uint256 public subsidyBps = 0;           // 0% base subsidy
    uint256 public govTokenBonusBps = 100;   // 1% extra bonus for gov token holders

    uint256 public constant REFERRAL_REWARD_BPS = 150;  // 1.5% referral reward
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
        address _opsWallet,
        address _realYieldRouter,
        address _govToken,
        address _initialOwner
    ) Ownable() {
        stablecoin = _stablecoin;
        positionNFT = VaultPositionNFT(_positionNFT);
        treasuryBunker = _treasuryBunker;
        opsWallet = _opsWallet;
        realYieldRouter = _realYieldRouter;
        govToken = _govToken;

        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    function setTvlCap(uint256 _tvlCap) external onlyOwner {
        tvlCap = _tvlCap;
        emit TvlCapUpdated(_tvlCap);
    }

    function setVaultParameters(
        uint256 _baseYieldRateBps,
        uint256 _haircutBps,
        uint256 _subsidyBps,
        uint256 _govTokenBonusBps
    ) external onlyOwner {
        baseYieldRateBps = _baseYieldRateBps;
        haircutBps = _haircutBps;
        subsidyBps = _subsidyBps;
        govTokenBonusBps = _govTokenBonusBps;
    }

    function setWallets(address _treasuryBunker, address _opsWallet, address _realYieldRouter) external onlyOwner {
        treasuryBunker = _treasuryBunker;
        opsWallet = _opsWallet;
        realYieldRouter = _realYieldRouter;
    }

    address public governanceStaking;

    function setGovernanceStaking(address _governanceStaking) external onlyOwner {
        governanceStaking = _governanceStaking;
    }

    function calculateDiscountBps(address user, uint256 lockYears) public view returns (uint256 discountBps) {
        require(lockYears >= 1 && lockYears <= 5, "VestedVault: Lock years must be 1 to 5");

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

        if (stakedAmount >= 20_000 * 10**18) {
            discountBps += 300; // +3.0% Extra Bonus for 20,000+ ALPHA staked
        } else if (stakedAmount >= 10_000 * 10**18) {
            discountBps += 200; // +2.0% Extra Bonus for 10,000+ ALPHA staked
        } else if (stakedAmount >= 5_000 * 10**18) {
            discountBps += 100; // +1.0% Extra Bonus for 5,000+ ALPHA staked
        }

        if (discountBps > 5000) { // Max cap 50%
            discountBps = 5000;
        }
    }

    mapping(uint256 => bool) public isVestedBond;

    function buyVestedBond(
        uint256 principalAmount,
        uint256 lockYears,
        address referrer
    ) external nonReentrant returns (uint256 tokenId) {
        require(principalAmount > 0, "VestedVault: Principal must be > 0");
        require(lockYears >= 1 && lockYears <= 5, "VestedVault: Lock years 1-5 required");
        require(totalInvested + principalAmount <= tvlCap, "VestedVault: TVL Cap Exceeded");

        // CircuitBreaker check: prevent purchases if payment token is frozen
        if (circuitBreaker != address(0)) {
            require(!ICircuitBreaker(circuitBreaker).isFrozen(stablecoin), "VestedVault: Circuit breaker active for payment asset");
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
        require(IERC20(stablecoin).transferFrom(msg.sender, address(this), discountedPrice), "VestedVault: Transfer failed");

        if (refAmount > 0) {
            require(IERC20(stablecoin).transfer(referrer, refAmount), "VestedVault: Referral payout failed");
        }
        if (mintFee > 0 && realYieldRouter != address(0)) {
            require(IERC20(stablecoin).transfer(realYieldRouter, mintFee), "VestedVault: Mint fee payout failed");
            if (realYieldRouter.code.length > 0) {
                try RealYieldRouter(realYieldRouter).routeUniversalFee(stablecoin) {} catch {}
            }
        }
        if (netToTreasury > 0 && treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            require(IERC20(stablecoin).transfer(treasuryBunker, netToTreasury), "VestedVault: Treasury deposit failed");
        }

        totalInvested += principalAmount;

        // Mint Position NFT
        tokenId = positionNFT.mintPosition(
            msg.sender,
            stablecoin,
            principalAmount,
            discountedPrice,
            lockYears
        );

        isVestedBond[tokenId] = true;

        emit BondPurchased(msg.sender, tokenId, principalAmount, discountedPrice, lockYears, referrer);
    }

    function ragequit(uint256 tokenId) external nonReentrant {
        require(positionNFT.ownerOf(tokenId) == msg.sender, "VestedVault: Not token owner");

        VaultPositionNFT.Position memory pos = positionNFT.getPosition(tokenId);
        require(!pos.isRagequitted && !pos.isMaturedClaimed, "VestedVault: Position already inactive");

        uint256 penaltyTotal = (pos.discountedPricePaid * RAGEQUIT_PENALTY_BPS) / 10000; // 15%
        uint256 userReturn = pos.discountedPricePaid - penaltyTotal;

        // Ensure VestedVault has enough stablecoins to execute payouts by requesting reimbursement from Treasury
        uint256 currentBal = IERC20(stablecoin).balanceOf(address(this));
        if (currentBal < pos.discountedPricePaid && treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            uint256 needed = pos.discountedPricePaid - currentBal;
            ITreasury(treasuryBunker).releaseVaultPayout(address(this), needed);
        }

        // SECURITY FIX: Execute ALL transfers BEFORE burning the NFT (checks-effects-interactions)
        require(IERC20(stablecoin).transfer(msg.sender, userReturn), "VestedVault: User refund failed");
        
        if (penaltyTotal > 0 && realYieldRouter != address(0)) {
            require(IERC20(stablecoin).transfer(realYieldRouter, penaltyTotal), "VestedVault: Penalty transfer failed");
            if (realYieldRouter.code.length > 0) {
                try RealYieldRouter(realYieldRouter).routeUniversalFee(stablecoin) {} catch {}
            }
        } else if (penaltyTotal > 0 && treasuryBunker != address(0)) {
            require(IERC20(stablecoin).transfer(treasuryBunker, penaltyTotal), "VestedVault: Penalty to treasury failed");
        }

        // Burn NFT AFTER all transfers have succeeded
        positionNFT.markRagequitted(tokenId);
        positionNFT.burn(tokenId);

        if (totalInvested >= pos.principalAmount) {
            totalInvested -= pos.principalAmount;
        } else {
            totalInvested = 0;
        }

        emit Ragequitted(tokenId, msg.sender, userReturn, penaltyTotal);
    }

    function claimMatured(uint256 tokenId) external nonReentrant {
        require(positionNFT.ownerOf(tokenId) == msg.sender, "VestedVault: Not token owner");

        VaultPositionNFT.Position memory pos = positionNFT.getPosition(tokenId);
        require(!pos.isRagequitted && !pos.isMaturedClaimed, "VestedVault: Position already inactive");
        require(block.timestamp >= pos.expirationTimestamp, "VestedVault: Lockup active, position not matured");

        // Ensure sufficient balance BEFORE any state changes (checks-effects-interactions)
        uint256 currentBal = IERC20(stablecoin).balanceOf(address(this));
        if (currentBal < pos.principalAmount && treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            uint256 needed = pos.principalAmount - currentBal;
            ITreasury(treasuryBunker).releaseVaultPayout(address(this), needed);
        }

        // SECURITY FIX: Execute payout BEFORE burning the NFT
        require(IERC20(stablecoin).transfer(msg.sender, pos.principalAmount), "VestedVault: Principal payout failed");

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
        uint256 count = positionNFT.nextTokenId();
        uint256 limit = count > 100 ? 100 : count;
        for (uint256 i = 1; i < limit; i++) {
            if (!isVestedBond[i]) continue;
            try positionNFT.getPosition(i) returns (VaultPositionNFT.Position memory pos) {
                if (!pos.isRagequitted && !pos.isMaturedClaimed && pos.principalAmount > 0) {
                    if (block.timestamp >= pos.expirationTimestamp) {
                        totalLiabilityUSD += pos.principalAmount;
                    } else {
                        uint256 totalDuration = pos.expirationTimestamp > pos.depositTimestamp ? pos.expirationTimestamp - pos.depositTimestamp : 1;
                        uint256 elapsed = block.timestamp > pos.depositTimestamp ? block.timestamp - pos.depositTimestamp : 0;
                        if (elapsed >= totalDuration) {
                            totalLiabilityUSD += pos.principalAmount;
                        } else {
                            uint256 netCapitalReceived = (pos.discountedPricePaid * 9850) / 10000;
                            uint256 totalLiabilityGrowth = pos.principalAmount > netCapitalReceived ? pos.principalAmount - netCapitalReceived : 0;
                            uint256 accrued = (totalLiabilityGrowth * elapsed) / totalDuration;
                            totalLiabilityUSD += (netCapitalReceived + accrued);
                        }
                    }
                }
            } catch {}
        }
    }
}
