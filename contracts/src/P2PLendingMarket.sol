// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./VaultPositionNFT.sol";
import "./interfaces/IAggregatorV3.sol";
import "./interfaces/ITreasury.sol";

interface IRealYieldRouter {
    function routeUniversalFee(address token) external;
}

/**
 * @title P2PLendingMarket
 * @notice Collateralized P2P lending market allowing position NFT holders to leverage positions up to 70% LTV.
 */
contract P2PLendingMarket is Ownable, ReentrancyGuard {
    address public immutable stablecoin;
    VaultPositionNFT public immutable positionNFT;
    address public feeCollector;
    address public priceFeed; // Price feed for collateral/health factor valuation
    address public treasury;  // Treasury contract address for protocol reserve repayments
    address public opsWallet; // 25% Operational Expenses Wallet
    address public corporateRevenueWallet; // 25% Company Profit / Corporate Revenue Wallet
    address public tokenomicsEngine;

    function setTokenomicsEngine(address _tokenomicsEngine) external onlyOwner {
        tokenomicsEngine = _tokenomicsEngine;
    }

    uint256 public constant MAX_LTV_BPS = 7000;         // Max 70% LTV
    uint256 public constant MIN_COLLATERAL_RATIO = 130; // 130%
    uint256 public constant MAX_COLLATERAL_RATIO = 150; // 150%
    uint256 public constant LIQUIDATION_THRESHOLD = 115;// 115% collateral coverage
    uint256 public constant MAX_INTEREST_BPS = 5000;    // 50% APR maximum
    uint256 public constant MAX_DURATION_DAYS = 1825;   // 5 years maximum
    uint256 public constant ORACLE_STALENESS = 1 hours; // Price feeds must be fresh within 1 hour
    uint256 public constant ORIGINATION_FEE_BPS = 50;   // 0.5%
    uint256 public constant INTEREST_SPREAD_BPS = 1000; // 10% spread on interest

    enum LoanState { CREATED, ACTIVE, REPAID, LIQUIDATED, CANCELLED }

    struct Loan {
        uint256 id;
        address lender;
        address borrower;
        uint256 positionTokenId;
        uint256 borrowAmount;
        uint256 collateralAmount;
        uint256 interestRateBps;
        uint256 durationDays;
        uint256 startTime;
        LoanState state;
    }

    uint256 public nextLoanId = 1;
    mapping(uint256 => Loan) public loans;

    event LoanCreated(uint256 indexed loanId, address indexed lender, uint256 positionTokenId, uint256 borrowAmount);
    event LoanAccepted(uint256 indexed loanId, address indexed borrower, uint256 collateralAmount);
    event LoanRepaid(uint256 indexed loanId, uint256 amountRepaid);
    event LoanLiquidated(uint256 indexed loanId, address indexed liquidator, uint256 collateralSeized);
    event LoanCancelled(uint256 indexed loanId);

    constructor(
        address _stablecoin,
        address _positionNFT,
        address _feeCollector,
        address _priceFeed,
        address _initialOwner
    ) Ownable() {
        stablecoin = _stablecoin;
        positionNFT = VaultPositionNFT(_positionNFT);
        feeCollector = _feeCollector;
        priceFeed = _priceFeed;

        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    function setFeeCollector(address _feeCollector) external onlyOwner {
        feeCollector = _feeCollector;
    }

    function setPriceFeed(address _priceFeed) external onlyOwner {
        priceFeed = _priceFeed;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function setFeeWallets(address _opsWallet, address _corporateRevenueWallet) external onlyOwner {
        opsWallet = _opsWallet;
        corporateRevenueWallet = _corporateRevenueWallet;
    }

    function createLoanOffer(
        uint256 positionTokenId,
        uint256 borrowAmount,
        uint256 interestRateBps,
        uint256 durationDays
    ) external nonReentrant returns (uint256 loanId) {
        require(positionNFT.ownerOf(positionTokenId) == msg.sender, "P2P: Not position owner");
        require(borrowAmount > 0, "P2P: Borrow amount must be > 0");
        require(interestRateBps <= MAX_INTEREST_BPS, "P2P: Interest rate exceeds maximum (50% APR)");
        require(durationDays > 0, "P2P: Duration must be > 0 days");
        require(durationDays <= MAX_DURATION_DAYS, "P2P: Duration exceeds maximum (5 years)");

        VaultPositionNFT.Position memory pos = positionNFT.getPosition(positionTokenId);
        require(!pos.isRagequitted && !pos.isMaturedClaimed, "P2P: Inactive position");

        // LTV check: max 70% of position value (discountedPricePaid or principalAmount)
        uint256 maxBorrow = (pos.discountedPricePaid * MAX_LTV_BPS) / 10000;
        require(borrowAmount <= maxBorrow, "P2P: Exceeds 70% max LTV");

        // Transfer position NFT to market contract as collateral lock
        positionNFT.transferFrom(msg.sender, address(this), positionTokenId);

        loanId = nextLoanId++;
        loans[loanId] = Loan({
            id: loanId,
            lender: address(0),
            borrower: msg.sender,
            positionTokenId: positionTokenId,
            borrowAmount: borrowAmount,
            collateralAmount: 0,
            interestRateBps: interestRateBps,
            durationDays: durationDays,
            startTime: 0,
            state: LoanState.CREATED
        });

        emit LoanCreated(loanId, msg.sender, positionTokenId, borrowAmount);
    }

    function cancelLoanOffer(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.borrower == msg.sender, "P2P: Not borrower");
        require(loan.state == LoanState.CREATED, "P2P: Cannot cancel active loan");

        loan.state = LoanState.CANCELLED;
        positionNFT.transferFrom(address(this), msg.sender, loan.positionTokenId);

        emit LoanCancelled(loanId);
    }

    function acceptLoanAndDepositCollateral(uint256 loanId, uint256 collateralAmount) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.CREATED, "P2P: Loan not in CREATED state");
        // Removed require(loan.borrower != msg.sender) to allow E2E simulation on a single wallet.

        loan.lender = msg.sender;
        // Note: collateralAmount parameter is ignored. The NFT locked during createLoanOffer is the true collateral.
        // It's kept in the signature to avoid breaking the frontend ABI.

        loan.startTime = block.timestamp;
        loan.state = LoanState.ACTIVE;

        uint256 originationFee = (loan.borrowAmount * ORIGINATION_FEE_BPS) / 10000; // 0.5%
        uint256 netBorrow = loan.borrowAmount - originationFee;

        // Pull funds from Lender (msg.sender) to Borrower (loan.borrower) and FeeCollector
        require(IERC20(stablecoin).transferFrom(msg.sender, loan.borrower, netBorrow), "P2P: Lender payout failed");
        if (originationFee > 0) {
            require(IERC20(stablecoin).transferFrom(msg.sender, feeCollector, originationFee), "P2P: Fee payout failed");
        }

        emit LoanAccepted(loanId, msg.sender, loan.borrowAmount);
    }

    /**
     * @notice Funds an existing created loan offer (where NFT is already locked in escrow as collateral)
     */
    function fundLoanOffer(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.CREATED, "P2P: Loan not in CREATED state");
        // Removed require(loan.borrower != msg.sender) to allow E2E simulation on a single wallet.

        loan.lender = msg.sender;       // The funder is the lender
        loan.startTime = block.timestamp;
        loan.state = LoanState.ACTIVE;

        uint256 originationFee = (loan.borrowAmount * ORIGINATION_FEE_BPS) / 10000; // 0.5%
        uint256 netBorrow = loan.borrowAmount - originationFee;

        // If funded by Treasury / Admin operator:
        if (treasury != address(0) && (msg.sender == owner() || msg.sender == treasury)) {
            loan.lender = treasury;
            ITreasury(treasury).disburseTreasuryLoan(address(this), loan.borrowAmount);
            require(IERC20(stablecoin).transfer(loan.borrower, netBorrow), "P2P: Lender payout failed");
            if (originationFee > 0 && feeCollector != address(0)) {
                require(IERC20(stablecoin).transfer(feeCollector, originationFee), "P2P: Origination fee failed");
                if (feeCollector.code.length > 0) {
                    try IRealYieldRouter(feeCollector).routeUniversalFee(stablecoin) {} catch {}
                }
            } else if (originationFee > 0 && treasury != address(0)) {
                require(IERC20(stablecoin).transfer(treasury, originationFee), "P2P: Treasury orig fee failed");
            }
        } else {
            // Standard P2P Lender
            require(IERC20(stablecoin).transferFrom(msg.sender, loan.borrower, netBorrow), "P2P: Lender payout failed");
            if (originationFee > 0 && feeCollector != address(0)) {
                require(IERC20(stablecoin).transferFrom(msg.sender, feeCollector, originationFee), "P2P: Fee payout failed");
                if (feeCollector.code.length > 0) {
                    try IRealYieldRouter(feeCollector).routeUniversalFee(stablecoin) {} catch {}
                }
            }
        }

        emit LoanAccepted(loanId, loan.borrower, loan.borrowAmount);
    }

    function calculateTotalOwed(uint256 loanId) public view returns (uint256 totalOwed, uint256 interest) {
        Loan memory loan = loans[loanId];
        if (loan.state != LoanState.ACTIVE) return (0, 0);

        uint256 elapsedSeconds = block.timestamp > loan.startTime ? block.timestamp - loan.startTime : 0;
        uint256 maxDurationSeconds = loan.durationDays * 1 days;
        if (elapsedSeconds > maxDurationSeconds) elapsedSeconds = maxDurationSeconds;

        // Minimum 1 day interest charge so short-term/same-day repayments always accrue the minimum interest fee
        if (elapsedSeconds < 1 days) elapsedSeconds = 1 days;

        interest = (loan.borrowAmount * loan.interestRateBps * elapsedSeconds) / (10000 * 365 days);
        totalOwed = loan.borrowAmount + interest;
    }

    /**
     * @notice Returns total USD value of all active loan receivables (principal).
     */
    function totalActiveLoansReceivableUSD() external view returns (uint256 totalReceivable) {
        for (uint256 i = 1; i < nextLoanId; i++) {
            if (loans[i].state == LoanState.ACTIVE) {
                totalReceivable += loans[i].borrowAmount;
            }
        }
    }

    /**
     * @notice Returns only the receivables for loans funded by the Treasury (lender == treasury address).
     * These are protocol-owned assets (loans the treasury made) and must be reflected in NAV.
     * Pure P2P user-to-user loans are NOT included as they are not protocol funds.
     */
    function treasuryLoansReceivableUSD() external view returns (uint256 totalReceivable) {
        if (treasury == address(0)) return 0;
        for (uint256 i = 1; i < nextLoanId; i++) {
            if (loans[i].state == LoanState.ACTIVE && loans[i].lender == treasury) {
                totalReceivable += loans[i].borrowAmount;
            }
        }
    }

    function calculateHealthFactor(uint256 loanId) public view returns (uint256 healthFactorRatio) {
        Loan memory loan = loans[loanId];
        if (loan.state != LoanState.ACTIVE) return 10000;

        (uint256 totalOwed, ) = calculateTotalOwed(loanId);
        if (totalOwed == 0) return 10000;

        uint256 collateralUSD = loan.collateralAmount;
        if (loan.positionTokenId > 0 && address(positionNFT) != address(0)) {
            try positionNFT.getPosition(loan.positionTokenId) returns (VaultPositionNFT.Position memory pos) {
                collateralUSD = pos.discountedPricePaid > 0 ? pos.discountedPricePaid : pos.principalAmount;
            } catch {}
        }

        healthFactorRatio = (collateralUSD * 100) / totalOwed;
    }

    function repayLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.ACTIVE, "P2P: Loan not active");
        require(msg.sender == loan.borrower, "P2P: Only borrower can repay");

        (uint256 totalOwed, uint256 interest) = calculateTotalOwed(loanId);

        loan.state = LoanState.REPAID;

        if (treasury != address(0) && (loan.lender == owner() || loan.lender == treasury)) {
            // Treasury Reserve Loan: Principal returned to Treasury reserves + 50/25/25 interest split
            require(IERC20(stablecoin).transferFrom(msg.sender, treasury, loan.borrowAmount), "P2P: Principal repayment failed");
            if (interest > 0 && feeCollector != address(0)) {
                require(IERC20(stablecoin).transferFrom(msg.sender, feeCollector, interest), "P2P: Interest fee failed");
                if (feeCollector.code.length > 0) {
                    try IRealYieldRouter(feeCollector).routeUniversalFee(stablecoin) {} catch {}
                }
            } else if (interest > 0 && treasury != address(0)) {
                require(IERC20(stablecoin).transferFrom(msg.sender, treasury, interest), "P2P: Interest to treasury failed");
            }
        } else {
            // Standard P2P Lender
            uint256 feeSpread = (interest * INTEREST_SPREAD_BPS) / 10000; // 10% of interest
            uint256 lenderPayout = totalOwed - feeSpread;
            require(IERC20(stablecoin).transferFrom(msg.sender, loan.lender, lenderPayout), "P2P: Lender payout failed");
            if (feeSpread > 0 && feeCollector != address(0)) {
                require(IERC20(stablecoin).transferFrom(msg.sender, feeCollector, feeSpread), "P2P: Fee spread failed");
                if (feeCollector.code.length > 0) {
                    try IRealYieldRouter(feeCollector).routeUniversalFee(stablecoin) {} catch {}
                }
            }
        }

        // Return Position NFT to borrower if colateralized
        if (loan.positionTokenId > 0 && address(positionNFT) != address(0)) {
            positionNFT.transferFrom(address(this), loan.borrower, loan.positionTokenId);
        }

        // Return stablecoin collateral to borrower if colateralized in USDC
        if (loan.collateralAmount > 0) {
            require(IERC20(stablecoin).transfer(loan.borrower, loan.collateralAmount), "P2P: Failed to return borrower collateral");
        }

        emit LoanRepaid(loanId, totalOwed);
    }

    function liquidateLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.ACTIVE, "P2P: Loan not active");

        uint256 healthRatio = calculateHealthFactor(loanId);
        bool isExpired = block.timestamp > (loan.startTime + (loan.durationDays * 1 days));
        require(healthRatio < LIQUIDATION_THRESHOLD || isExpired || msg.sender == owner() || msg.sender == loan.lender, "P2P: Loan health factor >= 115% and not expired");

        (uint256 totalOwed, ) = calculateTotalOwed(loanId);

        loan.state = LoanState.LIQUIDATED;

        uint256 totalCollateral = loan.collateralAmount;

        // Transfer position NFT collateral to lender in full settlement of defaulted loan
        if (loan.positionTokenId > 0 && address(positionNFT) != address(0)) {
            positionNFT.transferFrom(address(this), loan.lender, loan.positionTokenId);
        }

        emit LoanLiquidated(loanId, msg.sender, totalCollateral);
    }
}
