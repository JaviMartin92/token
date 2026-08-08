import { createPublicClient, createWalletClient, http } from 'viem';

import contractsJson from '../contracts.json';

export const ANVIL_URL = typeof window !== 'undefined' ? `${window.location.origin}/rpc` : 'http://127.0.0.1:8545';

// Deployed contract addresses (matches Anvil setup)
export const CONTRACT_ADDRESSES = {
  USDC: ((contractsJson as any).USDC || import.meta.env.VITE_USDC_ADDRESS) as `0x${string}`,
  USDT: ((contractsJson as any).USDT || import.meta.env.VITE_USDT_ADDRESS) as `0x${string}`,
  WBTC: ((contractsJson as any).WBTC || import.meta.env.VITE_WBTC_ADDRESS) as `0x${string}`,
  WETH: ((contractsJson as any).WETH || import.meta.env.VITE_WETH_ADDRESS) as `0x${string}`,
  TREASURY: ((contractsJson as any).TREASURY || import.meta.env.VITE_TREASURY_MANAGER_ADDRESS) as `0x${string}`,
  ALPHA_TOKEN: ((contractsJson as any).ALPHA_TOKEN || import.meta.env.VITE_ALPHA_TOKEN_ADDRESS) as `0x${string}`,
  CORPORATE_CONTRIBUTION: ((contractsJson as any).CORPORATE_CONTRIBUTION || import.meta.env.VITE_CORPORATE_CONTRIBUTION_ADDRESS) as `0x${string}`,
  CIRCUIT_BREAKER: ((contractsJson as any).CIRCUIT_BREAKER || import.meta.env.VITE_CIRCUIT_BREAKER_ADDRESS) as `0x${string}`,
  POSITION_NFT: ((contractsJson as any).POSITION_NFT || import.meta.env.VITE_POSITION_NFT_ADDRESS) as `0x${string}`,
  VESTED_VAULT: ((contractsJson as any).VESTED_VAULT || import.meta.env.VITE_VESTED_VAULT_ADDRESS) as `0x${string}`,
  P2P_MARKET: ((contractsJson as any).P2P_MARKET || import.meta.env.VITE_P2P_MARKET_ADDRESS) as `0x${string}`,
  STAKING: ((contractsJson as any).STAKING || import.meta.env.VITE_STAKING_ADDRESS) as `0x${string}`,
  REAL_YIELD_ROUTER: ((contractsJson as any).REAL_YIELD_ROUTER || import.meta.env.VITE_REAL_YIELD_ROUTER_ADDRESS) as `0x${string}`,
  YIELD_VAULT: ((contractsJson as any).YIELD_VAULT || import.meta.env.VITE_YIELD_STREAMING_VAULT_ADDRESS) as `0x${string}`,
  CORPORATE_OPEX: ((contractsJson as any).CORPORATE_OPEX_VAULT || (contractsJson as any).CORPORATE_OPEX) as `0x${string}`,
  CORPORATE_OPEX_VAULT: ((contractsJson as any).CORPORATE_OPEX_VAULT || (contractsJson as any).CORPORATE_OPEX) as `0x${string}`,
  CORPORATE_PROFIT: ((contractsJson as any).CORPORATE_PROFIT_VAULT || (contractsJson as any).CORPORATE_PROFIT) as `0x${string}`,
  CORPORATE_PROFIT_VAULT: ((contractsJson as any).CORPORATE_PROFIT_VAULT || (contractsJson as any).CORPORATE_PROFIT) as `0x${string}`,
  ALPHA_VAULT: ((contractsJson as any).ALPHA_VAULT) as `0x${string}`,
  PRICE_FEED: ((contractsJson as any).ORACLE_ROUTER || (contractsJson as any).PRICE_FEED) as `0x${string}`,
  PROMOTIONAL_VAULT: ((contractsJson as any).PROMO_VAULT) as `0x${string}`,
  DYNAMIC_YIELD_ORACLE: ((contractsJson as any).DYNAMIC_YIELD_ORACLE) as `0x${string}`
};

const anvilChain = {
  id: 31337,
  name: 'Anvil Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [ANVIL_URL] },
    public: { http: [ANVIL_URL] }
  }
};

export const publicClient = createPublicClient({
  chain: anvilChain,
  transport: http(ANVIL_URL)
});

import { privateKeyToAccount } from 'viem/accounts';

export const getWalletClient = (privateKey: string) => {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain: anvilChain,
    transport: http(ANVIL_URL)
  });
};

export const walletClient = createWalletClient({
  chain: anvilChain,
  transport: http(ANVIL_URL)
});

