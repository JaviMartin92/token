"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeFiAgentEnv = exports.ERC20_ABI = exports.EVE_KEY = exports.BOB_KEY = exports.ALICE_KEY = exports.ADMIN_KEY = void 0;
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ContractRegistry_1 = require("./ContractRegistry");
// Standard Anvil Accounts
exports.ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // #0
exports.ALICE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // #1 (Retail Staker)
exports.BOB_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'; // #2 (Whale Borrower)
const MALLORY_KEY = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6'; // #3 (Liquidator)
exports.EVE_KEY = '0x47e179ec3464565e38874f239296a6e821e21e680fb301dd607147430d8cf4e0'; // #4 (Chaos Monkey)
exports.ERC20_ABI = [
    { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
    { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }
];
class DeFiAgentEnv {
    publicClient;
    adminClient;
    contracts;
    registry;
    constructor(rpcUrl = 'http://127.0.0.1:8545') {
        this.publicClient = (0, viem_1.createPublicClient)({ chain: chains_1.foundry, transport: (0, viem_1.http)(rpcUrl) });
        const adminAccount = (0, accounts_1.privateKeyToAccount)(exports.ADMIN_KEY);
        this.adminClient = (0, viem_1.createWalletClient)({ account: adminAccount, chain: chains_1.foundry, transport: (0, viem_1.http)(rpcUrl) });
        const contractsPath = path_1.default.resolve(__dirname, '../../../../frontend/src/contracts.json');
        this.contracts = JSON.parse(fs_1.default.readFileSync(contractsPath, 'utf8'));
        this.registry = new ContractRegistry_1.ContractRegistry();
    }
    getWalletClient(privateKey) {
        const account = (0, accounts_1.privateKeyToAccount)(privateKey);
        return (0, viem_1.createWalletClient)({ account, chain: chains_1.foundry, transport: (0, viem_1.http)('http://127.0.0.1:8545') });
    }
    async setupInitialLiquidity(agentAddress, initialUsdc = 20000, initialAlpha = 2000) {
        try {
            // Ensure agent has native ETH for gas
            const ethBal = await this.publicClient.getBalance({ address: agentAddress });
            if (ethBal < (0, viem_1.parseEther)('1')) {
                await this.adminClient.sendTransaction({
                    to: agentAddress,
                    value: (0, viem_1.parseEther)('10')
                });
            }
            const treasuryAbi = this.registry.getContractAbi('TREASURY');
            // Whitelist KYC for agent in Treasury
            await this.adminClient.writeContract({
                address: this.contracts.TREASURY,
                abi: treasuryAbi,
                functionName: 'setKYCStatus',
                args: [agentAddress, true]
            });
            // Mint USDC
            const usdcAmt = (0, viem_1.parseUnits)(initialUsdc.toString(), 6);
            await this.adminClient.writeContract({
                address: this.contracts.USDC,
                abi: exports.ERC20_ABI,
                functionName: 'mint',
                args: [agentAddress, usdcAmt]
            });
            // Mint ALPHA and simultaneously back it with USDC in Treasury reserve to maintain NAV integrity
            const alphaAmt = (0, viem_1.parseUnits)(initialAlpha.toString(), 18);
            const usdcBacking = (0, viem_1.parseUnits)((initialAlpha * 1.05).toFixed(0), 6);
            await this.adminClient.writeContract({
                address: this.contracts.USDC,
                abi: exports.ERC20_ABI,
                functionName: 'mint',
                args: [this.contracts.ALPHA_VAULT, usdcBacking]
            });
            await this.adminClient.writeContract({
                address: this.contracts.ALPHA_TOKEN,
                abi: exports.ERC20_ABI,
                functionName: 'mint',
                args: [agentAddress, alphaAmt]
            });
        }
        catch (err) {
            console.warn(`[Env Setup Warning] ${err.message}`);
        }
    }
    async createSnapshot() {
        return (await this.publicClient.request({ method: 'evm_snapshot', params: [] }));
    }
    async revertSnapshot(snapshotId) {
        return (await this.publicClient.request({ method: 'evm_revert', params: [snapshotId] }));
    }
    async getAgentState(agentAddress) {
        const treasuryAbi = this.registry.getContractAbi('TREASURY');
        const stakingAbi = this.registry.getContractAbi('STAKING');
        const breakerAbi = this.registry.getContractAbi('CIRCUIT_BREAKER');
        const p2pAbi = this.registry.getContractAbi('P2P_MARKET');
        const [usdcBal, alphaBal, ethBal, stBal, earnedYield, navPerShare, circuitFrozen, blockNumber] = await Promise.all([
            this.publicClient.readContract({ address: this.contracts.USDC, abi: exports.ERC20_ABI, functionName: 'balanceOf', args: [agentAddress] }),
            this.publicClient.readContract({ address: this.contracts.ALPHA_TOKEN, abi: exports.ERC20_ABI, functionName: 'balanceOf', args: [agentAddress] }),
            this.publicClient.getBalance({ address: agentAddress }),
            this.publicClient.readContract({ address: this.contracts.STAKING, abi: stakingAbi, functionName: 'balanceOf', args: [agentAddress] }),
            this.publicClient.readContract({ address: this.contracts.STAKING, abi: stakingAbi, functionName: 'earned', args: [agentAddress] }),
            this.publicClient.readContract({ address: this.contracts.TREASURY, abi: treasuryAbi, functionName: 'getNAVPerShare' }),
            this.publicClient.readContract({ address: this.contracts.CIRCUIT_BREAKER, abi: breakerAbi, functionName: 'isFrozen', args: [this.contracts.USDC] }),
            this.publicClient.getBlockNumber()
        ]);
        let nextLoanId = 0n;
        try {
            nextLoanId = await this.publicClient.readContract({ address: this.contracts.P2P_MARKET, abi: p2pAbi, functionName: 'nextLoanId' });
        }
        catch { }
        let nftBonds = 0n;
        try {
            nftBonds = await this.publicClient.readContract({
                address: this.contracts.POSITION_NFT,
                abi: exports.ERC20_ABI,
                functionName: 'balanceOf',
                args: [agentAddress]
            });
        }
        catch { }
        return {
            agentAddress,
            blockNumber: Number(blockNumber),
            balances: {
                USDC: parseFloat((0, viem_1.formatUnits)(usdcBal, 6)),
                ALPHA: parseFloat((0, viem_1.formatUnits)(alphaBal, 18)),
                ETH: parseFloat((0, viem_1.formatUnits)(ethBal, 18)),
                stALPHA: parseFloat((0, viem_1.formatUnits)(stBal, 18)),
                earnedYieldUSDC: parseFloat((0, viem_1.formatUnits)(earnedYield, 6)),
                positionBondsCount: Number(nftBonds)
            },
            protocol: {
                navPerShareUSD: parseFloat((0, viem_1.formatUnits)(navPerShare, 18)),
                circuitBreakerFrozen: circuitFrozen,
                totalLoansCreated: Number(nextLoanId)
            }
        };
    }
    formatArgsForAbi(inputs, rawArgs, funcName = '') {
        let argsArray = [];
        if (Array.isArray(rawArgs)) {
            argsArray = rawArgs;
        }
        else if (rawArgs && typeof rawArgs === 'object') {
            argsArray = Object.values(rawArgs);
        }
        const lowerFunc = funcName.toLowerCase();
        return inputs.map((inp, idx) => {
            const val = argsArray[idx];
            if (val === undefined || val === null) {
                if (inp.type.startsWith('uint') || inp.type.startsWith('int'))
                    return 0n;
                if (inp.type === 'address')
                    return this.contracts.USDC;
                if (inp.type === 'bool')
                    return false;
                if (inp.type.startsWith('bytes32'))
                    return '0x0000000000000000000000000000000000000000000000000000000000000000';
                if (inp.type.startsWith('bytes'))
                    return '0x';
                return val;
            }
            if (inp.type.startsWith('bytes32')) {
                if (typeof val === 'string' && val.startsWith('0x') && val.length === 66) {
                    return val;
                }
                return '0x0000000000000000000000000000000000000000000000000000000000000000';
            }
            if (inp.type === 'bytes') {
                if (typeof val === 'string' && val.startsWith('0x')) {
                    return val;
                }
                return '0x';
            }
            if (inp.type.startsWith('uint') || inp.type.startsWith('int')) {
                try {
                    const num = Number(val.toString().split('.')[0].trim());
                    const inpName = inp.name.toLowerCase();
                    const isCountOrDuration = inpName.includes('year') ||
                        inpName.includes('day') ||
                        inpName.includes('id') ||
                        inpName.includes('tokenid') ||
                        inpName.includes('loanid') ||
                        inpName.includes('time') ||
                        inpName.includes('deadline') ||
                        inpName.includes('tier') ||
                        inpName.includes('preference') ||
                        inpName.includes('bps') ||
                        inpName.includes('fee');
                    if (!isCountOrDuration && !isNaN(num) && num > 0 && num < 1000000000) {
                        // Apply token scale if function is token-denominated
                        if (lowerFunc.includes('stake') || lowerFunc.includes('unstake') || lowerFunc.includes('redeem') || inpName.includes('alpha')) {
                            return BigInt(num) * 10n ** 18n;
                        }
                        if (lowerFunc.includes('deposit') || lowerFunc.includes('borrow') || lowerFunc.includes('buyback') || lowerFunc.includes('bond') || inpName.includes('usdc') || inpName.includes('stable')) {
                            return BigInt(num) * 10n ** 6n;
                        }
                    }
                    return BigInt(val.toString().split('.')[0].trim());
                }
                catch {
                    return 0n;
                }
            }
            if (inp.type === 'address') {
                if (typeof val === 'string') {
                    const upper = val.toUpperCase().trim();
                    if (this.contracts[upper])
                        return this.contracts[upper];
                    if (/^0x[0-9a-fA-F]{40}$/.test(val.trim())) {
                        return val.trim().toLowerCase();
                    }
                }
                return this.contracts.USDC;
            }
            if (inp.type === 'bool') {
                return val === true || val === 'true' || val === 1 || val === '1';
            }
            return val;
        });
    }
    async executeArbitraryCall(client, contractKey, functionName, args = [], value = 0n) {
        try {
            const upperKey = contractKey.toUpperCase();
            const address = this.registry.getContractAddress(upperKey);
            const abi = this.registry.getContractAbi(upperKey);
            const func = this.registry.getCallableFunctions(upperKey).find(f => f.name.toLowerCase() === functionName.toLowerCase());
            if (!func) {
                return { success: false, error: `Función "${functionName}" no encontrada en el contrato "${contractKey}"` };
            }
            const formattedArgs = this.formatArgsForAbi(func.inputs, args, func.name);
            // Pre-approval check for standard tokens if calling a spend/deposit function
            if (func.stateMutability !== 'view' && func.stateMutability !== 'pure') {
                if (['deposit', 'stake', 'borrowFromTreasuryWithAsset', 'borrowFromTreasuryWithAlpha', 'buyVestedBond', 'executeDiscountBuyback', 'repayLoan', 'createLoanOfferWithCollateral'].includes(func.name)) {
                    try {
                        await client.writeContract({
                            address: this.contracts.USDC,
                            abi: exports.ERC20_ABI,
                            functionName: 'approve',
                            args: [address, (0, viem_1.parseUnits)('1000000', 6)]
                        });
                        await client.writeContract({
                            address: this.contracts.ALPHA_TOKEN,
                            abi: exports.ERC20_ABI,
                            functionName: 'approve',
                            args: [address, (0, viem_1.parseUnits)('1000000', 18)]
                        });
                    }
                    catch { }
                }
                const tx = await client.writeContract({
                    address,
                    abi,
                    functionName: func.name,
                    args: formattedArgs,
                    value
                });
                const receipt = await this.publicClient.waitForTransactionReceipt({ hash: tx });
                return { success: receipt.status === 'success', txHash: tx, result: receipt.status };
            }
            else {
                const readResult = await this.publicClient.readContract({
                    address,
                    abi,
                    functionName: func.name,
                    args: formattedArgs
                });
                return { success: true, result: readResult };
            }
        }
        catch (err) {
            return { success: false, error: err.shortMessage || err.message };
        }
    }
    async warpTime(seconds) {
        await this.publicClient.request({ method: 'evm_increaseTime', params: [seconds] });
        await this.publicClient.request({ method: 'evm_mine', params: [] });
    }
    async executeAction(client, action, params) {
        try {
            switch (action) {
                case 'stake_alpha': {
                    const res = await this.executeArbitraryCall(client, 'STAKING', 'stake', [params.amount]);
                    return { success: res.success, txHash: res.txHash, message: res.success ? `Staked ${params.amount} ALPHA -> stALPHA emitido` : (res.error || 'Revert') };
                }
                case 'unstake_alpha': {
                    const res = await this.executeArbitraryCall(client, 'STAKING', 'unstake', [params.amount]);
                    return { success: res.success, txHash: res.txHash, message: res.success ? `Unstaked ${params.amount} stALPHA -> ALPHA devuelto` : (res.error || 'Revert') };
                }
                case 'claim_rewards': {
                    const res = await this.executeArbitraryCall(client, 'REAL_YIELD_ROUTER', 'claimRealYield', []);
                    return { success: res.success, txHash: res.txHash, message: res.success ? `Recompensas reclamadas con éxito` : (res.error || 'Revert') };
                }
                case 'set_payout_preference': {
                    const pref = params.preference === 'ALPHA' ? 1 : 0;
                    const res = await this.executeArbitraryCall(client, 'REAL_YIELD_ROUTER', 'setPayoutPreference', [pref]);
                    return { success: res.success, txHash: res.txHash, message: res.success ? `Preferencia configurada a ${params.preference}` : (res.error || 'Revert') };
                }
                case 'deposit_treasury_usdc': {
                    const res = await this.executeArbitraryCall(client, 'TREASURY', 'deposit', [params.amount, 0n]);
                    return { success: res.success, txHash: res.txHash, message: res.success ? `Depositados ${params.amount} USDC en Tesorería -> ALPHA emitido` : (res.error || 'Revert') };
                }
                case 'redeem_alpha_usdc': {
                    const res = await this.executeArbitraryCall(client, 'TREASURY', 'emergencyRedeem', [params.amount, 0n]);
                    return { success: res.success, txHash: res.txHash, message: res.success ? `Redimidos ${params.amount} ALPHA -> USDC recibido` : (res.error || 'Revert') };
                }
                case 'buy_vested_bond': {
                    const res = await this.executeArbitraryCall(client, 'VESTED_VAULT', 'buyVestedBond', [params.principalAmount || params.amount, params.lockYears || 1, '0x0000000000000000000000000000000000000000']);
                    return { success: res.success, txHash: res.txHash, message: res.success ? `Bono descontado adquirido por ${params.principalAmount || params.amount} USDC (${params.lockYears || 1} años)` : (res.error || 'Revert') };
                }
                case 'claim_matured_bond': {
                    const res = await this.executeArbitraryCall(client, 'VESTED_VAULT', 'claimMatured', [params.tokenId || 1]);
                    return { success: res.success, txHash: res.txHash, message: res.success ? `Bono maduro #${params.tokenId || 1} reclamado con éxito` : (res.error || 'Revert') };
                }
                case 'borrow_from_treasury': {
                    const res = await this.executeArbitraryCall(client, 'P2P_MARKET', 'borrowFromTreasuryWithAlpha', [params.collateralAmount || 1000, params.borrowAmount || 400, params.durationDays || 30]);
                    return { success: res.success, txHash: res.txHash, message: res.success ? `Préstamo solicitado: ${params.borrowAmount || 400} USDC contra ${params.collateralAmount || 1000} ALPHA` : (res.error || 'Revert') };
                }
                case 'repay_loan': {
                    const res = await this.executeArbitraryCall(client, 'P2P_MARKET', 'repayLoan', [params.loanId || 1]);
                    return { success: res.success, txHash: res.txHash, message: res.success ? `Préstamo #${params.loanId || 1} repagado con éxito` : (res.error || 'Revert') };
                }
                case 'execute_discount_buyback': {
                    const res = await this.executeArbitraryCall(client, 'DISCOUNT_BUYBACK_ENGINE', 'executeDiscountBuyback', [params.usdcToSpend || params.amount, 0n]);
                    return { success: res.success, txHash: res.txHash, message: res.success ? `Buyback ejecutado con ${params.usdcToSpend || params.amount} USDC` : (res.error || 'Revert') };
                }
                case 'delegate_votes': {
                    const res = await this.executeArbitraryCall(client, 'STAKING', 'delegate', [params.delegatee || client.account.address]);
                    return { success: res.success, txHash: res.txHash, message: res.success ? `Votos delegados a ${params.delegatee || client.account.address}` : (res.error || 'Revert') };
                }
                case 'warp_time_days': {
                    const sec = Number(params.days || 15) * 86400;
                    await this.warpTime(sec);
                    return { success: true, message: `Tiempo adelantado ${params.days} días en la cadena Anvil` };
                }
                case 'probe_unauthorized_call': {
                    const res = await this.executeArbitraryCall(client, 'TREASURY', 'emergencyRedeem', [(0, viem_1.parseUnits)('99999999', 18), 0n]);
                    return { success: res.success, txHash: res.txHash, message: res.success ? `Llamada no autorizada ejecutada (inesperado)` : `Protocol Guard: ${res.error}` };
                }
                default:
                    return { success: false, message: `Acción desconocida: ${action}` };
            }
        }
        catch (err) {
            return { success: false, message: `Revert / Bloqueo: ${err.message}` };
        }
    }
    async checkInvariants() {
        const results = [];
        const treasuryAbi = this.registry.getContractAbi('TREASURY');
        const stakingAbi = this.registry.getContractAbi('STAKING');
        const breakerAbi = this.registry.getContractAbi('CIRCUIT_BREAKER');
        // Invariant 1: Treasury Solvency & NAV Floor
        try {
            const navPerShare = await this.publicClient.readContract({
                address: this.contracts.TREASURY,
                abi: treasuryAbi,
                functionName: 'getNAVPerShare'
            });
            const navFormatted = parseFloat((0, viem_1.formatUnits)(navPerShare, 18));
            const passed = navFormatted >= 0.90;
            results.push({
                name: 'Solvencia y Suelo de NAV',
                passed,
                metric: `NAV actual: $${navFormatted.toFixed(4)} (Mínimo de solvencia: >= $0.90)`
            });
        }
        catch (e) {
            results.push({ name: 'Solvencia y Suelo de NAV', passed: false, metric: 'Error de consulta', error: e.message });
        }
        // Invariant 2: Staking Pool Backing Consistency
        try {
            const totalStaked = await this.publicClient.readContract({
                address: this.contracts.STAKING,
                abi: stakingAbi,
                functionName: 'totalStaked'
            });
            const stakingTokenBal = await this.publicClient.readContract({
                address: this.contracts.ALPHA_TOKEN,
                abi: exports.ERC20_ABI,
                functionName: 'balanceOf',
                args: [this.contracts.STAKING]
            });
            const passed = stakingTokenBal >= totalStaked;
            results.push({
                name: 'Respaldo del Pool de Staking (1:1 stALPHA)',
                passed,
                metric: `Staked en contrato: ${(0, viem_1.formatUnits)(totalStaked, 18)} ALPHA | Custodia real: ${(0, viem_1.formatUnits)(stakingTokenBal, 18)} ALPHA`
            });
        }
        catch (e) {
            results.push({ name: 'Respaldo de Staking', passed: false, metric: 'Error de consulta', error: e.message });
        }
        // Invariant 3: Circuit Breaker Integrity
        try {
            const isFrozen = await this.publicClient.readContract({
                address: this.contracts.CIRCUIT_BREAKER,
                abi: breakerAbi,
                functionName: 'isFrozen',
                args: [this.contracts.USDC]
            });
            results.push({
                name: 'Integridad de Circuit Breakers',
                passed: true,
                metric: isFrozen ? 'Breaker ACTIVADO (Modo Pánico)' : 'Breaker NORMAL (Operación fluida)'
            });
        }
        catch (e) {
            results.push({ name: 'Integridad de Circuit Breakers', passed: false, metric: 'Error de consulta', error: e.message });
        }
        // Invariant 4: Proof of Reserves Verification
        try {
            const por = await this.publicClient.readContract({
                address: this.contracts.TREASURY,
                abi: treasuryAbi,
                functionName: 'getProofOfReserves'
            });
            const ratio = Number(por[2]) / 100;
            const passed = ratio >= 95.0;
            results.push({
                name: 'Proof of Reserves On-Chain',
                passed,
                metric: `Ratio de cobertura de colateral: ${ratio.toFixed(2)}% (Mínimo: 95.00%)`
            });
        }
        catch (e) {
            results.push({ name: 'Proof of Reserves On-Chain', passed: false, metric: 'Error de consulta', error: e.message });
        }
        return results;
    }
}
exports.DeFiAgentEnv = DeFiAgentEnv;
//# sourceMappingURL=DeFiAgentEnv.js.map