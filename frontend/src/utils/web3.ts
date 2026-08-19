import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { VALIDATED_CONTRACT_ADDRESSES } from '../config/contracts.js';
import { ENV } from '../config/env.js';

const ANVIL_URL = typeof window !== 'undefined' ? `${window.location.origin}/rpc` : ENV.VITE_PUBLIC_RPC_URL;

// Deployed contract addresses (validated via Zod)
export const CONTRACT_ADDRESSES = VALIDATED_CONTRACT_ADDRESSES;

const anvilChain = {
  id: ENV.VITE_CHAIN_ID,
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

export const getWalletClient = (userAddress?: string) => {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('Conecta una cartera compatible para firmar transacciones.');
  }
  const account = (userAddress && userAddress.startsWith('0x') ? (userAddress as `0x${string}`) : '0x0000000000000000000000000000000000000000');
  return createWalletClient({
    account,
    chain: anvilChain,
    transport: custom((window as any).ethereum)
  });
};

// Minimum required ABIs for dashboard actions
export const ABIS = {
  ERC20: [
    { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'transferFrom', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
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
    { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'stableAmount', type: 'uint256' }, { name: 'minSharesOut', type: 'uint256' }], outputs: [{ name: 'sharesMinted', type: 'uint256' }] },
    { name: 'redeem', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'sharesAmount', type: 'uint256' }, { name: 'minUsdcOut', type: 'uint256' }], outputs: [{ name: 'assetsReceived', type: 'uint256' }] },
    { name: 'setAssetWeights', type: 'function', stateMutability: 'nonpayable', inputs: [
      { name: '_stables', type: 'uint256' },
      { name: '_wbtc', type: 'uint256' },
      { name: '_weth', type: 'uint256' },
      { name: '_alpha', type: 'uint256' }
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
    { name: 'calculateTotalOwed', type: 'function', stateMutability: 'view', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [{ name: 'totalOwed', type: 'uint256' }, { name: 'interest', type: 'uint256' }] },
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
    { name: 'cancelLoanOffer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [] },
    { name: 'borrowFromTreasury', type: 'function', stateMutability: 'nonpayable', inputs: [
      { name: 'positionTokenId', type: 'uint256' },
      { name: 'borrowAmount', type: 'uint256' },
      { name: 'durationDays', type: 'uint256' }
    ], outputs: [{ name: 'loanId', type: 'uint256' }] },
    { name: 'borrowFromTreasuryWithAlpha', type: 'function', stateMutability: 'nonpayable', inputs: [
      { name: 'alphaCollateralAmount', type: 'uint256' },
      { name: 'borrowAmount', type: 'uint256' },
      { name: 'durationDays', type: 'uint256' }
    ], outputs: [{ name: 'loanId', type: 'uint256' }] },
    { name: 'borrowFromTreasuryWithAsset', type: 'function', stateMutability: 'nonpayable', inputs: [
      { name: 'collateralAsset', type: 'address' },
      { name: 'collateralAmount', type: 'uint256' },
      { name: 'borrowAmount', type: 'uint256' },
      { name: 'durationDays', type: 'uint256' }
    ], outputs: [{ name: 'loanId', type: 'uint256' }] },
    { name: 'loanCollateralAsset', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] }
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
        { name: 'communityVaultStaked', type: 'uint256' },
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
    { name: 'isApprovedForAll', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'operator', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'setApprovalForAll', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [] },
    { name: 'mintPosition', type: 'function', stateMutability: 'nonpayable', inputs: [
      { name: 'to', type: 'address' },
      { name: 'underlyingAsset', type: 'address' },
      { name: 'principalAmount', type: 'uint256' },
      { name: 'discountedPricePaid', type: 'uint256' },
      { name: 'lockYears', type: 'uint256' }
    ], outputs: [{ name: 'tokenId', type: 'uint256' }] },
    { name: 'nextTokenId', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'getPosition', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{
      name: 'position',
      type: 'tuple',
      components: [
        { name: 'id', type: 'uint256' },
        { name: 'underlyingAsset', type: 'address' },
        { name: 'depositTimestamp', type: 'uint64' },
        { name: 'lockYears', type: 'uint32' },
        { name: 'expirationTimestamp', type: 'uint64' },
        { name: 'isRagequitted', type: 'bool' },
        { name: 'isMaturedClaimed', type: 'bool' },
        { name: 'principalAmount', type: 'uint256' },
        { name: 'discountedPricePaid', type: 'uint256' }
      ]
    }]}
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
