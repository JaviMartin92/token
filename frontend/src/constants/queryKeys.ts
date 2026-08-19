/**
 * Centralized React Query Key Factory for Alpha Centauri Monorepo
 * Guarantees consistent cache keys, invalidation triggers, and zero collision.
 */

export const queryKeys = {
  all: ['alpha-centauri'] as const,

  portfolio: {
    all: () => [...queryKeys.all, 'portfolio'] as const,
    byUser: (address?: string) => [...queryKeys.portfolio.all(), address?.toLowerCase() || '0x0'] as const,
    balances: (address?: string) => [...queryKeys.portfolio.byUser(address), 'balances'] as const,
    positions: (address?: string) => [...queryKeys.portfolio.byUser(address), 'positions'] as const
  },

  treasury: {
    all: () => [...queryKeys.all, 'treasury'] as const,
    metrics: () => [...queryKeys.treasury.all(), 'metrics'] as const,
    por: () => [...queryKeys.treasury.all(), 'por'] as const,
    weights: () => [...queryKeys.treasury.all(), 'weights'] as const,
    navPerShare: () => [...queryKeys.treasury.all(), 'nav-per-share'] as const
  },

  staking: {
    all: () => [...queryKeys.all, 'staking'] as const,
    metrics: () => [...queryKeys.staking.all(), 'metrics'] as const,
    breakdown: () => [...queryKeys.staking.all(), 'breakdown'] as const,
    userStake: (address?: string) => [...queryKeys.staking.all(), 'user-stake', address?.toLowerCase() || '0x0'] as const,
    claimableYield: (address?: string) => [...queryKeys.staking.all(), 'claimable-yield', address?.toLowerCase() || '0x0'] as const
  },

  p2p: {
    all: () => [...queryKeys.all, 'p2p'] as const,
    loans: () => [...queryKeys.p2p.all(), 'loans'] as const,
    loanById: (id: string | number) => [...queryKeys.p2p.loans(), String(id)] as const,
    oraclePrices: () => [...queryKeys.p2p.all(), 'oracle-prices'] as const
  },

  vestedVault: {
    all: () => [...queryKeys.all, 'vested-vault'] as const,
    discountBps: (address?: string, years?: number | string) => [
      ...queryKeys.vestedVault.all(),
      'discount',
      address?.toLowerCase() || '0x0',
      String(years || 1)
    ] as const,
    userPositions: (address?: string) => [
      ...queryKeys.vestedVault.all(),
      'positions',
      address?.toLowerCase() || '0x0'
    ] as const
  },

  governance: {
    all: () => [...queryKeys.all, 'governance'] as const,
    proposals: () => [...queryKeys.governance.all(), 'proposals'] as const,
    votingPower: (address?: string) => [...queryKeys.governance.all(), 'voting-power', address?.toLowerCase() || '0x0'] as const
  }
} as const;
