"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractRegistry = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class ContractRegistry {
    contracts;
    abis = new Map();
    abiMapping = {
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
        const contractsPath = path_1.default.resolve(__dirname, '../../../../frontend/src/contracts.json');
        this.contracts = JSON.parse(fs_1.default.readFileSync(contractsPath, 'utf8'));
        this.loadAllAbis();
    }
    loadAllAbis() {
        for (const [contractKey, abiFileName] of Object.entries(this.abiMapping)) {
            const candidates = [
                path_1.default.resolve(__dirname, `../../../../contracts/out/${abiFileName}`),
                path_1.default.resolve(__dirname, `../../../../contracts/out/src/${abiFileName}`),
                path_1.default.resolve(__dirname, `../../../../contracts/out/adapters/${abiFileName}`)
            ];
            let loaded = false;
            for (const p of candidates) {
                if (fs_1.default.existsSync(p)) {
                    try {
                        const abi = JSON.parse(fs_1.default.readFileSync(p, 'utf8'));
                        this.abis.set(contractKey, abi);
                        loaded = true;
                        break;
                    }
                    catch { }
                }
            }
            if (!loaded) {
                // Fallback search recursively in contracts/out
                const outDir = path_1.default.resolve(__dirname, '../../../../contracts/out');
                const found = this.findFileRecursive(outDir, abiFileName);
                if (found) {
                    try {
                        const abi = JSON.parse(fs_1.default.readFileSync(found, 'utf8'));
                        this.abis.set(contractKey, abi);
                    }
                    catch { }
                }
            }
        }
    }
    findFileRecursive(dir, filename) {
        if (!fs_1.default.existsSync(dir))
            return null;
        const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path_1.default.join(dir, entry.name);
            if (entry.isDirectory()) {
                const res = this.findFileRecursive(fullPath, filename);
                if (res)
                    return res;
            }
            else if (entry.name.toLowerCase() === filename.toLowerCase()) {
                return fullPath;
            }
        }
        return null;
    }
    getContractAddress(name) {
        const addr = this.contracts[name];
        if (!addr)
            throw new Error(`Contrato ${name} no encontrado en contracts.json`);
        return addr;
    }
    getContractAbi(name) {
        const abi = this.abis.get(name);
        if (!abi)
            throw new Error(`ABI no encontrada para el contrato ${name}`);
        return abi;
    }
    getCallableFunctions(name) {
        const abi = this.abis.get(name);
        if (!abi)
            return [];
        return abi
            .filter((item) => item.type === 'function')
            .map((f) => ({
            name: f.name,
            stateMutability: f.stateMutability,
            inputs: f.inputs.map((inp) => ({ name: inp.name || 'arg', type: inp.type })),
            outputs: f.outputs?.map((out) => ({ name: out.name || '', type: out.type }))
        }));
    }
    getAllWriteFunctionNames(contractName) {
        const funcs = this.getCallableFunctions(contractName);
        return funcs
            .filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure')
            .map(f => f.name);
    }
    getProtocolManifest(filterContracts) {
        const manifest = {};
        const keys = filterContracts || Object.keys(this.abiMapping);
        const isBoilerplate = (name) => ['grantRole', 'revokeRole', 'renounceRole', 'supportsInterface', 'UPGRADE_INTERFACE_VERSION'].includes(name);
        for (const key of keys) {
            if (!this.contracts[key] || !this.abis.has(key))
                continue;
            const funcs = this.getCallableFunctions(key);
            const writeFuncs = funcs.filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure');
            // Sort domain-specific business logic first, boilerplate access-control functions last
            const prioritized = [...writeFuncs].sort((a, b) => {
                const aB = isBoilerplate(a.name) ? 1 : 0;
                const bB = isBoilerplate(b.name) ? 1 : 0;
                return aB - bB;
            });
            manifest[key] = {
                address: this.contracts[key],
                functions: prioritized
                    .slice(0, 10)
                    .map(f => `${f.name}(${f.inputs.map(i => `${i.type} ${i.name}`).join(', ')})`)
            };
        }
        return manifest;
    }
}
exports.ContractRegistry = ContractRegistry;
//# sourceMappingURL=ContractRegistry.js.map