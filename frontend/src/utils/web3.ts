import { createPublicClient, createWalletClient, http } from 'viem';

import contractsJson from '../contracts.json';

export const ANVIL_URL = typeof window !== 'undefined' ? `${window.location.origin}/rpc` : 'http://127.0.0.1:8545';

// Deployed contract addresses (matches Anvil setup)
export const CONTRACT_ADDRESSES = {
  USDC: ((contractsJson as any).USDC || import.meta.env.VITE_USDC_ADDRESS || '0x09635f643e140090a9a8dcd712ed6285858cebef') as `0x${string}`,
  USDT: ((contractsJson as any).USDT || import.meta.env.VITE_USDT_ADDRESS || '0xc5a5c42992decbae36851359345fe25997f5c42d') as `0x${string}`,
  TREASURY: ((contractsJson as any).TREASURY || import.meta.env.VITE_TREASURY_ADDRESS || '0xc3e53f4d16ae77db1c982e75a937b9f60fe63690') as `0x${string}`,
  CORPORATE_CONTRIBUTION: ((contractsJson as any).CORPORATE_CONTRIBUTION || import.meta.env.VITE_CORPORATE_CONTRIBUTION_ADDRESS || '0x1613beb3b2c4f22ee086b2b38c1476a3ce7f78e8') as `0x${string}`,
  CIRCUIT_BREAKER: ((contractsJson as any).CIRCUIT_BREAKER || import.meta.env.VITE_CIRCUIT_BREAKER_ADDRESS || '0x84ea74d481ee0a5332c457a4d796187f6ba67feb') as `0x${string}`,
  POSITION_NFT: ((contractsJson as any).POSITION_NFT || import.meta.env.VITE_POSITION_NFT_ADDRESS || '0x851356ae760d987e095750cceb3bc6014560891c') as `0x${string}`,
  VESTED_VAULT: ((contractsJson as any).VESTED_VAULT || import.meta.env.VITE_VESTED_VAULT_ADDRESS || '0x4826533b4897376654bb4d4ad88b7fafd0c98528') as `0x${string}`,
  P2P_MARKET: ((contractsJson as any).P2P_MARKET || import.meta.env.VITE_P2P_MARKET_ADDRESS || '0x0e801d84fa97b50751dbf25036d067dcf18858bf') as `0x${string}`,
  STAKING: ((contractsJson as any).STAKING || import.meta.env.VITE_STAKING_ADDRESS || '0xf5059a5d33d5853360d16c683c16e67980206f36') as `0x${string}`,
  REAL_YIELD_ROUTER: ((contractsJson as any).REAL_YIELD_ROUTER || import.meta.env.VITE_REAL_YIELD_ROUTER_ADDRESS || '0x95401dc811bb5740090279ba06cfa8fcf6113778') as `0x${string}`,
  YIELD_VAULT: ((contractsJson as any).YIELD_VAULT || import.meta.env.VITE_YIELD_STREAMING_VAULT_ADDRESS || '0xa82ff9afd8f496c3d6ac40e2a0f282e47488cfc9') as `0x${string}`,
  PRICE_FEED: ((contractsJson as any).ORACLE_ROUTER || (contractsJson as any).PRICE_FEED || '0xa9e6bfa2bf53de88feb19761d9b2ee2e821bf1bf') as `0x${string}`
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
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'transferFrom', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] }
  ] as const,
  TREASURY: [
    { name: 'getNAV', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'validateSanityBounds', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
    { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'stableAmount', type: 'uint256' }], outputs: [{ name: 'sharesMinted', type: 'uint256' }] },
    { name: 'redeem', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'sharesAmount', type: 'uint256' }], outputs: [{ name: 'assetsReceived', type: 'uint256' }] },
    { name: 'adjustWeights', type: 'function', stateMutability: 'nonpayable', inputs: [
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
    { name: 'nextLoanId', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'cancelLoanOffer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [] },
    { name: 'loans', type: 'function', stateMutability: 'view', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [
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
    ]}
  ] as const,
  STAKING: [
    { name: 'stake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
    { name: 'unstake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
    { name: 'stakedBalances', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'earned', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }
  ] as const,
  REAL_YIELD_ROUTER: [
    { name: 'setPayoutPreference', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'preference', type: 'uint8' }], outputs: [] },
    { name: 'claimRealYield', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [{ name: 'payoutAmount', type: 'uint256' }] },
    { name: 'userPreferences', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint8' }] }
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
    { name: 'latestRoundData', type: 'function', stateMutability: 'view', inputs: [], outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' }
    ]}
  ] as const
};
