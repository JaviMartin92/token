import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GovernanceCommandCenter } from '../GovernanceCommandCenter.js';
import { UI_STRINGS } from '../../constants/strings.js';

// Mock viem and web3 calls to avoid external network issues in unit tests
vi.mock('../../utils/web3.js', () => ({
  CONTRACT_ADDRESSES: {
    GOVERNOR: '0x8fc8cfb7f7362e44e472c690a6e025b80e406458',
    TIMELOCK: '0x51c65cd0cdb1a8a8b79dfc2ee965b1ba0bb8fc89',
    TREASURY: '0xd49a0e9a4cd5979ae36840f542d2d7f02c4817be',
    COMMUNITY_YIELD_VAULT: '0x1780bcf4103d3f501463ad3414c7f4b654bb7afd',
    POST_QUANTUM_GUARD: '0x8bee2037448f096900fd9affc427d38ae6cc0350',
    CIRCUIT_BREAKER: '0xa6e99a4ed7498b3cddcbb61a6a607a4925faa1b7',
    USDC: '0xb0f05d25e41fbc2b52013099ed9616f1206ae21b'
  },
  publicClient: {
    readContract: vi.fn().mockImplementation(async ({ functionName }) => {
      if (functionName === 'proposalCount') return 0n;
      if (functionName === 'proposalThreshold') return 25000000000000000000000n;
      if (functionName === 'quorumVotes') return 80000000000000000000000n;
      return 0n;
    }),
    waitForTransactionReceipt: vi.fn()
  },
  getWalletClient: vi.fn().mockReturnValue({
    writeContract: vi.fn().mockResolvedValue('0xmocktx')
  }),
  ABIS: {
    GOVERNOR: []
  }
}));

describe('GovernanceCommandCenter - Pure DeFi Mainnet Module', () => {
  const baseWeb3Data = {
    chainId: 1,
    userAddress: '0x1111111111111111111111111111111111111111',
    stakedBalance: '50,000.00',
    navPerShareNum: 1.25,
    proofOfReserves: {
      totalAssetsUSD: '2500000.00',
      totalLiabilitiesUSD: '2000000.00'
    },
    totalBurnedTokens: '15,400.00',
    targetWeights: {
      stables: 50.0,
      wbtc: 25.0,
      weth: 12.5,
      alts: 12.5
    }
  };

  it('renders Pure DeFi Governance module with anti-spam eligibility when staked >= 25,000', () => {
    render(<GovernanceCommandCenter web3Data={baseWeb3Data} />);

    // Header & Title
    expect(screen.getByText(/Operaciones de Protocolo & Gobernanza DAO/i)).toBeDefined();
    // Anti-Spam Badge
    expect(screen.getByText(UI_STRINGS.GOVERNANCE.ELIGIBLE_BADGE)).toBeDefined();
    // Threshold & Quorum information
    expect(screen.getAllByText(/25,000 stALPHA/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/80,000 stALPHA/i).length).toBeGreaterThan(0);
  });

  it('displays anti-spam ineligible warning when user staked balance < 25,000', () => {
    const lowStakeWeb3Data = {
      ...baseWeb3Data,
      stakedBalance: '500.00'
    };

    render(<GovernanceCommandCenter web3Data={lowStakeWeb3Data} />);

    expect(screen.getByText(UI_STRINGS.GOVERNANCE.INELIGIBLE_BADGE)).toBeDefined();
  });

  it('allows switching to Guided Proposal Creator and displays template options', () => {
    render(<GovernanceCommandCenter web3Data={baseWeb3Data} />);

    const createTabBtn = screen.getByTestId('admin-subtab-create');
    fireEvent.click(createTabBtn);

    expect(screen.getByText(UI_STRINGS.GOVERNANCE.CARD_PROPOSE_TITLE)).toBeDefined();
    expect(screen.getByText(UI_STRINGS.GOVERNANCE.TEMPLATE_WEIGHTS)).toBeDefined();
    expect(screen.getByText(UI_STRINGS.GOVERNANCE.TEMPLATE_FEES)).toBeDefined();
    expect(screen.getByText(UI_STRINGS.GOVERNANCE.TEMPLATE_CIRCUIT_BREAKER)).toBeDefined();
    expect(screen.getByText(UI_STRINGS.GOVERNANCE.TEMPLATE_BUYBACK)).toBeDefined();
    expect(screen.getByText(UI_STRINGS.GOVERNANCE.TEMPLATE_GRANT)).toBeDefined();
    expect(screen.getByText(UI_STRINGS.GOVERNANCE.TEMPLATE_CUSTOM)).toBeDefined();
  });

  it('allows navigating to Metrics, Vaults, and Security tabs', () => {
    render(<GovernanceCommandCenter web3Data={baseWeb3Data} />);

    // Metrics tab
    fireEvent.click(screen.getByTestId('admin-subtab-metrics'));
    expect(screen.getByText(/Distribución Target de Activos de Reserva/i)).toBeDefined();

    // Vaults tab
    fireEvent.click(screen.getByTestId('admin-subtab-wallets'));
    expect(screen.getByText(UI_STRINGS.GOVERNANCE.SECTION_VAULT_ADDRESSES)).toBeDefined();

    // Security tab
    fireEvent.click(screen.getByTestId('admin-subtab-security'));
    expect(screen.getByText(/Blindaje Criptográfico Post-Cuántico/i)).toBeDefined();
  });
});
