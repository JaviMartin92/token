// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../ProtocolRoles.sol";
import "../lib/security/ReentrancyGuard.sol";
import "../interfaces/IProtocolErrors.sol";
import "../interfaces/IUniversalYieldAdapter.sol";

/**
 * @title MorphoYieldVaultAdapter
 * @author Viraje Protocol Architecture Team
 * @notice Adaptador institucional de rendimiento compatible con ERC-4626 para las bóvedas MetaMorpho / Morpho Blue.
 * @dev Canaliza reservas líquidas y activos fiduciarios hacia mercados de crédito institucional,
 *      con mitigación matemática de ataques de inflación mediante participaciones virtuales (Virtual Shares & Assets)
 *      y recolección automatizada de rendimientos hacia TreasuryManager.
 */
contract MorphoYieldVaultAdapter is AccessControl, ReentrancyGuard, IUniversalYieldAdapter {
    using SafeERC20 for IERC20;

    // --- Constantes Institucionales ---
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant DAYS_PER_YEAR = 365;
    uint256 public constant MAX_APY_BPS = 5000; // 50.00% límite de sanidad económica

    IERC20 public immutable underlyingAsset;
    address public treasury;

    mapping(address => uint256) public _balances;
    mapping(address => mapping(address => uint256)) public allowances;
    uint256 public _totalSupply;

    uint256 public totalStablecoinInvested;
    uint256 public totalYieldHarvested;
    uint256 public lastHarvestTimestamp;

    // APYs simulados en BPS (645 Bps = 6.45% APY)
    uint256 public morphoStablecoinApyBps = 645;
    uint256 public lidoEthStakingApyBps = 420;
    uint256 public lombardBtcStakingApyBps = 380;

    // --- Errores Personalizados de Dominio (EIP-838) ---
    error InsufficientBalance();
    error UnauthorizedCaller();

    // --- Eventos Institucionales EIP-4626 & Dominio ---
    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
    event DepositedToMorpho(uint256 amount);
    event YieldHarvested(uint256 yieldAmount, uint256 timestamp);
    event APYsUpdated(uint256 stablecoinApy, uint256 ethApy, uint256 btcApy);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event LiquidityWithdrawn(uint256 amount, address indexed recipient);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Inicializa el adaptador con el activo subyacente y la tesorería.
     * @param _stablecoin Dirección del token ERC-20 subyacente (e.g. USDC).
     * @param _treasury Dirección de la Tesorería central.
     * @param _initialOwner Dirección del administrador fiduciario inicial.
     */
    constructor(address _stablecoin, address _treasury, address _initialOwner) {
        if (_stablecoin == address(0) || _treasury == address(0)) revert IProtocolErrors.ZeroAddress();
        address admin = (_initialOwner != address(0)) ? _initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
        underlyingAsset = IERC20(_stablecoin);
        treasury = _treasury;
        lastHarvestTimestamp = block.timestamp;
    }

    // --- IUniversalYieldAdapter Implementation ---

    function asset() external view override returns (address) {
        return address(underlyingAsset);
    }

    function totalAssets() public view override returns (uint256) {
        return underlyingAsset.balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view override returns (uint256) {
        return (assets * (_totalSupply + 1)) / (totalAssets() + 1);
    }

    function convertToAssets(uint256 shares) public view override returns (uint256) {
        return (shares * (totalAssets() + 1)) / (_totalSupply + 1);
    }

    /**
     * @notice Deposita activos subyacentes acuñando participaciones para el receptor.
     * @dev Sigue estrictamente el patrón Checks-Effects-Interactions (CEI).
     * @param assets Cantidad de activos a depositar.
     * @param receiver Beneficiario de las participaciones emitidas.
     * @return shares Cantidad de participaciones emitidas.
     */
    function deposit(uint256 assets, address receiver) external override nonReentrant returns (uint256 shares) {
        if (assets == 0) revert IProtocolErrors.ZeroAmount();
        if (receiver == address(0)) revert IProtocolErrors.ZeroAddress();

        shares = convertToShares(assets);

        // Effects: Actualización contable previa a llamadas externas
        _balances[receiver] += shares;
        _totalSupply += shares;
        totalStablecoinInvested += assets;

        // Interactions: Transferencia segura desde el usuario
        underlyingAsset.safeTransferFrom(msg.sender, address(this), assets);

        emit Deposit(msg.sender, receiver, assets, shares);
        emit DepositedToMorpho(assets);
        return shares;
    }

    /**
     * @notice Retira activos subyacentes quemando participaciones del propietario.
     * @param assets Cantidad de activos a retirar.
     * @param receiver Dirección receptora de los fondos.
     * @param owner Propietario de las participaciones.
     * @return shares Cantidad de participaciones quemadas.
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external override nonReentrant returns (uint256 shares) {
        if (assets == 0) revert IProtocolErrors.ZeroAmount();
        if (receiver == address(0) || owner == address(0)) revert IProtocolErrors.ZeroAddress();

        uint256 supply = _totalSupply + 1;
        uint256 poolAssets = totalAssets() + 1;
        shares = (assets * supply + poolAssets - 1) / poolAssets;
        if (_balances[owner] < shares) revert InsufficientBalance();

        if (msg.sender != owner && msg.sender != treasury) {
            uint256 allowed = allowances[owner][msg.sender];
            if (allowed != type(uint256).max) {
                if (allowed < shares) revert UnauthorizedCaller();
                allowances[owner][msg.sender] = allowed - shares;
            }
        }

        // Effects: Actualización de balances
        _balances[owner] -= shares;
        _totalSupply -= shares;

        if (assets <= totalStablecoinInvested) {
            totalStablecoinInvested -= assets;
        } else {
            totalStablecoinInvested = 0;
        }

        // Interactions: Transferencia segura
        underlyingAsset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
        emit LiquidityWithdrawn(assets, receiver);
        return shares;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (to == address(0)) revert IProtocolErrors.ZeroAddress();
        if (_balances[msg.sender] < amount) revert InsufficientBalance();
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (to == address(0)) revert IProtocolErrors.ZeroAddress();
        if (_balances[from] < amount) revert InsufficientBalance();
        if (msg.sender != from && msg.sender != treasury) {
            uint256 allowed = allowances[from][msg.sender];
            if (allowed != type(uint256).max) {
                if (allowed < amount) revert UnauthorizedCaller();
                allowances[from][msg.sender] = allowed - amount;
            }
        }
        _balances[from] -= amount;
        _balances[to] += amount;
        return true;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        return true;
    }

    // --- Admin & Harvest Functions ---

    function setTreasury(address _treasury) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_treasury == address(0)) revert IProtocolErrors.ZeroAddress();
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    function setAPYs(uint256 _stablecoinApy, uint256 _ethApy, uint256 _btcApy)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
    {
        if (_stablecoinApy > MAX_APY_BPS || _ethApy > MAX_APY_BPS || _btcApy > MAX_APY_BPS) {
            revert IProtocolErrors.InvalidParameters();
        }
        morphoStablecoinApyBps = _stablecoinApy;
        lidoEthStakingApyBps = _ethApy;
        lombardBtcStakingApyBps = _btcApy;
        emit APYsUpdated(_stablecoinApy, _ethApy, _btcApy);
    }

    function depositStablecoins(uint256 amount) external nonReentrant returns (bool) {
        if (amount == 0) revert IProtocolErrors.ZeroAmount();
        uint256 shares = convertToShares(amount);
        if (shares == 0) revert IProtocolErrors.ZeroAmount();

        // Effects: Actualización contable previa a llamadas externas
        _balances[msg.sender] += shares;
        _totalSupply += shares;
        totalStablecoinInvested += amount;

        // Interactions: Transferencia segura
        underlyingAsset.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposit(msg.sender, msg.sender, amount, shares);
        emit DepositedToMorpho(amount);
        return true;
    }

    function getPendingYield() public view returns (uint256 pendingYield) {
        if (totalStablecoinInvested == 0 || lastHarvestTimestamp == 0) return 0;
        uint256 elapsedDays = (block.timestamp - lastHarvestTimestamp) / 1 days;
        if (elapsedDays == 0) return 0;
        pendingYield = (totalStablecoinInvested * morphoStablecoinApyBps * elapsedDays) / (BPS_DENOMINATOR * DAYS_PER_YEAR);
    }

    function withdrawLiquidity(uint256 amount) external nonReentrant returns (uint256 withdrawn) {
        if (msg.sender != treasury && !hasRole(ProtocolRoles.ADMIN_ROLE, msg.sender)) {
            revert IProtocolErrors.Unauthorized();
        }
        if (amount == 0) revert IProtocolErrors.ZeroAmount();

        uint256 bal = underlyingAsset.balanceOf(address(this));
        withdrawn = amount > bal ? bal : amount;

        if (withdrawn > 0) {
            if (withdrawn <= totalStablecoinInvested) {
                totalStablecoinInvested -= withdrawn;
            } else {
                totalStablecoinInvested = 0;
            }
            underlyingAsset.safeTransfer(treasury, withdrawn);
            emit LiquidityWithdrawn(withdrawn, treasury);
        }
    }

    function harvestYield() external nonReentrant returns (uint256 yieldHarvested) {
        lastHarvestTimestamp = block.timestamp;

        if (treasury != address(0)) {
            uint256 currentBalance = underlyingAsset.balanceOf(address(this));
            uint256 actualYield = currentBalance > totalStablecoinInvested
                ? currentBalance - totalStablecoinInvested
                : 0;

            if (actualYield > 0) {
                totalYieldHarvested += actualYield;
                underlyingAsset.safeTransfer(treasury, actualYield);
                emit YieldHarvested(actualYield, block.timestamp);
                return actualYield;
            }
        }
        return 0;
    }

    /**
     * @notice Rescata tokens transferidos erróneamente protegiendo las reservas invertidas.
     * @param token Dirección del activo a rescatar.
     * @param to Destinatario de los fondos.
     * @param amount Cantidad a transferir.
     */
    function sweepTokens(address token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        if (token == address(underlyingAsset)) {
            uint256 bal = underlyingAsset.balanceOf(address(this));
            if (bal <= totalStablecoinInvested) revert InsufficientBalance();
            if (amount > bal - totalStablecoinInvested) revert InsufficientBalance();
        }
        IERC20(token).safeTransfer(to, amount);
        emit TokensSwept(token, to, amount);
    }
}
