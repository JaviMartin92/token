import fs from 'fs';
import path from 'path';
import type { Address } from 'viem';

export interface FunctionSpec {
  name: string;
  stateMutability: string;
  inputs: Array<{ name: string; type: string }>;
  outputs?: Array<{ name: string; type: string }>;
}

export class ContractRegistry {
  private contracts: Record<string, Address>;
  private abis: Map<string, any[]> = new Map();

  private abiMapping: Record<string, string> = {
    USDC: 'ERC20.abi.json',
    USDT: 'ERC20.abi.json',
    WBTC: 'ERC20.abi.json',
    WETH: 'ERC20.abi.json',
    TREASURY: 'TreasuryManager.abi.json',
    TREASURY_MANAGER: 'TreasuryManager.abi.json',
    ALPHA_TOKEN: 'AlphaToken.abi.json',
    ALPHA_VAULT: 'AlphaVault.abi.json',
    STAKING: 'GovernanceStaking.abi.json',
    P2P_MARKET: 'P2PLendingMarket.abi.json',
    REAL_YIELD_ROUTER: 'RealYieldRouter.abi.json',
    DISCOUNT_BUYBACK_ENGINE: 'DiscountBuybackEngine.abi.json',
    TOKENOMICS_ENGINE: 'ProtocolTokenomicsEngine.abi.json',
    ORACLE_HUB: 'OracleHub.abi.json',
    ORACLE_ROUTER: 'DynamicYieldOracleRouter.abi.json',
    DYNAMIC_YIELD_ORACLE: 'DynamicYieldOracleRouter.abi.json',
    CIRCUIT_BREAKER: 'CircuitBreaker.abi.json',
    POSITION_NFT: 'VaultPositionNFT.abi.json',
    VESTED_VAULT: 'VestedDiscountVault.abi.json',
    FOUNDER_VESTING_VAULT: 'FounderReserveVestingVault.abi.json',
    POST_QUANTUM_GUARD: 'PostQuantumGuard.abi.json',
    COMMUNITY_YIELD_VAULT: 'CommunityYieldVault.abi.json',
    PROMO_VAULT: 'PromotionalIncentiveVault.abi.json',
    TIMELOCK: 'TimelockController.abi.json',
    GOVERNOR: 'GovernorAlphaCentauri.abi.json',
    ATOMIC_SWAP: 'AtomicSwapReceiver.abi.json',
    RESERVE_MANAGER: 'TreasuryReserveManager.abi.json',
    MORPHO_ADAPTER: 'MorphoYieldVaultAdapter.abi.json'
  };

  constructor() {
    const contractsPath = path.resolve(__dirname, '../../../../frontend/src/contracts.json');
    this.contracts = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));
    this.loadAllAbis();
  }

  private loadAllAbis() {
    for (const [contractKey, abiFileName] of Object.entries(this.abiMapping)) {
      const candidates = [
        path.resolve(__dirname, `../../../../contracts/out/${abiFileName}`),
        path.resolve(__dirname, `../../../../contracts/out/src/${abiFileName}`),
        path.resolve(__dirname, `../../../../contracts/out/adapters/${abiFileName}`)
      ];

      let loaded = false;
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          try {
            const abi = JSON.parse(fs.readFileSync(p, 'utf8'));
            this.abis.set(contractKey, abi);
            loaded = true;
            break;
          } catch {}
        }
      }

      if (!loaded) {
        // Fallback search recursively in contracts/out
        const outDir = path.resolve(__dirname, '../../../../contracts/out');
        const found = this.findFileRecursive(outDir, abiFileName);
        if (found) {
          try {
            const abi = JSON.parse(fs.readFileSync(found, 'utf8'));
            this.abis.set(contractKey, abi);
          } catch {}
        }
      }
    }
  }

  private findFileRecursive(dir: string, filename: string): string | null {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const res = this.findFileRecursive(fullPath, filename);
        if (res) return res;
      } else if (entry.name.toLowerCase() === filename.toLowerCase()) {
        return fullPath;
      }
    }
    return null;
  }

  getContractAddress(name: string): Address {
    const addr = this.contracts[name];
    if (!addr) throw new Error(`Contrato ${name} no encontrado en contracts.json`);
    return addr;
  }

  getContractAbi(name: string): any[] {
    const abi = this.abis.get(name);
    if (!abi) throw new Error(`ABI no encontrada para el contrato ${name}`);
    return abi;
  }

  getCallableFunctions(name: string): FunctionSpec[] {
    const abi = this.abis.get(name);
    if (!abi) return [];
    return abi
      .filter((item: any) => item.type === 'function')
      .map((f: any) => ({
        name: f.name,
        stateMutability: f.stateMutability,
        inputs: f.inputs.map((inp: any) => ({ name: inp.name || 'arg', type: inp.type })),
        outputs: f.outputs?.map((out: any) => ({ name: out.name || '', type: out.type }))
      }));
  }

  getProtocolManifest(filterContracts?: string[]): Record<string, any> {
    const manifest: Record<string, any> = {};
    const keys = filterContracts || Object.keys(this.abiMapping);

    for (const key of keys) {
      if (!this.contracts[key] || !this.abis.has(key)) continue;
      const funcs = this.getCallableFunctions(key);
      // Select write functions, limiting to top 6 most interesting per contract to preserve prompt context
      manifest[key] = {
        address: this.contracts[key],
        functions: funcs
          .filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure')
          .slice(0, 7)
          .map(f => `${f.name}(${f.inputs.map(i => `${i.type} ${i.name}`).join(', ')})`)
      };
    }
    return manifest;
  }
}
