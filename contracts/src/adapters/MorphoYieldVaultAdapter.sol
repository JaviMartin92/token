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
 * @notice Adapts Treasury stablecoin liquid reserves and staking positions to institutional Morpho Blue / MetaMorpho vaults.
 *         Complies with IUniversalYieldAdapter (ERC-4626 style) while tracking dynamic simulated APYs.
 */
contract MorphoYieldVaultAdapter is AccessControl, ReentrancyGuard, IUniversalYieldAdapter {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlyingAsset;
    address public treasury;

    mapping(address => uint256) public _balances;
    mapping(address => mapping(address => uint256)) public allowances;
    uint256 public _totalSupply;

    uint256 public totalStablecoinInvested;
    uint256 public totalYieldHarvested;
    uint256 public lastHarvestTimestamp;

    // Simulated APYs in BPS (e.g. 645 Bps = 6.45% APY)
    uint256 public morphoStablecoinApyBps = 645; // 6.45% APY
    uint256 public lidoEthStakingApyBps = 420; // 4.20% APY
    uint256 public lombardBtcStakingApyBps = 380; // 3.80% APY

    uint256 public constant MAX_APY_BPS = 5000; // 50.00% APR Sanity Bound

    error InsufficientBalance();
    error UnauthorizedCaller();

    event DepositedToMorpho(uint256 amount);
    event YieldHarvested(uint256 yieldAmount, uint256 timestamp);
    event APYsUpdated(uint256 stablecoinApy, uint256 ethApy, uint256 btcApy);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event LiquidityWithdrawn(uint256 amount, address recipient);

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

    function deposit(uint256 assets, address receiver) external override nonReentrant returns (uint256 shares) {
        if (assets == 0) revert IProtocolErrors.ZeroAmount();
        shares = convertToShares(assets);
        underlyingAsset.safeTransferFrom(msg.sender, address(this), assets);

        _balances[receiver] += shares;
        _totalSupply += shares;
        totalStablecoinInvested += assets;

        emit DepositedToMorpho(assets);
        return shares;
    }

    function withdraw(uint256 assets, address receiver, address owner) external override nonReentrant returns (uint256 shares) {
        shares = convertToShares(assets);
        if (_balances[owner] < shares) revert InsufficientBalance();

        if (msg.sender != owner && msg.sender != treasury) {
            uint256 allowed = allowances[owner][msg.sender];
            if (allowed != type(uint256).max) {
                if (allowed < shares) revert UnauthorizedCaller();
                allowances[owner][msg.sender] = allowed - shares;
            }
        }

        _balances[owner] -= shares;
        _totalSupply -= shares;

        if (assets <= totalStablecoinInvested) {
            totalStablecoinInvested -= assets;
        } else {
            totalStablecoinInvested = 0;
        }

        underlyingAsset.safeTransfer(receiver, assets);
        emit LiquidityWithdrawn(assets, receiver);
        return shares;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (_balances[msg.sender] < amount) revert InsufficientBalance();
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
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
        underlyingAsset.safeTransferFrom(msg.sender, address(this), amount);

        uint256 shares = convertToShares(amount);
        _balances[msg.sender] += shares;
        _totalSupply += shares;
        totalStablecoinInvested += amount;

        emit DepositedToMorpho(amount);
        return true;
    }

    function getPendingYield() public view returns (uint256 pendingYield) {
        if (totalStablecoinInvested == 0 || lastHarvestTimestamp == 0) return 0;
        uint256 elapsedDays = (block.timestamp - lastHarvestTimestamp) / 1 days;
        if (elapsedDays == 0) return 0;
        pendingYield = (totalStablecoinInvested * morphoStablecoinApyBps * elapsedDays) / (10000 * 365);
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
        yieldHarvested = getPendingYield();
        lastHarvestTimestamp = block.timestamp;

        if (yieldHarvested > 0 && treasury != address(0)) {
            uint256 bal = underlyingAsset.balanceOf(address(this));
            uint256 actualYield = bal >= yieldHarvested ? yieldHarvested : bal;

            if (actualYield > 0) {
                totalYieldHarvested += actualYield;
                underlyingAsset.safeTransfer(treasury, actualYield);
                emit YieldHarvested(actualYield, block.timestamp);
                return actualYield;
            }
        }
        return 0;
    }
}
