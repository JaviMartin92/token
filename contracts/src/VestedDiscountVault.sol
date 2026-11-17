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
 * @author Viraje Protocol Architecture Team
 * @notice Bóveda de emisión y custodia de bonos cupón cero pre-financiados con descuentos dinámicos (1 a 5 años).
 * @dev Las posiciones se emiten como NFTs ERC-721 transferibles. Las salidas anticipadas (ragequit)
 *      incurren en una penalización del 15% destinada a stakers.
 *      Implementa un acumulador continuo de deuda lineal (Mitigación C-02) con Min-Heap O(log n)
 *      para garantizar la continuidad contable e invariante de solvencia ΔNAV >= 0.
 */
/* solhint-disable max-states-count */
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

    // --- Constantes Institucionales ---
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant WAD = 1e18;
    uint256 public constant REFERRAL_REWARD_BPS = 150; // 1.50% referral reward
    uint256 public constant RAGEQUIT_PENALTY_BPS = 1500; // 15.00% ragequit penalty

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
    
    /// @notice Principal pendiente de bonos a valor nominal, denominado en unidades de stablecoin.
    uint256 public totalInvested;
    
    /// @notice Obligación nominal por posición (compatibilidad ABI).
    mapping(uint256 => uint256) public bondPrincipalObligation;

    /// @notice Estructura de devengo continuo para cada bono pendiente (Mitigación C-02).
    struct BondAccounting {
        uint256 principal;
        uint256 discounted;
        uint256 accrualRate;
        uint256 startTime;
        uint256 expiry;
        bool settled;
    }

    /// @notice Registro contable individual por token ID de posición.
    mapping(uint256 => BondAccounting) public bondAccounting;

    /// @notice Suma de precios descontados de bonos activos en el acumulador lineal.
    uint256 public discountedOutstanding;
    /// @notice Suma de tasas de devengo por segundo (escala 1e18) en el acumulador.
    uint256 public accrualRateSum;
    /// @notice Suma ponderada de accrualRate * startTime en el acumulador.
    uint256 public accrualStartSum;
    /// @notice Suma de valores nominales de bonos madurados transferidos a la cubeta fija.
    uint256 public settledPrincipal;

    /// @notice Min-heap binario de token IDs ordenados por vencimiento (expiry) para extracción en O(log n).
    uint256[] private _expiryHeap;
    /// @notice Índice base 1 del token en _expiryHeap (0 = no presente).
    mapping(uint256 => uint256) private _heapIndex;

    uint256 public baseYieldRateBps = 1000; // 10.00% anual base (10% 1a, 20% 2a, 30% 3a, 40% 4a, 50% 5a)
    uint256 public haircutBps = 2000; // 20.00% haircut en rendimientos
    uint256 public subsidyBps = 0; // 0.00% subsidio base
    uint256 public govTokenBonusBps = 100; // 1.00% extra para stakers

    mapping(address => address) public referrers;
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
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Constructor del Vault de Descuento Vesting.
     * @param _stablecoin Dirección del token estable de liquidación (USDC).
     * @param _positionNFT Dirección del contrato ERC-721 representativo de posiciones.
     * @param _treasuryBunker Dirección de la tesorería principal.
     * @param _realYieldRouter Dirección del enrutador de rendimientos reales.
     * @param _govToken Dirección del token de gobernanza VIRAJE.
     * @param _initialOwner Dirección administradora génesis (TimelockController en mainnet).
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
     * @notice Actualiza el límite máximo de TVL en la bóveda.
     * @param newCap Nuevo límite en unidades de stablecoin (debe ser >= totalInvested).
     */
    function setTvlCap(uint256 newCap) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (newCap < totalInvested) revert IProtocolErrors.InvalidParameters();
        tvlCap = newCap;
        emit TvlCapUpdated(newCap);
    }

    /**
     * @notice Actualiza la dirección del Tokenomics Engine.
     */
    function setTokenomicsEngine(address _tokenomicsEngine) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_tokenomicsEngine == address(0)) revert IProtocolErrors.ZeroAddress();
        tokenomicsEngine = _tokenomicsEngine;
        emit TokenomicsEngineUpdated(_tokenomicsEngine);
    }

    /**
     * @notice Actualiza la dirección del Circuit Breaker.
     */
    function setCircuitBreaker(address _circuitBreaker) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_circuitBreaker == address(0)) revert IProtocolErrors.ZeroAddress();
        circuitBreaker = _circuitBreaker;
        emit CircuitBreakerUpdated(_circuitBreaker);
    }

    /**
     * @notice Actualiza la dirección del contrato de Governance Staking.
     */
    function setGovernanceStaking(address _governanceStaking) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_governanceStaking == address(0)) revert IProtocolErrors.ZeroAddress();
        governanceStaking = _governanceStaking;
        emit GovernanceStakingUpdated(_governanceStaking);
    }

    /**
     * @notice Configura las direcciones de destino de la tesorería y enrutador de rendimientos.
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
     * @notice Calcula el descuento total en basis points según usuario y años de bloqueo.
     * @param user Dirección del inversor.
     * @param lockYears Duración del bloqueo (1 a 5 años).
     * @return discountBps Descuento total calculado en bps (máximo 5000 bps = 50.00%).
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
        // < 5,000 VIRAJE staked: +0%
        // >= 5,000 VIRAJE staked: +1.0% (+100 Bps)
        // >= 10,000 VIRAJE staked: +2.0% (+200 Bps)
        // >= 20,000 VIRAJE staked: +3.0% (+300 Bps)
        uint256 stakedAmount = 0;
        if (governanceStaking != address(0)) {
            try IGovStakingForVault(governanceStaking).stakedBalances(user) returns (uint256 bal) {
                stakedAmount = bal;
            } catch {}
        }

        if (stakedAmount >= 20_000 * 10 ** 18) {
            discountBps += 300; // +3.0% Extra Bonus para 20,000+ VIRAJE staked
        } else if (stakedAmount >= 10_000 * 10 ** 18) {
            discountBps += 200; // +2.0% Extra Bonus para 10,000+ VIRAJE staked
        } else if (stakedAmount >= 5_000 * 10 ** 18) {
            discountBps += 100; // +1.0% Extra Bonus para 5,000+ VIRAJE staked
        }

        if (discountBps > 5000) {
            discountBps = 5000; // Techo máximo del 50.00%
        }
    }

    /**
     * @notice Adquiere una posición de bono vesting representada por un NFT con precio descontado.
     * @param principalAmount Valor nominal completo del bono al vencimiento.
     * @param lockYears Plazo de bloqueo (1 a 5 años).
     * @param referrer Dirección opcional del referente.
     * @return tokenId Identificador único del NFT de posición acuñado.
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

        // CircuitBreaker: previene compras si el token de pago se encuentra congelado
        if (circuitBreaker != address(0)) {
            if (ICircuitBreaker(circuitBreaker).isFrozen(stablecoin)) revert CircuitBreakerActive();
        }

        // Sincroniza bonos vencidos en el Min-Heap antes de validar solvencia
        _accrue();

        // Validación de solvencia de la Tesorería previa a la emisión de nueva deuda
        _validateSolvency();

        uint256 discountedPrice = (principalAmount * (BPS_DENOMINATOR - calculateDiscountBps(msg.sender, lockYears))) / BPS_DENOMINATOR;
        (uint256 refAmount, uint256 mintFee, uint256 netToTreasury) = _calculateFees(discountedPrice, referrer, msg.sender);

        // Cobro de stablecoin al comprador
        IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), discountedPrice);

        if (refAmount > 0) {
            IERC20(stablecoin).safeTransfer(referrer, refAmount);
        }
        if (mintFee > 0 && realYieldRouter != address(0)) {
            IERC20(stablecoin).safeTransfer(realYieldRouter, mintFee);
            if (realYieldRouter.code.length > 0) {
                try RealYieldRouter(realYieldRouter).routeUniversalFee(stablecoin) {
                    // Fee ruteada exitosamente
                } catch {
                    // Ignora revert transitorio de ruteo durante la compra
                }
            }
        }
        address targetVault = _getTargetVault();
        if (netToTreasury > 0 && targetVault != address(0)) {
            IERC20(stablecoin).safeTransfer(targetVault, netToTreasury);
        }

        totalInvested += principalAmount;

        // Acuña el NFT de posición
        tokenId = positionNFT.mintPosition(msg.sender, stablecoin, principalAmount, discountedPrice, lockYears);

        uint256 expiry = block.timestamp + (lockYears * 365 days);
        uint256 accrualRate = ((principalAmount - discountedPrice) * WAD) / (expiry - block.timestamp);

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
     * @notice Salida anticipada de una posición de bono con una penalización del 15%.
     * @param tokenId Identificador único del NFT de posición.
     */
    function ragequit(uint256 tokenId) external nonReentrant {
        if (positionNFT.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        VaultPositionNFT.Position memory pos = positionNFT.getPosition(tokenId);
        if (pos.isRagequitted || pos.isMaturedClaimed) revert InactivePosition();

        // Sincroniza bonos vencidos primero para mantener la exactitud de la deuda
        _accrue();

        uint256 penaltyBps = RAGEQUIT_PENALTY_BPS;
        if (tokenomicsEngine != address(0)) {
            try ProtocolTokenomicsEngine(tokenomicsEngine).ragequitPenaltyBps() returns (uint256 p) {
                if (p > 0) penaltyBps = p;
            } catch {}
        }
        uint256 penaltyTotal = (pos.discountedPricePaid * penaltyBps) / BPS_DENOMINATOR;
        uint256 userReturn = pos.discountedPricePaid - penaltyTotal;

        // Asegura liquidez suficiente solicitando reembolso a la tesorería
        uint256 currentBal = IERC20(stablecoin).balanceOf(address(this));
        if (currentBal < pos.discountedPricePaid && treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            uint256 needed = pos.discountedPricePaid - currentBal;
            ITreasury(treasuryBunker).releaseVaultPayout(address(this), needed);
        }

        // Checks-Effects: Quema y purga contable antes de transferencias externas
        positionNFT.markRagequitted(tokenId);
        positionNFT.burn(tokenId);

        _purgeBond(tokenId);

        // Transferencias de activos externos
        IERC20(stablecoin).safeTransfer(msg.sender, userReturn);

        if (penaltyTotal > 0 && realYieldRouter != address(0)) {
            IERC20(stablecoin).safeTransfer(realYieldRouter, penaltyTotal);
            if (realYieldRouter.code.length > 0) {
                try RealYieldRouter(realYieldRouter).routeUniversalFee(stablecoin) {
                    // Penalización enviada a stakers
                } catch {
                    // Ignora revert transitorio
                }
            }
        } else if (penaltyTotal > 0 && treasuryBunker != address(0)) {
            address targetVault = _getTargetVault();
            if (targetVault != address(0)) {
                IERC20(stablecoin).safeTransfer(targetVault, penaltyTotal);
            }
        }

        emit Ragequitted(tokenId, msg.sender, userReturn, penaltyTotal);
    }

    /**
     * @notice Cobra el valor nominal total (principal) al alcanzar el vencimiento del bono.
     * @param tokenId Identificador único del NFT de posición.
     */
    function claimMatured(uint256 tokenId) external nonReentrant {
        if (positionNFT.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        VaultPositionNFT.Position memory pos = positionNFT.getPosition(tokenId);
        if (pos.isRagequitted || pos.isMaturedClaimed) revert InactivePosition();
        if (block.timestamp < pos.expirationTimestamp) revert LockupActive();

        // Mueve bonos madurados a la cubeta de pasivo fijo antes de liquidar
        _accrue();

        // Asegura liquidez suficiente en la bóveda
        uint256 currentBal = IERC20(stablecoin).balanceOf(address(this));
        if (currentBal < pos.principalAmount && treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            uint256 needed = pos.principalAmount - currentBal;
            ITreasury(treasuryBunker).releaseVaultPayout(address(this), needed);
        }

        // Checks-Effects: Marca NFT y purga contabilidad antes del pago
        positionNFT.markClaimed(tokenId);
        positionNFT.burn(tokenId);

        _purgeBond(tokenId);

        // Pago del valor nominal al usuario
        IERC20(stablecoin).safeTransfer(msg.sender, pos.principalAmount);

        emit MaturedClaimed(tokenId, msg.sender, pos.principalAmount);
    }

    /**
     * @notice Liquida y transfiere todos los bonos que hayan alcanzado su vencimiento al bucket de pasivo fijo.
     * @dev Función pública permisionless invocable por keepers para cerrar el gap contable.
     */
    function accrue() external {
        _accrue();
    }

    /**
     * @notice Devuelve el valor presente total de los bonos pendientes, escalado a 18 decimales.
     * @dev Evalúa la curva lineal continua en tiempo O(1) con garantía de acotamiento por totalInvested.
     */
    function totalPresentLiability() external view returns (uint256 totalLiabilityUSD) {
        uint256 liability = settledPrincipal + discountedOutstanding;

        uint256 rateSum = accrualRateSum;
        if (rateSum > 0) {
            uint256 accruedScaled = (block.timestamp * rateSum) - accrualStartSum;
            liability += accruedScaled / WAD;
        }

        // El pasivo nunca puede superar el principal agregado emitido
        uint256 principalCap = totalInvested;
        if (liability > principalCap) {
            liability = principalCap;
        }

        return liability * (10 ** (18 - stablecoinDecimals));
    }

    /**
     * @notice Rescata tokens ERC-20 transferidos accidentalmente a esta bóveda.
     * @dev Bloquea estrictamente el token estable de liquidación y custodia (stablecoin) y el positionNFT
     *      para garantizar la cobertura de pasivos de bonos y retiros por ragequit.
     *      Restringido exclusivamente a `ADMIN_ROLE` (TimelockController con 72h de retardo).
     * @param token Dirección del token a rescatar.
     * @param to Dirección de destino donde se transferirán los tokens rescatados.
     */
    function sweepTokens(address token, address to) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        if (token == stablecoin || token == address(positionNFT)) revert IProtocolErrors.InvalidParameters();

        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) revert IProtocolErrors.InvalidAmount();

        IERC20(token).safeTransfer(to, bal);
        emit TokensSwept(token, to, bal);
    }

    /**
     * @notice Elimina un bono del acumulador de deuda y del Min-Heap de vencimientos.
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

    /// @notice Sienta en settledPrincipal todos los bonos cuyo vencimiento sea <= block.timestamp.
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
        uint256 userStvirajeBalance;
    }

    /**
     * @notice Agrega las tasas de descuento y bonos VIP del usuario para la interfaz gráfica.
     */
    function getUserVestedOverview(address account) external view returns (UserVestedOverview memory overview) {
        overview.baseDiscount1YearBps = calculateDiscountBps(account, 1);
        overview.baseDiscount3YearsBps = calculateDiscountBps(account, 3);
        overview.baseDiscount5YearsBps = calculateDiscountBps(account, 5);

        if (governanceStaking != address(0)) {
            try IGovStakingForVault(governanceStaking).stakedBalances(account) returns (uint256 stBal) {
                overview.userStvirajeBalance = stBal;
                if (stBal >= 20_000 * 1e18) {
                    overview.vipBonusBps = 300; // Tier 3: +3.00% (20,000+ stVIRAJE)
                } else if (stBal >= 10_000 * 1e18) {
                    overview.vipBonusBps = 200; // Tier 2: +2.00% (10,000+ stVIRAJE)
                } else if (stBal >= 5_000 * 1e18) {
                    overview.vipBonusBps = 100; // Tier 1: +1.00% (5,000+ stVIRAJE)
                }
            } catch {
                // Default a 0 si la consulta revierte
            }
        }
    }

    /// @notice Revierte si la tesorería no puede cubrir sus pasivos existentes antes de emitir nueva deuda.
    function _validateSolvency() private view {
        if (treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            try ITreasury(treasuryBunker).getProofOfReserves() returns (
                uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps
            ) {
                if (totalAssetsUSD < totalLiabilitiesUSD || collateralRatioBps < BPS_DENOMINATOR) {
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
        uint256 mintFeeBps = 0; // 0.00% Emisión sin fricción
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
                try IGovStakingForVault(governanceStaking).stakedBalances(referrer) returns (uint256 bal) {
                    referrerStake = bal;
                } catch {}
            }
            if (referrerStake >= 100 * 10 ** 18) {
                referrers[buyer] = referrer;
                refAmount = (discountedPrice * refBps) / BPS_DENOMINATOR;
            }
        }

        mintFee = (discountedPrice * mintFeeBps) / BPS_DENOMINATOR;
        netToTreasury = discountedPrice - refAmount - mintFee;
    }

    function _getTargetVault() private view returns (address targetVault) {
        targetVault = treasuryBunker;
        if (treasuryBunker != address(0) && treasuryBunker.code.length > 0) {
            try ITreasury(treasuryBunker).virajeVault() returns (address av) {
                if (av != address(0)) return av;
            } catch {}
        }
    }
}
