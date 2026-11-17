// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IUniversalYieldAdapter} from "../interfaces/IUniversalYieldAdapter.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "../lib/access/Ownable.sol";
import "../lib/security/ReentrancyGuard.sol";
import "../interfaces/IProtocolErrors.sol";

/**
 * @title AaveV3Adapter
 * @author Viraje Protocol Architecture Team
 * @notice Adaptador institucional de rendimiento compatible con ERC-4626 para los mercados de Aave V3.
 * @dev Permite el depósito y retiro de activos subyacentes con devengo continuo de rendimiento
 *      gobernado por yieldFactor, con inmunidad a reentrancia y protección de solvencia fiduciaria.
 */
contract AaveV3Adapter is IUniversalYieldAdapter, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Constantes Institucionales ---
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MIN_YIELD_FACTOR = 10000; // 1.0x (100% paridad base)
    uint256 public constant MAX_YIELD_FACTOR = 50000; // 5.0x (500% techo máximo prudencial)

    IERC20 public immutable underlyingAsset;

    mapping(address => uint256) public _balances;
    uint256 public _totalSupply;

    // Simulación y seguimiento de rendimiento (10000 = 1:1, 10500 = 5% yield)
    uint256 public yieldFactor = 10000;

    mapping(address => mapping(address => uint256)) public allowances;

    // --- Errores Personalizados de Dominio (EIP-838) ---
    error InvalidYieldFactorRange(uint256 factor);
    error InsufficientBalance();
    error UnauthorizedCaller();

    // --- Eventos Institucionales EIP-4626 ---
    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
    event YieldFactorUpdated(uint256 oldFactor, uint256 newFactor);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Inicializa el adaptador con el activo subyacente.
     * @param _asset Dirección del token ERC-20 subyacente (e.g. USDC).
     */
    constructor(address _asset) Ownable() {
        if (_asset == address(0)) revert IProtocolErrors.ZeroAddress();
        underlyingAsset = IERC20(_asset);
    }

    function asset() external view override returns (address) {
        return address(underlyingAsset);
    }

    function totalAssets() external view override returns (uint256) {
        return (_totalSupply * yieldFactor) / BPS_DENOMINATOR;
    }

    function convertToShares(uint256 assets) public view override returns (uint256) {
        if (_totalSupply == 0) return assets;
        return (assets * BPS_DENOMINATOR) / yieldFactor;
    }

    function convertToAssets(uint256 shares) public view override returns (uint256) {
        return (shares * yieldFactor) / BPS_DENOMINATOR;
    }

    /**
     * @notice Deposita activos subyacentes y acuña participaciones para el receptor.
     * @dev Sigue estrictamente el patrón Checks-Effects-Interactions (CEI).
     * @param assets Cantidad de activo subyacente a depositar.
     * @param receiver Dirección beneficiaria de las participaciones emitidas.
     * @return shares Cantidad de participaciones acuñadas.
     */
    function deposit(uint256 assets, address receiver) external override nonReentrant returns (uint256 shares) {
        if (assets == 0) revert IProtocolErrors.ZeroAmount();
        if (receiver == address(0)) revert IProtocolErrors.ZeroAddress();

        shares = convertToShares(assets);

        // Effects: Actualización de balances antes de llamadas externas
        _balances[receiver] += shares;
        _totalSupply += shares;

        // Interactions: Transferencia de fondos desde el llamante
        underlyingAsset.safeTransferFrom(msg.sender, address(this), assets);

        emit Deposit(msg.sender, receiver, assets, shares);
        return shares;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        return true;
    }

    /**
     * @notice Retira activos subyacentes quemando participaciones del propietario.
     * @param assets Cantidad de activos a retirar.
     * @param receiver Dirección receptora de los fondos subyacentes.
     * @param owner Propietario de las participaciones a quemar.
     * @return shares Cantidad de participaciones quemadas.
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external override nonReentrant returns (uint256 shares) {
        if (assets == 0) revert IProtocolErrors.ZeroAmount();
        if (receiver == address(0) || owner == address(0)) revert IProtocolErrors.ZeroAddress();

        shares = convertToShares(assets);
        if (_balances[owner] < shares) revert InsufficientBalance();

        if (msg.sender != owner) {
            uint256 allowed = allowances[owner][msg.sender];
            if (allowed != type(uint256).max) {
                if (allowed < shares) revert UnauthorizedCaller();
                allowances[owner][msg.sender] = allowed - shares;
            }
        }

        // Effects: Quema de participaciones
        _balances[owner] -= shares;
        _totalSupply -= shares;

        // Interactions: Transferencia segura del activo subyacente
        uint256 currentBal = underlyingAsset.balanceOf(address(this));
        uint256 toSend = assets <= currentBal ? assets : currentBal;
        underlyingAsset.safeTransfer(receiver, toSend);

        emit Withdraw(msg.sender, receiver, owner, toSend, shares);
        return shares;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    /**
     * @notice Ajuste del factor de rendimiento restringido al propietario con límites económicos seguros.
     * @param newFactor Nuevo multiplicador en puntos básicos (10000 = 100%, 50000 = 500%).
     */
    function setYieldFactor(uint256 newFactor) public onlyOwner {
        if (newFactor < MIN_YIELD_FACTOR || newFactor > MAX_YIELD_FACTOR) {
            revert InvalidYieldFactorRange(newFactor);
        }
        uint256 old = yieldFactor;
        yieldFactor = newFactor;
        emit YieldFactorUpdated(old, newFactor);
    }

    function simulateYield(uint256 newFactor) external onlyOwner {
        setYieldFactor(newFactor);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (to == address(0)) revert IProtocolErrors.ZeroAddress();
        if (_balances[msg.sender] < amount) revert InsufficientBalance();
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        return true;
    }

    /**
     * @notice Rescata tokens transferidos erróneamente protegiendo las reservas de respaldo requeridas.
     * @param token Dirección del activo a rescatar.
     * @param to Destinatario de los fondos.
     * @param amount Cantidad a transferir.
     */
    function sweepTokens(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        if (token == address(underlyingAsset)) {
            uint256 bal = underlyingAsset.balanceOf(address(this));
            uint256 required = (_totalSupply * yieldFactor) / BPS_DENOMINATOR;
            if (bal <= required) revert InsufficientBalance();
            if (amount > bal - required) revert InsufficientBalance();
        }
        IERC20(token).safeTransfer(to, amount);
        emit TokensSwept(token, to, amount);
    }
}
