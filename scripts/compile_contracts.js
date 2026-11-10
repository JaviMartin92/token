const solc = require('solc');
const fs = require('fs');
const path = require('path');

const source = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract SepoliaVirajeToken is IERC20 {
    string public name = "Viraje Shares";
    string public symbol = "VIRAJE";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    address public owner;
    address public minter;

    modifier onlyOwnerOrMinter() {
        require(msg.sender == owner || msg.sender == minter, "Unauthorized");
        _;
    }

    constructor(address _owner) {
        owner = _owner;
    }

    function setMinter(address _minter) external {
        require(msg.sender == owner, "Only owner");
        minter = _minter;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(balanceOf[from] >= value, "Insufficient balance");
        if (msg.sender != from && allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= value, "Allowance exceeded");
            allowance[from][msg.sender] -= value;
        }
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
        return true;
    }

    function mint(address to, uint256 amount) external onlyOwnerOrMinter {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }

    function burnFrom(address account, uint256 amount) external onlyOwnerOrMinter {
        require(balanceOf[account] >= amount, "Insufficient balance");
        if (msg.sender != account && allowance[account][msg.sender] != type(uint256).max) {
            require(allowance[account][msg.sender] >= amount, "Allowance exceeded");
            allowance[account][msg.sender] -= amount;
        }
        balanceOf[account] -= amount;
        totalSupply -= amount;
        emit Transfer(account, address(0), amount);
    }
}

contract SepoliaTreasury {
    address public owner;
    address public usdcToken;
    address public alphaToken;
    uint256 public tvlCap = 1_000_000 * 1e18; // $1,000,000 USD
    uint256 public totalBurnedTokens = 0;

    struct ProtocolOverview {
        uint256 totalAssetsUSD;
        uint256 totalLiabilitiesUSD;
        uint256 collateralRatioBps;
        uint256 navPerShareUSD;
        uint256 netCirculatingShares;
        uint256 totalBurnedTokens;
    }

    event Deposited(address indexed user, uint256 usdcAmount, uint256 sharesMinted);
    event Redeemed(address indexed user, uint256 sharesBurned, uint256 usdcReturned);

    constructor(address _usdc, address _owner) {
        usdcToken = _usdc;
        owner = _owner;
    }

    function setAlphaToken(address _alpha) external {
        require(msg.sender == owner, "Only owner");
        alphaToken = _alpha;
    }

    function setTvlCap(uint256 _cap) external {
        require(msg.sender == owner, "Only owner");
        tvlCap = _cap;
    }

    function deposit(uint256 stableAmount, uint256 minSharesOut) external returns (uint256 sharesMinted) {
        require(stableAmount > 0, "Zero amount");
        require(alphaToken != address(0), "Alpha token not set");

        bool success = IERC20(usdcToken).transferFrom(msg.sender, address(this), stableAmount);
        require(success, "USDC transfer failed");

        sharesMinted = stableAmount * 1e12; // 6 dec to 18 dec
        require(sharesMinted >= minSharesOut, "Slippage limit");

        uint256 currentTvlUSD = (IERC20(usdcToken).balanceOf(address(this)) * 1e12);
        require(currentTvlUSD <= tvlCap, "TVL Cap Exceeded");

        SepoliaVirajeToken(alphaToken).mint(msg.sender, sharesMinted);

        emit Deposited(msg.sender, stableAmount, sharesMinted);
        return sharesMinted;
    }

    function redeem(uint256 sharesAmount, uint256 minUsdcOut) external returns (uint256 assetsReceived) {
        require(sharesAmount > 0, "Zero shares");
        require(alphaToken != address(0), "Alpha token not set");

        assetsReceived = sharesAmount / 1e12;
        require(assetsReceived >= minUsdcOut, "Slippage limit");
        require(IERC20(usdcToken).balanceOf(address(this)) >= assetsReceived, "Insufficient treasury USDC");

        SepoliaVirajeToken(alphaToken).burnFrom(msg.sender, sharesAmount);
        totalBurnedTokens += sharesAmount;

        bool success = IERC20(usdcToken).transfer(msg.sender, assetsReceived);
        require(success, "USDC transfer failed");

        emit Redeemed(msg.sender, sharesAmount, assetsReceived);
        return assetsReceived;
    }

    function getNAVPerShare() external pure returns (uint256) {
        return 1e18;
    }

    function getNAV() external view returns (uint256) {
        return IERC20(usdcToken).balanceOf(address(this)) * 1e12;
    }

    function getProofOfReserves() external view returns (uint256, uint256, uint256) {
        uint256 assets = IERC20(usdcToken).balanceOf(address(this)) * 1e12;
        uint256 liabilities = alphaToken != address(0) ? IERC20(alphaToken).totalSupply() : 0;
        uint256 ratio = liabilities == 0 ? 10000 : (assets * 10000) / liabilities;
        return (assets, liabilities, ratio);
    }

    function getProtocolOverview() external view returns (ProtocolOverview memory overview) {
        uint256 assets = IERC20(usdcToken).balanceOf(address(this)) * 1e12;
        uint256 liabilities = alphaToken != address(0) ? IERC20(alphaToken).totalSupply() : 0;
        uint256 ratio = liabilities == 0 ? 10000 : (assets * 10000) / liabilities;
        return ProtocolOverview({
            totalAssetsUSD: assets,
            totalLiabilitiesUSD: liabilities,
            collateralRatioBps: ratio,
            navPerShareUSD: 1e18,
            netCirculatingShares: liabilities,
            totalBurnedTokens: totalBurnedTokens
        });
    }

    function currentWeights() external pure returns (uint256, uint256, uint256, uint256) {
        return (5000, 2500, 1250, 1250);
    }

    function getAssetBreakdown() external view returns (uint256, uint256, uint256, uint256) {
        uint256 stables = IERC20(usdcToken).balanceOf(address(this)) * 1e12;
        return (stables, 0, 0, 0);
    }

    function validateSanityBounds() external pure returns (bool) {
        return true;
    }

    function calculateDynamicFeeBps(uint256, uint256) external pure returns (uint256) {
        return 50;
    }

    function priceFeeds(address) external view returns (address) {
        return address(0);
    }

    function getTotalAssetsExogenousUSD() external view returns (uint256) {
        return IERC20(usdcToken).balanceOf(address(this)) * 1e12;
    }
}
`;

function compile() {
  const input = {
    language: 'Solidity',
    sources: { 'SepoliaContracts.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    const hasError = output.errors.some(e => e.severity === 'error');
    output.errors.forEach(e => console.error(e.formattedMessage));
    if (hasError) throw new Error('Compilation failed');
  }

  const token = output.contracts['SepoliaContracts.sol']['SepoliaVirajeToken'];
  const treasury = output.contracts['SepoliaContracts.sol']['SepoliaTreasury'];

  return {
    SepoliaVirajeToken: {
      abi: token.abi,
      bytecode: '0x' + token.evm.bytecode.object
    },
    SepoliaTreasury: {
      abi: treasury.abi,
      bytecode: '0x' + treasury.evm.bytecode.object
    }
  };
}

module.exports = { compile, source };

if (require.main === module) {
  const result = compile();
  console.log('✅ SepoliaVirajeToken bytecode size:', result.SepoliaVirajeToken.bytecode.length / 2, 'bytes');
  console.log('✅ SepoliaTreasury bytecode size:', result.SepoliaTreasury.bytecode.length / 2, 'bytes');
}