// Minimum required ABIs for dashboard actions
export const ABIS = {
  ERC20: [
    { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'transferFrom', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] }
  ] as const,
  TREASURY: [
    { name: 'getNAV', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'getProtocolOverview', type: 'function', stateMutability: 'view', inputs: [], outputs: [
      { name: 'overview', type: 'tuple', components: [
        { name: 'totalAssetsUSD', type: 'uint256' },
        { name: 'totalLiabilitiesUSD', type: 'uint256' },
        { name: 'collateralRatioBps', type: 'uint256' },
        { name: 'navPerShareUSD', type: 'uint256' },
        { name: 'netCirculatingShares', type: 'uint256' },
        { name: 'totalBurnedTokens', type: 'uint256' }
      ]}
    ]},
    { name: 'validateSanityBounds', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
    { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'stableAmount', type: 'uint256' }], outputs: [{ name: 'sharesMinted', type: 'uint256' }] },
    { name: 'redeem', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'sharesAmount', type: 'uint256' }], outputs: [{ name: 'assetsReceived', type: 'uint256' }] },
    { name: 'setAssetWeights', type: 'function', stateMutability: 'nonpayable', inputs: [
      { name: 'newWeights', type: 'tuple', components: [
        { name: 'stablecoins', type: 'uint256' },
        { name: 'wbtc', type: 'uint256' },
        { name: 'weth', type: 'uint256' },
        { name: 'alphaProtocolStaking', type: 'uint256' }
      ]}
    ], outputs: [] },
    { name: 'currentWeights', type: 'function', stateMutability: 'view', inputs: [], outputs: [
      { name: 'stablecoins', type: 'uint256' },
      { name: 'wbtc', type: 'uint256' },
      { name: 'weth', type: 'uint256' },
      { name: 'alphaProtocolStaking', type: 'uint256' }
    ]},
    { name: 'getProofOfReserves', type: 'function', stateMutability: 'view', inputs: [], outputs: [
      { name: 'totalAssetsUSD', type: 'uint256' },
      { name: 'totalLiabilitiesUSD', type: 'uint256' },
      { name: 'collateralRatioBps', type: 'uint256' }
    ]},
    { name: 'getAssetBreakdown', type: 'function', stateMutability: 'view', inputs: [], outputs: [
      { name: 'stablesUsd', type: 'uint256' },
      { name: 'wbtcUsd', type: 'uint256' },
      { name: 'wethUsd', type: 'uint256' },
      { name: 'loansUsd', type: 'uint256' }
    ]},
    { name: 'calculateDynamicFeeBps', type: 'function', stateMutability: 'pure', inputs: [
      { name: 'grossDepositUSD', type: 'uint256' },
      { name: 'totalAssetsExogenousUSD', type: 'uint256' }
    ], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'getNAVPerShare', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'tvlCap', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'priceFeeds', type: 'function', stateMutability: 'view', inputs: [{ name: 'asset', type: 'address' }], outputs: [{ name: '', type: 'address' }] }
  ] as const,
  VESTED_VAULT: [
    { name: 'buyVestedBond', type: 'function', stateMutability: 'nonpayable', inputs: [
      { name: 'principalAmount', type: 'uint256' },
      { name: 'lockYears', type: 'uint256' },
      { name: 'referrer', type: 'address' }
    ], outputs: [{ name: 'tokenId', type: 'uint256' }] },
    { name: 'ragequit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [] },
    { name: 'claimMatured', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [] },
    { name: 'calculateDiscountBps', type: 'function', stateMutability: 'view', inputs: [
      { name: 'user', type: 'address' },
      { name: 'lockYears', type: 'uint256' }
    ], outputs: [{ name: 'discountBps', type: 'uint256' }] },
    { name: 'getUserVestedOverview', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [
      { name: 'overview', type: 'tuple', components: [
        { name: 'baseDiscount1YearBps', type: 'uint256' },
        { name: 'baseDiscount3YearsBps', type: 'uint256' },
        { name: 'baseDiscount5YearsBps', type: 'uint256' },
        { name: 'vipBonusBps', type: 'uint256' },
        { name: 'userStalphaBalance', type: 'uint256' }
      ]}
    ]},
    { name: 'totalInvested', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'tvlCap', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }
  ] as const,
  P2P_MARKET: [
    { name: 'createLoanOffer', type: 'function', stateMutability: 'nonpayable', inputs: [
      { name: 'positionTokenId', type: 'uint256' },
      { name: 'borrowAmount', type: 'uint256' },
      { name: 'interestRateBps', type: 'uint256' },
      { name: 'durationDays', type: 'uint256' }
    ], outputs: [{ name: 'loanId', type: 'uint256' }] },
    { name: 'acceptLoanAndDepositCollateral', type: 'function', stateMutability: 'nonpayable', inputs: [
      { name: 'loanId', type: 'uint256' },
      { name: 'collateralAmount', type: 'uint256' }
    ], outputs: [] },
    { name: 'fundLoanOffer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [] },
    { name: 'repayLoan', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [] },
    { name: 'liquidateLoan', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [] },
    { name: 'calculateHealthFactor', type: 'function', stateMutability: 'view', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [{ name: 'healthFactorRatio', type: 'uint256' }] },
    { name: 'getMarketplaceOverview', type: 'function', stateMutability: 'view', inputs: [], outputs: [
      { name: 'stats', type: 'tuple', components: [
        { name: 'totalActiveLoans', type: 'uint256' },
        { name: 'totalVolumeUSD', type: 'uint256' },
        { name: 'activeBorrowUSD', type: 'uint256' },
        { name: 'activeCollateralUSD', type: 'uint256' },
        { name: 'activeInterestUSD', type: 'uint256' }
      ]}
    ]},
    { name: 'nextLoanId', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'loans', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'uint256' }], outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'lender', type: 'address' },
      { name: 'borrower', type: 'address' },
      { name: 'positionTokenId', type: 'uint256' },
      { name: 'borrowAmount', type: 'uint256' },
      { name: 'collateralAmount', type: 'uint256' },
      { name: 'interestRateBps', type: 'uint256' },
      { name: 'durationDays', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'state', type: 'uint8' }
    ]},
    { name: 'cancelLoanOffer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [] }
  ] as const,
  STAKING: [
    { name: 'stake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
    { name: 'unstake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
    { name: 'stakedBalances', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'totalStaked', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'earned', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'getStakingBreakdown', type: 'function', stateMutability: 'view', inputs: [], outputs: [
      { name: 'breakdown', type: 'tuple', components: [
        { name: 'communityStaked', type: 'uint256' },
        { name: 'corporateStaked', type: 'uint256' },
        { name: 'treasuryStaked', type: 'uint256' },
        { name: 'globalTotalStaked', type: 'uint256' },
        { name: 'netCirculatingSupply', type: 'uint256' },
        { name: 'totalBurned', type: 'uint256' }
      ]}
    ]},
    { name: 'getUserStakingInfo', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [
      { name: 'stakedBalance', type: 'uint256' },
      { name: 'claimableYieldUSD', type: 'uint256' }
    ]}
  ] as const,
  REAL_YIELD_ROUTER: [
    { name: 'setPayoutPreference', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'preference', type: 'uint8' }], outputs: [] },
    { name: 'claimRealYield', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [{ name: 'payoutAmount', type: 'uint256' }] },
    { name: 'userPreferences', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint8' }] }
  ] as const,
  DYNAMIC_YIELD_ORACLE: [
    { name: 'calculateWeightedYieldBps', type: 'function', stateMutability: 'view', inputs: [
      { name: 'stablesUsd', type: 'uint256' },
      { name: 'wbtcUsd', type: 'uint256' },
      { name: 'wethUsd', type: 'uint256' }
    ], outputs: [{ name: 'weightedApyBps', type: 'uint256' }] },
    { name: 'getBestYieldVault', type: 'function', stateMutability: 'view', inputs: [{ name: 'assetClass', type: 'uint8' }], outputs: [
      { name: 'bestName', type: 'string' },
      { name: 'bestVaultAddress', type: 'address' },
      { name: 'highestApyBps', type: 'uint256' }
    ]}
  ] as const,
  POSITION_NFT: [
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [] },
    { name: 'getApproved', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
    { name: 'setApprovalForAll', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [] },
    { name: 'mintPosition', type: 'function', stateMutability: 'nonpayable', inputs: [
      { name: 'to', type: 'address' },
      { name: 'underlyingAsset', type: 'address' },
      { name: 'principalAmount', type: 'uint256' },
      { name: 'discountedPricePaid', type: 'uint256' },
      { name: 'lockYears', type: 'uint256' }
    ], outputs: [{ name: 'tokenId', type: 'uint256' }] },
    { name: 'nextTokenId', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'getPosition', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'underlyingAsset', type: 'address' },
      { name: 'principalAmount', type: 'uint256' },
      { name: 'discountedPricePaid', type: 'uint256' },
      { name: 'depositTimestamp', type: 'uint256' },
      { name: 'expirationTimestamp', type: 'uint256' },
      { name: 'lockYears', type: 'uint256' },
      { name: 'isRagequitted', type: 'bool' },
      { name: 'isMaturedClaimed', type: 'bool' }
    ]}
  ] as const,
  CORPORATE_CONTRIBUTION: [
    { name: 'injectFunds', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }, { name: 'auditRef', type: 'string' }], outputs: [] },
    { name: 'createTWAPOrder', type: 'function', stateMutability: 'nonpayable', inputs: [
      { name: 'totalAmountUSD', type: 'uint256' },
      { name: 'intervals', type: 'uint256' },
      { name: 'intervalSeconds', type: 'uint256' }
    ], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'twapOrders', type: 'function', stateMutability: 'view', inputs: [{ name: 'orderId', type: 'uint256' }], outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'amountPerInterval', type: 'uint256' },
      { name: 'intervalSeconds', type: 'uint256' },
      { name: 'nextExecutionTime', type: 'uint256' },
      { name: 'executionsRemaining', type: 'uint256' }
    ]}
  ] as const,
  CIRCUIT_BREAKER: [
    { name: 'isFrozen', type: 'function', stateMutability: 'view', inputs: [{ name: 'asset', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'checkAssetDeviation', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }], outputs: [{ name: 'triggered', type: 'bool' }] },
    { name: 'resetBreaker', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }], outputs: [] }
  ] as const,
  PRICE_FEED: [
    {
      name: 'getAssetUsdValue',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'asset', type: 'address' },
        { name: 'assetBalance', type: 'uint256' }
      ],
      outputs: [{ name: 'usdValue', type: 'uint256' }]
    }
  ] as const
};
