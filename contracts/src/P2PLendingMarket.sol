// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./VaultPositionNFT.sol";
import "./interfaces/IAggregatorV3.sol";

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
            lender: msg.sender,
            borrower: address(0),
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
        require(loan.lender == msg.sender, "P2P: Not lender");
        require(loan.state == LoanState.CREATED, "P2P: Cannot cancel active loan");

        loan.state = LoanState.CANCELLED;
        positionNFT.transferFrom(address(this), msg.sender, loan.positionTokenId);

        emit LoanCancelled(loanId);
    }

    function acceptLoanAndDepositCollateral(uint256 loanId, uint256 collateralAmount) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.CREATED, "P2P: Loan not in CREATED state");
        require(loan.lender != msg.sender, "P2P: Lender cannot borrow own offer");

        // Collateral ratio check (130% to 150%)
        uint256 ratio = (collateralAmount * 100) / loan.borrowAmount;
        require(ratio >= MIN_COLLATERAL_RATIO && ratio <= MAX_COLLATERAL_RATIO, "P2P: Collateral ratio must be 130%-150%");

        loan.borrower = msg.sender;
        loan.collateralAmount = collateralAmount;
        loan.startTime = block.timestamp;
        loan.state = LoanState.ACTIVE;

        uint256 originationFee = (loan.borrowAmount * ORIGINATION_FEE_BPS) / 10000; // 0.5%
        uint256 netBorrow = loan.borrowAmount - originationFee;

        // Pull collateral from borrower to market
        require(IERC20(stablecoin).transferFrom(msg.sender, address(this), collateralAmount), "P2P: Collateral transfer failed");

        // Transfer funds from Lender to Borrower (and fee to collector)
        require(IERC20(stablecoin).transferFrom(loan.lender, msg.sender, netBorrow), "P2P: Lender payout failed");
        if (originationFee > 0) {
            require(IERC20(stablecoin).transferFrom(loan.lender, feeCollector, originationFee), "P2P: Fee payout failed");
        }

        emit LoanAccepted(loanId, msg.sender, collateralAmount);
    }

    /**
     * @notice Funds an existing created loan offer (where NFT is already locked in escrow as collateral)
     */
    function fundLoanOffer(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.CREATED, "P2P: Loan not in CREATED state");
        require(loan.lender != msg.sender, "P2P: Borrower cannot fund own offer");

        address borrower = loan.lender; // The creator of the offer is the borrower
        loan.borrower = borrower;
        loan.lender = msg.sender;       // The funder is the lender
        loan.startTime = block.timestamp;
        loan.state = LoanState.ACTIVE;

        uint256 originationFee = (loan.borrowAmount * ORIGINATION_FEE_BPS) / 10000; // 0.5%
        uint256 netBorrow = loan.borrowAmount - originationFee;

        // Transfer funds from Lender (msg.sender) to Borrower
        require(IERC20(stablecoin).transferFrom(msg.sender, borrower, netBorrow), "P2P: Lender payout failed");
        if (originationFee > 0) {
            require(IERC20(stablecoin).transferFrom(msg.sender, feeCollector, originationFee), "P2P: Fee payout failed");
        }

        emit LoanAccepted(loanId, borrower, loan.borrowAmount);
    }

    function calculateTotalOwed(uint256 loanId) public view returns (uint256 totalOwed, uint256 interest) {
        Loan memory loan = loans[loanId];
        if (loan.state != LoanState.ACTIVE) return (0, 0);

        uint256 elapsedDays = (block.timestamp - loan.startTime) / 1 days;
        if (elapsedDays > loan.durationDays) elapsedDays = loan.durationDays;

        interest = (loan.borrowAmount * loan.interestRateBps * elapsedDays) / (10000 * 365);
        totalOwed = loan.borrowAmount + interest;
    }

    /**
     * @notice Returns total USD value of all active loan receivables (principal + accrued interest).
     */
    function totalActiveLoansReceivableUSD() external view returns (uint256 totalReceivable) {
        for (uint256 i = 1; i < nextLoanId; i++) {
            if (loans[i].state == LoanState.ACTIVE) {
                (uint256 totalOwed, ) = calculateTotalOwed(i);
                totalReceivable += totalOwed;
            }
        }
        return totalReceivable;
    }

    /**
     * @notice Returns total USD value of all active collateral held in escrow for borrowers.
     */
    function totalEscrowedCollateralUSD() external view returns (uint256 totalEscrow) {
        for (uint256 i = 1; i < nextLoanId; i++) {
            if (loans[i].state == LoanState.ACTIVE || loans[i].state == LoanState.CREATED) {
                totalEscrow += loans[i].collateralAmount;
            }
        }
        return totalEscrow;
    }

    function calculateHealthFactor(uint256 loanId) public view returns (uint256 healthFactorRatio) {
        Loan memory loan = loans[loanId];
        if (loan.state != LoanState.ACTIVE) return 1000;

        (uint256 totalOwed, ) = calculateTotalOwed(loanId);
        if (totalOwed == 0) return 1000;

        uint256 collateralUSD = loan.collateralAmount;
        if (priceFeed != address(0)) {
            (, int256 price, , uint256 updatedAt, ) = IAggregatorV3(priceFeed).latestRoundData();
            require(price > 0, "P2P: Invalid oracle price");
            require(updatedAt > 0 && block.timestamp - updatedAt <= ORACLE_STALENESS, "P2P: Oracle price is stale");
            
            // forge-lint: disable-next-line(unsafe-typecast)
            uint256 feedDecs = uint256(IAggregatorV3(priceFeed).decimals());
            // forge-lint: disable-next-line(unsafe-typecast)
            collateralUSD = (loan.collateralAmount * uint256(price)) / (10**feedDecs);
        }

        // Health factor ratio = (collateralUSD * 100) / totalOwed
        healthFactorRatio = (collateralUSD * 100) / totalOwed;
    }

    function repayLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.ACTIVE, "P2P: Loan not active");
        require(msg.sender == loan.borrower, "P2P: Only borrower can repay");

        (uint256 totalOwed, uint256 interest) = calculateTotalOwed(loanId);

        uint256 feeSpread = (interest * INTEREST_SPREAD_BPS) / 10000; // 10% of interest
        uint256 lenderPayout = totalOwed - feeSpread;

        loan.state = LoanState.REPAID;

        // Route repayment directly to Treasury if Treasury is lender or owner
        address recipient = (treasury != address(0) && (loan.lender == owner() || loan.lender == treasury)) ? treasury : loan.lender;

        // Pull repayment from borrower
        require(IERC20(stablecoin).transferFrom(msg.sender, recipient, lenderPayout), "P2P: Repayment to lender failed");
        if (feeSpread > 0) {
            require(IERC20(stablecoin).transferFrom(msg.sender, feeCollector, feeSpread), "P2P: Fee spread failed");
        }

        // Return collateral to borrower
        require(IERC20(stablecoin).transfer(loan.borrower, loan.collateralAmount), "P2P: Collateral return failed");

        // Return Position NFT to lender
        positionNFT.transferFrom(address(this), loan.lender, loan.positionTokenId);

        emit LoanRepaid(loanId, totalOwed);
    }

    function liquidateLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.ACTIVE, "P2P: Loan not active");

        uint256 healthRatio = calculateHealthFactor(loanId);
        require(healthRatio < LIQUIDATION_THRESHOLD, "P2P: Loan health factor >= 115%, cannot liquidate");

        (uint256 totalOwed, ) = calculateTotalOwed(loanId);

        loan.state = LoanState.LIQUIDATED;

        uint256 totalCollateral = loan.collateralAmount;
        uint256 lenderPayout = totalOwed;
        uint256 borrowerRefund = 0;

        if (totalCollateral >= lenderPayout) {
            borrowerRefund = totalCollateral - lenderPayout;
        } else {
            lenderPayout = totalCollateral;
        }

        // Single-block liquidation: transfer collateral to lender and borrower refund
        if (lenderPayout > 0) {
            require(IERC20(stablecoin).transfer(loan.lender, lenderPayout), "P2P: Lender liquidation payout failed");
        }
        if (borrowerRefund > 0) {
            require(IERC20(stablecoin).transfer(loan.borrower, borrowerRefund), "P2P: Borrower refund failed");
        }

        // Return position NFT to lender
        positionNFT.transferFrom(address(this), loan.lender, loan.positionTokenId);

        emit LoanLiquidated(loanId, msg.sender, totalCollateral);
    }
}
