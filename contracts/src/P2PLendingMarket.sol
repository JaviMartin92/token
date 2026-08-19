// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./VaultPositionNFT.sol";
import "./interfaces/IAggregatorV3.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/IProtocolErrors.sol";
import "./interfaces/IOracleHub.sol";
import "./interfaces/ICircuitBreaker.sol";
import "./interfaces/IRealYieldRouter.sol";

interface IProtocolTokenomicsEngineApr {
    function treasuryBorrowAprBps() external view returns (uint256);
}

/**
 * @title P2PLendingMarket
 * @notice Collateralized P2P lending market allowing position NFT holders to leverage positions up to 70% LTV.
 *         Features Fair Liquidation with Claimable Borrower Equity preservation (MakerDAO/Liquity Tier-1 Standard).
 */
contract P2PLendingMarket is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    // Domain Custom Errors
    error NotPositionOwner();
    error InactivePosition();
    error MaxLTVExceeded(uint256 attempted, uint256 maxAllowed);
    error NotBorrower();
    error CannotCancelActiveLoan();
    error LoanNotInCreatedState();
    error BorrowerCannotFundOwnLoan();
    error OnlyBorrowerCanRepay();
    error LoanNotLiquidatable();
    error NoClaimableEquity();

    address public immutable stablecoin;
    VaultPositionNFT public immutable positionNFT;
    address public feeCollector;
    address public priceFeed; // Price feed for collateral/health factor valuation
    address public treasury; // Treasury contract address for protocol reserve repayments
    address public tokenomicsEngine;
    address public alphaToken;
    address public wbtcToken;
    address public wethToken;

    mapping(uint256 => address) public loanCollateralAsset;

    function setTokenomicsEngine(address _tokenomicsEngine) external onlyOwner {
        tokenomicsEngine = _tokenomicsEngine;
    }

    function setAlphaToken(address _alphaToken) external onlyOwner {
        alphaToken = _alphaToken;
    }

    function setWbtcToken(address _wbtcToken) external onlyOwner {
        wbtcToken = _wbtcToken;
    }

    function setWethToken(address _wethToken) external onlyOwner {
        wethToken = _wethToken;
    }

    address public circuitBreaker;
    event CircuitBreakerUpdated(address oldBreaker, address newBreaker);

    function setCircuitBreaker(address _circuitBreaker) external onlyOwner {
        address old = circuitBreaker;
        circuitBreaker = _circuitBreaker;
        emit CircuitBreakerUpdated(old, _circuitBreaker);
    }

    uint256 public constant MAX_LTV_BPS = 7000; // Max 70% LTV
    uint256 public constant MIN_COLLATERAL_RATIO = 130; // 130%
    uint256 public constant MAX_COLLATERAL_RATIO = 150; // 150%
    uint256 public constant LIQUIDATION_THRESHOLD = 115; // 115% collateral coverage
    uint256 public constant LIQUIDATION_BONUS_BPS = 1000; // 10% bonus for liquidators
    uint256 public constant MAX_INTEREST_BPS = 5000; // 50% APR maximum
    uint256 public constant MAX_DURATION_DAYS = 1825; // 5 years maximum
    uint256 public constant ORACLE_STALENESS = 1 hours; // Price feeds must be fresh within 1 hour
    uint256 public constant ORIGINATION_FEE_BPS = 50; // 0.5%
    uint256 public constant INTEREST_SPREAD_BPS = 1000; // 10% spread on interest

    enum LoanState {
        CREATED,
        ACTIVE,
        REPAID,
        LIQUIDATED,
        CANCELLED
    }

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
    mapping(address => uint256) public claimableBorrowerEquity;

    // O(1) State Accumulators for Constant-Gas Proof of Reserves (AC-12)
    uint256 internal _treasuryActiveLoansReceivableUSD;
    uint256 internal _totalActiveLoansReceivableUSD;

    event LoanCreated(uint256 indexed loanId, address indexed lender, uint256 positionTokenId, uint256 borrowAmount);
    event LoanAccepted(uint256 indexed loanId, address indexed borrower, uint256 collateralAmount);
    event LoanRepaid(uint256 indexed loanId, uint256 amountRepaid);
    event LoanLiquidated(uint256 indexed loanId, address indexed liquidator, uint256 collateralSeized);
    event LoanCancelled(uint256 indexed loanId);
    event BorrowerEquityClaimed(address indexed borrower, uint256 amount);

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

    function _getTreasuryBorrowAprBps() internal view returns (uint256) {
        if (tokenomicsEngine != address(0)) {
            try IProtocolTokenomicsEngineApr(tokenomicsEngine).treasuryBorrowAprBps() returns (uint256 rate) {
                if (rate > 0 && rate <= MAX_INTEREST_BPS) return rate;
            } catch {
                // Ignore tokenomics query revert, fallback to default
            }
        }
        return 800; // 8.00% APR default fallback
    }

    function createLoanOffer(
        uint256 positionTokenId,
        uint256 borrowAmount,
        uint256 interestRateBps,
        uint256 durationDays
    ) public nonReentrant returns (uint256 loanId) {
        if (borrowAmount == 0) revert IProtocolErrors.ZeroAmount();
        if (interestRateBps > MAX_INTEREST_BPS) revert IProtocolErrors.InvalidParameters();
        if (durationDays == 0 || durationDays > MAX_DURATION_DAYS) revert IProtocolErrors.InvalidParameters();
        if (address(positionNFT) == address(0)) revert IProtocolErrors.ZeroAddress();
        if (circuitBreaker != address(0) && ICircuitBreaker(circuitBreaker).isFrozen(stablecoin)) {
            revert IProtocolErrors.CircuitBreakerActive(stablecoin);
        }
        if (positionNFT.ownerOf(positionTokenId) != msg.sender) revert NotPositionOwner();

        VaultPositionNFT.Position memory pos = positionNFT.getPosition(positionTokenId);
        if (pos.isRagequitted || pos.isMaturedClaimed) revert InactivePosition();

        uint256 posCollateralUSD = pos.discountedPricePaid > 0 ? pos.discountedPricePaid : pos.principalAmount;
        uint256 maxBorrow = (posCollateralUSD * MAX_LTV_BPS) / 10000;
        if (borrowAmount > maxBorrow) revert MaxLTVExceeded(borrowAmount, maxBorrow);

        loanId = nextLoanId;
        unchecked {
            ++nextLoanId;
        }

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

        positionNFT.safeTransferFrom(msg.sender, address(this), positionTokenId);

        emit LoanCreated(loanId, msg.sender, positionTokenId, borrowAmount);
    }

    function createLoanOfferWithNFT(
        uint256 positionTokenId,
        uint256 borrowAmount,
        uint256 interestRateBps,
        uint256 durationDays
    ) external returns (uint256 loanId) {
        return createLoanOffer(positionTokenId, borrowAmount, interestRateBps, durationDays);
    }

    function createLoanOfferWithCollateral(
        uint256 borrowAmount,
        uint256 collateralAmount,
        uint256 interestRateBps,
        uint256 durationDays
    ) external nonReentrant returns (uint256 loanId) {
        if (borrowAmount == 0 || collateralAmount == 0) revert IProtocolErrors.ZeroAmount();
        if (interestRateBps > MAX_INTEREST_BPS) revert IProtocolErrors.InvalidParameters();
        if (durationDays == 0 || durationDays > MAX_DURATION_DAYS) revert IProtocolErrors.InvalidParameters();
        if (circuitBreaker != address(0) && ICircuitBreaker(circuitBreaker).isFrozen(stablecoin)) {
            revert IProtocolErrors.CircuitBreakerActive(stablecoin);
        }

        uint256 minCollateralUSD = (borrowAmount * MIN_COLLATERAL_RATIO) / 100;
        if (collateralAmount < minCollateralUSD) revert MaxLTVExceeded(collateralAmount, minCollateralUSD);

        loanId = nextLoanId;
        unchecked {
            ++nextLoanId;
        }

        loans[loanId] = Loan({
            id: loanId,
            lender: address(0),
            borrower: msg.sender,
            positionTokenId: 0,
            borrowAmount: borrowAmount,
            collateralAmount: collateralAmount,
            interestRateBps: interestRateBps,
            durationDays: durationDays,
            startTime: 0,
            state: LoanState.CREATED
        });

        loanCollateralAsset[loanId] = stablecoin;

        IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), collateralAmount);

        emit LoanCreated(loanId, msg.sender, 0, borrowAmount);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /**
     * @notice Allows a user to borrow USDC instantly from Treasury reserves using a Vested Position NFT as collateral
     */
    function borrowFromTreasury(
        uint256 positionTokenId,
        uint256 borrowAmount,
        uint256 durationDays
    ) public nonReentrant returns (uint256 loanId) {
        if (borrowAmount == 0) revert IProtocolErrors.ZeroAmount();
        if (durationDays == 0 || durationDays > MAX_DURATION_DAYS) revert IProtocolErrors.InvalidParameters();
        if (address(positionNFT) == address(0) || treasury == address(0)) revert IProtocolErrors.ZeroAddress();
        if (circuitBreaker != address(0) && ICircuitBreaker(circuitBreaker).isFrozen(stablecoin)) {
            revert IProtocolErrors.CircuitBreakerActive(stablecoin);
        }
        if (positionNFT.ownerOf(positionTokenId) != msg.sender) revert NotPositionOwner();

        VaultPositionNFT.Position memory pos = positionNFT.getPosition(positionTokenId);
        if (pos.isRagequitted || pos.isMaturedClaimed) revert InactivePosition();

        uint256 posCollateralUSD = pos.discountedPricePaid > 0 ? pos.discountedPricePaid : pos.principalAmount;
        uint256 maxBorrow = (posCollateralUSD * MAX_LTV_BPS) / 10000;
        if (borrowAmount > maxBorrow) revert MaxLTVExceeded(borrowAmount, maxBorrow);

        loanId = nextLoanId;
        unchecked {
            ++nextLoanId;
        }

        loans[loanId] = Loan({
            id: loanId,
            lender: treasury,
            borrower: msg.sender,
            positionTokenId: positionTokenId,
            borrowAmount: borrowAmount,
            collateralAmount: 0,
            interestRateBps: _getTreasuryBorrowAprBps(),
            durationDays: durationDays,
            startTime: block.timestamp,
            state: LoanState.ACTIVE
        });

        positionNFT.safeTransferFrom(msg.sender, address(this), positionTokenId);

        _totalActiveLoansReceivableUSD += borrowAmount;
        _treasuryActiveLoansReceivableUSD += borrowAmount;

        uint256 originationFee = (borrowAmount * ORIGINATION_FEE_BPS) / 10000; // 0.5%
        uint256 netBorrow = borrowAmount - originationFee;

        ITreasury(treasury).disburseTreasuryLoan(address(this), borrowAmount);
        IERC20(stablecoin).safeTransfer(msg.sender, netBorrow);
        if (originationFee > 0 && feeCollector != address(0)) {
            IERC20(stablecoin).safeTransfer(feeCollector, originationFee);
            if (feeCollector.code.length > 0) {
                try IRealYieldRouter(feeCollector).routeUniversalFee(stablecoin) {
                    // Fee routed
                } catch {
                    // Ignore fee routing error
                }
            }
        }

        emit LoanCreated(loanId, treasury, positionTokenId, borrowAmount);
        emit LoanAccepted(loanId, msg.sender, borrowAmount);
    }

    /**
     * @notice Allows a user to borrow USDC instantly from Treasury reserves using supported ERC20 collateral (ALPHA, WBTC, WETH)
     */
    function borrowFromTreasuryWithAsset(
        address collateralAsset,
        uint256 collateralAmount,
        uint256 borrowAmount,
        uint256 durationDays
    ) public nonReentrant returns (uint256 loanId) {
        if (borrowAmount == 0 || collateralAmount == 0) revert IProtocolErrors.ZeroAmount();
        if (durationDays == 0 || durationDays > MAX_DURATION_DAYS) revert IProtocolErrors.InvalidParameters();
        if (treasury == address(0) || collateralAsset == address(0)) revert IProtocolErrors.ZeroAddress();

        if (circuitBreaker != address(0)) {
            if (ICircuitBreaker(circuitBreaker).isFrozen(stablecoin)) {
                revert IProtocolErrors.CircuitBreakerActive(stablecoin);
            }
            if (ICircuitBreaker(circuitBreaker).isFrozen(collateralAsset)) {
                revert IProtocolErrors.CircuitBreakerActive(collateralAsset);
            }
        }

        uint256 maxLtvBps;
        uint256 collateralUSD; // 6 decimals

        if (collateralAsset == alphaToken) {
            maxLtvBps = 5000; // 50% Max LTV for ALPHA
            uint256 navPerShare = ITreasury(treasury).getNAVPerShare(); // 18 decimals
            collateralUSD = (collateralAmount * navPerShare) / 1e30; // 6 decimals
        } else if (collateralAsset == wbtcToken) {
            maxLtvBps = 7000; // 70% Max LTV for WBTC
            if (priceFeed == address(0)) revert IProtocolErrors.ZeroAddress();
            uint256 val18 = IOracleHub(priceFeed).getAssetUsdValue(collateralAsset, collateralAmount);
            collateralUSD = val18 / 1e12; // convert 18 to 6 decimals
        } else if (collateralAsset == wethToken) {
            maxLtvBps = 7500; // 75% Max LTV for WETH
            if (priceFeed == address(0)) revert IProtocolErrors.ZeroAddress();
            uint256 val18 = IOracleHub(priceFeed).getAssetUsdValue(collateralAsset, collateralAmount);
            collateralUSD = val18 / 1e12; // convert 18 to 6 decimals
        } else {
            revert IProtocolErrors.InvalidParameters();
        }

        uint256 maxBorrow = (collateralUSD * maxLtvBps) / 10000;
        if (borrowAmount > maxBorrow) revert MaxLTVExceeded(borrowAmount, maxBorrow);

        loanId = nextLoanId;
        unchecked {
            ++nextLoanId;
        }

        loans[loanId] = Loan({
            id: loanId,
            lender: treasury,
            borrower: msg.sender,
            positionTokenId: 0,
            borrowAmount: borrowAmount,
            collateralAmount: collateralAmount,
            interestRateBps: _getTreasuryBorrowAprBps(),
            durationDays: durationDays,
            startTime: block.timestamp,
            state: LoanState.ACTIVE
        });

        loanCollateralAsset[loanId] = collateralAsset;

        IERC20(collateralAsset).safeTransferFrom(msg.sender, address(this), collateralAmount);

        _totalActiveLoansReceivableUSD += borrowAmount;
        _treasuryActiveLoansReceivableUSD += borrowAmount;

        uint256 originationFee = (borrowAmount * ORIGINATION_FEE_BPS) / 10000; // 0.5%
        uint256 netBorrow = borrowAmount - originationFee;

        ITreasury(treasury).disburseTreasuryLoan(address(this), borrowAmount);
        IERC20(stablecoin).safeTransfer(msg.sender, netBorrow);
        if (originationFee > 0 && feeCollector != address(0)) {
            IERC20(stablecoin).safeTransfer(feeCollector, originationFee);
            if (feeCollector.code.length > 0) {
                try IRealYieldRouter(feeCollector).routeUniversalFee(stablecoin) {
                    // Fee routed
                } catch {
                    // Ignore fee routing error
                }
            }
        }

        emit LoanCreated(loanId, treasury, 0, borrowAmount);
        emit LoanAccepted(loanId, msg.sender, borrowAmount);
    }

    /**
     * @notice Allows a user to borrow USDC instantly from Treasury reserves using ALPHA tokens as collateral (50% Max LTV)
     */
    function borrowFromTreasuryWithAlpha(
        uint256 alphaCollateralAmount,
        uint256 borrowAmount,
        uint256 durationDays
    ) external returns (uint256 loanId) {
        return borrowFromTreasuryWithAsset(alphaToken, alphaCollateralAmount, borrowAmount, durationDays);
    }

    function cancelLoan(uint256 loanId) public nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.borrower != msg.sender) revert NotBorrower();
        if (loan.state != LoanState.CREATED) revert CannotCancelActiveLoan();

        loan.state = LoanState.CANCELLED;

        if (loan.positionTokenId > 0 && address(positionNFT) != address(0)) {
            positionNFT.safeTransferFrom(address(this), msg.sender, loan.positionTokenId);
        } else if (loan.collateralAmount > 0) {
            address colAsset = loanCollateralAsset[loanId];
            address targetAsset = colAsset != address(0) ? colAsset : (alphaToken != address(0) ? alphaToken : stablecoin);
            IERC20(targetAsset).safeTransfer(msg.sender, loan.collateralAmount);
        }

        emit LoanCancelled(loanId);
    }

    function cancelLoanOffer(uint256 loanId) external {
        cancelLoan(loanId);
    }

    function acceptLoanAndDepositCollateral(uint256 loanId, uint256) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.state != LoanState.CREATED) revert LoanNotInCreatedState();
        if (loan.borrower == msg.sender) revert BorrowerCannotFundOwnLoan();

        loan.lender = msg.sender;
        loan.startTime = block.timestamp;
        loan.state = LoanState.ACTIVE;

        _totalActiveLoansReceivableUSD += loan.borrowAmount;
        if (treasury != address(0) && (msg.sender == owner() || msg.sender == treasury)) {
            _treasuryActiveLoansReceivableUSD += loan.borrowAmount;
        }

        uint256 originationFee = (loan.borrowAmount * ORIGINATION_FEE_BPS) / 10000; // 0.5%
        uint256 netBorrow = loan.borrowAmount - originationFee;

        IERC20(stablecoin).safeTransferFrom(msg.sender, loan.borrower, netBorrow);
        if (originationFee > 0) {
            IERC20(stablecoin).safeTransferFrom(msg.sender, feeCollector, originationFee);
        }

        emit LoanAccepted(loanId, msg.sender, loan.borrowAmount);
    }

    /**
     * @notice Funds an existing created loan offer (where NFT is already locked in escrow as collateral)
     */
    function fundLoanOffer(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.state != LoanState.CREATED) revert LoanNotInCreatedState();
        if (loan.borrower == msg.sender) revert BorrowerCannotFundOwnLoan();

        loan.lender = msg.sender;
        loan.startTime = block.timestamp;
        loan.state = LoanState.ACTIVE;

        _totalActiveLoansReceivableUSD += loan.borrowAmount;

        uint256 originationFee = (loan.borrowAmount * ORIGINATION_FEE_BPS) / 10000; // 0.5%
        uint256 netBorrow = loan.borrowAmount - originationFee;

        // If funded by Treasury / Admin operator:
        if (treasury != address(0) && (msg.sender == owner() || msg.sender == treasury)) {
            loan.lender = treasury;
            _treasuryActiveLoansReceivableUSD += loan.borrowAmount;
            ITreasury(treasury).disburseTreasuryLoan(address(this), loan.borrowAmount);
            IERC20(stablecoin).safeTransfer(loan.borrower, netBorrow);
            if (originationFee > 0 && feeCollector != address(0)) {
                IERC20(stablecoin).safeTransfer(feeCollector, originationFee);
                if (feeCollector.code.length > 0) {
                    try IRealYieldRouter(feeCollector).routeUniversalFee(stablecoin) {
                        // Origination fee routed to yield pool
                    } catch {
                        // Ignore yield routing revert on market execution
                    }
                }
            } else if (originationFee > 0 && treasury != address(0)) {
                IERC20(stablecoin).safeTransfer(treasury, originationFee);
            }
        } else {
            // Standard P2P Lender
            IERC20(stablecoin).safeTransferFrom(msg.sender, loan.borrower, netBorrow);
            if (originationFee > 0 && feeCollector != address(0)) {
                IERC20(stablecoin).safeTransferFrom(msg.sender, feeCollector, originationFee);
                if (feeCollector.code.length > 0) {
                    try IRealYieldRouter(feeCollector).routeUniversalFee(stablecoin) {
                        // Origination fee routed to yield pool
                    } catch {
                        // Ignore yield routing revert on market execution
                    }
                }
            }
        }

        emit LoanAccepted(loanId, loan.borrower, loan.borrowAmount);
    }

    function calculateTotalOwed(uint256 loanId) public view returns (uint256 totalOwed, uint256 interest) {
        Loan storage loan = loans[loanId];
        if (loan.state == LoanState.CREATED) return (0, 0);

        uint256 durationSec = block.timestamp > loan.startTime ? block.timestamp - loan.startTime : 0;
        uint256 maxSec = loan.durationDays * 1 days;
        if (durationSec > maxSec) {
            durationSec = maxSec;
        }

        interest = (loan.borrowAmount * loan.interestRateBps * durationSec) / (10000 * 365 days);
        totalOwed = loan.borrowAmount + interest;
    }

    function getLoanHealthFactor(uint256 loanId) public view returns (uint256 healthFactorRatio) {
        Loan storage loan = loans[loanId];
        if (loan.state != LoanState.ACTIVE) return 10000;

        (uint256 totalOwed,) = calculateTotalOwed(loanId);
        if (totalOwed == 0) return 10000;

        uint256 collateralUSD = 0;
        if (loan.positionTokenId > 0 && address(positionNFT) != address(0)) {
            try positionNFT.getPosition(loan.positionTokenId) returns (VaultPositionNFT.Position memory pos) {
                collateralUSD = pos.discountedPricePaid > 0 ? pos.discountedPricePaid : pos.principalAmount;
            } catch {
                collateralUSD = loan.collateralAmount;
            }
        } else if (loan.collateralAmount > 0) {
            address colAsset = loanCollateralAsset[loanId];
            if (colAsset == alphaToken && treasury != address(0)) {
                try ITreasury(treasury).getNAVPerShare() returns (uint256 nav) {
                    collateralUSD = (loan.collateralAmount * nav) / 1e30;
                } catch {
                    collateralUSD = loan.collateralAmount;
                }
            } else if (colAsset != address(0) && priceFeed != address(0)) {
                try IOracleHub(priceFeed).getAssetUsdValue(colAsset, loan.collateralAmount) returns (uint256 val18) {
                    collateralUSD = val18 / 1e12;
                } catch {
                    collateralUSD = loan.collateralAmount;
                }
            } else {
                collateralUSD = loan.collateralAmount;
            }
        }

        healthFactorRatio = (collateralUSD * 100) / totalOwed;
    }

    function calculateHealthFactor(uint256 loanId) public view returns (uint256 healthFactorRatio) {
        return getLoanHealthFactor(loanId);
    }

    function totalActiveLoansReceivableUSD() external view returns (uint256) {
        return _totalActiveLoansReceivableUSD;
    }

    function treasuryLoansReceivableUSD() external view returns (uint256) {
        return _treasuryActiveLoansReceivableUSD;
    }

    function _checkGracePeriod() internal view returns (bool) {
        if (priceFeed == address(0)) return false;
        try IOracleHub(priceFeed).isSequencerGracePeriod() returns (bool grace) {
            return grace;
        } catch {
            return false;
        }
    }

    function repayLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (loan.state != LoanState.ACTIVE) revert IProtocolErrors.LoanNotActive(loanId);
        if (msg.sender != loan.borrower) revert OnlyBorrowerCanRepay();

        (uint256 totalOwed, uint256 interest) = calculateTotalOwed(loanId);

        loan.state = LoanState.REPAID;

        if (_totalActiveLoansReceivableUSD >= loan.borrowAmount) {
            _totalActiveLoansReceivableUSD -= loan.borrowAmount;
        } else {
            _totalActiveLoansReceivableUSD = 0;
        }

        if (treasury != address(0) && (loan.lender == owner() || loan.lender == treasury)) {
            if (_treasuryActiveLoansReceivableUSD >= loan.borrowAmount) {
                _treasuryActiveLoansReceivableUSD -= loan.borrowAmount;
            } else {
                _treasuryActiveLoansReceivableUSD = 0;
            }
            IERC20(stablecoin).safeTransferFrom(msg.sender, treasury, loan.borrowAmount);
            if (interest > 0 && feeCollector != address(0)) {
                IERC20(stablecoin).safeTransferFrom(msg.sender, feeCollector, interest);
                if (feeCollector.code.length > 0) {
                    try IRealYieldRouter(feeCollector).routeUniversalFee(stablecoin) {
                        // Interest fee routed successfully
                    } catch {
                        // Ignore yield routing revert during loan repayment
                    }
                }
            } else if (interest > 0 && treasury != address(0)) {
                IERC20(stablecoin).safeTransferFrom(msg.sender, treasury, interest);
            }
        } else {
            uint256 feeSpread = (interest * INTEREST_SPREAD_BPS) / 10000;
            uint256 lenderPayout = totalOwed - feeSpread;
            IERC20(stablecoin).safeTransferFrom(msg.sender, loan.lender, lenderPayout);
            if (feeSpread > 0 && feeCollector != address(0)) {
                IERC20(stablecoin).safeTransferFrom(msg.sender, feeCollector, feeSpread);
                if (feeCollector.code.length > 0) {
                    try IRealYieldRouter(feeCollector).routeUniversalFee(stablecoin) {
                        // Fee spread routed successfully
                    } catch {
                        // Ignore yield routing revert during loan repayment
                    }
                }
            }
        }

        if (loan.positionTokenId > 0 && address(positionNFT) != address(0)) {
            positionNFT.safeTransferFrom(address(this), loan.borrower, loan.positionTokenId);
        } else if (loan.collateralAmount > 0) {
            address colAsset = loanCollateralAsset[loanId];
            address targetAsset = colAsset != address(0) ? colAsset : (alphaToken != address(0) ? alphaToken : stablecoin);
            IERC20(targetAsset).safeTransfer(loan.borrower, loan.collateralAmount);
        }

        emit LoanRepaid(loanId, totalOwed);
    }

    /**
     * @notice Liquidates an expired or under-collateralized loan.
     *         Fair Liquidation: For token collateral, returns surplus equity above debt+bonus to the borrower.
     */
    function liquidateLoan(uint256 loanId) external nonReentrant {
        if (_checkGracePeriod()) {
            revert IProtocolErrors.SequencerGracePeriodActive();
        }
        Loan storage loan = loans[loanId];
        if (loan.state != LoanState.ACTIVE) revert IProtocolErrors.LoanNotActive(loanId);

        uint256 healthRatio = calculateHealthFactor(loanId);
        bool isExpired = block.timestamp > (loan.startTime + (loan.durationDays * 1 days));
        if (healthRatio >= LIQUIDATION_THRESHOLD && !isExpired) revert LoanNotLiquidatable();

        (uint256 totalOwed,) = calculateTotalOwed(loanId);

        loan.state = LoanState.LIQUIDATED;

        if (_totalActiveLoansReceivableUSD >= loan.borrowAmount) {
            _totalActiveLoansReceivableUSD -= loan.borrowAmount;
        } else {
            _totalActiveLoansReceivableUSD = 0;
        }

        if (treasury != address(0) && (loan.lender == owner() || loan.lender == treasury)) {
            if (_treasuryActiveLoansReceivableUSD >= loan.borrowAmount) {
                _treasuryActiveLoansReceivableUSD -= loan.borrowAmount;
            } else {
                _treasuryActiveLoansReceivableUSD = 0;
            }
        }

        uint256 totalCollateral = loan.collateralAmount;

        // Liquidator repays the debt to the lender
        IERC20(stablecoin).safeTransferFrom(msg.sender, loan.lender, totalOwed);

        // Transfer position NFT collateral to liquidator in full settlement of defaulted loan
        if (loan.positionTokenId > 0 && address(positionNFT) != address(0)) {
            positionNFT.safeTransferFrom(address(this), msg.sender, loan.positionTokenId);
        } else if (loan.collateralAmount > 0) {
            address colAsset = loanCollateralAsset[loanId];
            address targetAsset = colAsset != address(0) ? colAsset : (alphaToken != address(0) ? alphaToken : stablecoin);

            // FAIR LIQUIDATION: Liquidator receives debt + 10% bonus in collateral value
            uint256 owedWithBonusUSD = (totalOwed * (10000 + LIQUIDATION_BONUS_BPS)) / 10000;
            uint256 seizeAmount = loan.collateralAmount;

            if (targetAsset == alphaToken && treasury != address(0)) {
                try ITreasury(treasury).getNAVPerShare() returns (uint256 nav) {
                    if (nav > 0) {
                        uint256 neededCol = (owedWithBonusUSD * 1e30) / nav;
                        if (neededCol < seizeAmount) seizeAmount = neededCol;
                    }
                } catch {
                    // Ignore NAV query revert
                }
            } else if (targetAsset != address(0) && priceFeed != address(0)) {
                try IOracleHub(priceFeed).getPriceBase18(targetAsset) returns (uint256 price18) {
                    if (price18 > 0) {
                        uint8 dec = (targetAsset == wbtcToken) ? 8 : 18;
                        uint256 neededCol = (owedWithBonusUSD * (10 ** (12 + dec))) / price18;
                        if (neededCol < seizeAmount) seizeAmount = neededCol;
                    }
                } catch {
                    // Ignore oracle price query revert
                }
            }

            if (seizeAmount > loan.collateralAmount) {
                seizeAmount = loan.collateralAmount;
            }

            uint256 surplusEquity = loan.collateralAmount - seizeAmount;

            // 1. Transfer fair collateral portion to liquidator
            IERC20(targetAsset).safeTransfer(msg.sender, seizeAmount);

            // 2. Return surplus equity to borrower
            if (surplusEquity > 0) {
                IERC20(targetAsset).safeTransfer(loan.borrower, surplusEquity);
            }
        }

        emit LoanLiquidated(loanId, msg.sender, totalCollateral);
    }

    /**
     * @notice Allows borrowers to withdraw their preserved surplus equity after a fair liquidation.
     */
    function claimBorrowerEquity() external nonReentrant returns (uint256 amount) {
        if (_checkGracePeriod()) {
            revert IProtocolErrors.SequencerGracePeriodActive();
        }
        amount = claimableBorrowerEquity[msg.sender];
        if (amount == 0) revert NoClaimableEquity();
        claimableBorrowerEquity[msg.sender] = 0;
        IERC20(stablecoin).safeTransfer(msg.sender, amount);
        emit BorrowerEquityClaimed(msg.sender, amount);
    }

    struct MarketplaceOverview {
        uint256 totalActiveLoans;
        uint256 totalVolumeUSD;
        uint256 activeBorrowUSD;
        uint256 activeCollateralUSD;
        uint256 activeInterestUSD;
    }

    function getMarketplaceOverview() external view returns (MarketplaceOverview memory stats) {
        uint256 maxId = nextLoanId;
        for (uint256 i = 1; i < maxId;) {
            Loan memory loan = loans[i];
            if (loan.state == LoanState.ACTIVE || loan.state == LoanState.REPAID || loan.state == LoanState.LIQUIDATED)
            {
                stats.totalVolumeUSD += loan.borrowAmount;
            }
            if (loan.state == LoanState.ACTIVE) {
                ++stats.totalActiveLoans;
                stats.activeBorrowUSD += loan.borrowAmount;
                stats.activeCollateralUSD += loan.collateralAmount;
                (, uint256 interest) = calculateTotalOwed(i);
                stats.activeInterestUSD += interest;
            }
            unchecked {
                ++i;
            }
        }
    }

    function getAllLoans() external view returns (Loan[] memory allLoans) {
        uint256 maxId = nextLoanId;
        uint256 count = maxId > 1 ? maxId - 1 : 0;
        allLoans = new Loan[](count);
        for (uint256 i = 1; i < maxId;) {
            allLoans[i - 1] = loans[i];
            unchecked {
                ++i;
            }
        }
    }
}
