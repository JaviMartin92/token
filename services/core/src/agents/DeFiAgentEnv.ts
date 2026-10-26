import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  PublicClient,
  WalletClient
} from 'viem';
import type { Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import { ContractRegistry } from './ContractRegistry';

// Standard Anvil Accounts
export const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // #0
export const ALICE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // #1 (Retail Staker)
export const BOB_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';   // #2 (Whale Borrower)
export const MALLORY_KEY = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6'; // #3 (Liquidator)
export const EVE_KEY = '0x47e179ec3464565e38874f239296a6e821e21e680fb301dd607147430d8cf4e0';     // #4 (Chaos Monkey)

export const ERC20_ABI = [
  { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }
] as const;

export interface InvariantResult {
  name: string;
  passed: boolean;
  metric: string;
  error?: string;
}

export class DeFiAgentEnv {
  public publicClient: PublicClient;
  public adminClient: WalletClient;
  public contracts: Record<string, Address>;
  public registry: ContractRegistry;

  constructor(rpcUrl: string = 'http://127.0.0.1:8545') {
    this.publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
    const adminAccount = privateKeyToAccount(ADMIN_KEY);
    this.adminClient = createWalletClient({ account: adminAccount, chain: foundry, transport: http(rpcUrl) });

    const contractsPath = path.resolve(__dirname, '../../../../frontend/src/contracts.json');
    this.contracts = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));
    this.registry = new ContractRegistry();
  }

  getWalletClient(privateKey: `0x${string}`): WalletClient {
    const account = privateKeyToAccount(privateKey);
    return createWalletClient({ account, chain: foundry, transport: http('http://127.0.0.1:8545') });
  }

  async setupInitialLiquidity(agentAddress: Address, initialUsdc: number = 20000, initialAlpha: number = 2000) {
    try {
      const treasuryAbi = this.registry.getContractAbi('TREASURY');
      // Whitelist KYC for agent in Treasury
      await this.adminClient.writeContract({
        address: this.contracts.TREASURY,
        abi: treasuryAbi,
        functionName: 'setKYCStatus',
        args: [agentAddress, true]
      });

      // Mint USDC
      const usdcAmt = parseUnits(initialUsdc.toString(), 6);
      await this.adminClient.writeContract({
        address: this.contracts.USDC,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [agentAddress, usdcAmt]
      });

      // Mint ALPHA and simultaneously back it with USDC in Treasury reserve to maintain NAV integrity
      const alphaAmt = parseUnits(initialAlpha.toString(), 18);
      const usdcBacking = parseUnits((initialAlpha * 1.05).toFixed(0), 6);
      await this.adminClient.writeContract({
        address: this.contracts.USDC,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [this.contracts.ALPHA_VAULT, usdcBacking]
      });
      await this.adminClient.writeContract({
        address: this.contracts.ALPHA_TOKEN,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [agentAddress, alphaAmt]
      });
    } catch (err: any) {
      console.warn(`[Env Setup Warning] ${err.message}`);
    }
  }

  async createSnapshot(): Promise<string> {
    return (await this.publicClient.request({ method: 'evm_snapshot' as any, params: [] })) as string;
  }

  async revertSnapshot(snapshotId: string): Promise<boolean> {
    return (await this.publicClient.request({ method: 'evm_revert' as any, params: [snapshotId] })) as boolean;
  }

  async getAgentState(agentAddress: Address) {
    const treasuryAbi = this.registry.getContractAbi('TREASURY');
    const stakingAbi = this.registry.getContractAbi('STAKING');
    const breakerAbi = this.registry.getContractAbi('CIRCUIT_BREAKER');
    const p2pAbi = this.registry.getContractAbi('P2P_MARKET');

    const [usdcBal, alphaBal, ethBal, stBal, earnedYield, navPerShare, circuitFrozen, blockNumber] = await Promise.all([
      this.publicClient.readContract({ address: this.contracts.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [agentAddress] }) as Promise<bigint>,
      this.publicClient.readContract({ address: this.contracts.ALPHA_TOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [agentAddress] }) as Promise<bigint>,
      this.publicClient.getBalance({ address: agentAddress }),
      this.publicClient.readContract({ address: this.contracts.STAKING, abi: stakingAbi, functionName: 'balanceOf', args: [agentAddress] }) as Promise<bigint>,
      this.publicClient.readContract({ address: this.contracts.STAKING, abi: stakingAbi, functionName: 'earned', args: [agentAddress] }) as Promise<bigint>,
      this.publicClient.readContract({ address: this.contracts.TREASURY, abi: treasuryAbi, functionName: 'getNAVPerShare' }) as Promise<bigint>,
      this.publicClient.readContract({ address: this.contracts.CIRCUIT_BREAKER, abi: breakerAbi, functionName: 'isFrozen', args: [this.contracts.USDC] }) as Promise<boolean>,
      this.publicClient.getBlockNumber()
    ]);

    let nextLoanId = 0n;
    try {
      nextLoanId = await this.publicClient.readContract({ address: this.contracts.P2P_MARKET, abi: p2pAbi, functionName: 'nextLoanId' }) as bigint;
    } catch {}

    return {
      agentAddress,
      blockNumber: Number(blockNumber),
      balances: {
        USDC: parseFloat(formatUnits(usdcBal, 6)),
        ALPHA: parseFloat(formatUnits(alphaBal, 18)),
        ETH: parseFloat(formatUnits(ethBal, 18)),
        stALPHA: parseFloat(formatUnits(stBal, 18)),
        earnedYieldUSDC: parseFloat(formatUnits(earnedYield, 6))
      },
      protocol: {
        navPerShareUSD: parseFloat(formatUnits(navPerShare, 18)),
        circuitBreakerFrozen: circuitFrozen,
        totalLoansCreated: Number(nextLoanId)
      }
    };
  }

  formatArgsForAbi(inputs: Array<{ name: string; type: string }>, rawArgs: any, funcName: string = ''): any[] {
    let argsArray: any[] = [];
    if (Array.isArray(rawArgs)) {
      argsArray = rawArgs;
    } else if (rawArgs && typeof rawArgs === 'object') {
      argsArray = Object.values(rawArgs);
    }

    const lowerFunc = funcName.toLowerCase();

    return inputs.map((inp, idx) => {
      const val = argsArray[idx];
      if (val === undefined || val === null) {
        if (inp.type.startsWith('uint') || inp.type.startsWith('int')) return 0n;
        if (inp.type === 'address') return this.contracts.USDC;
        if (inp.type === 'bool') return false;
        if (inp.type === 'bytes') return '0x';
        return val;
      }
      if (inp.type.startsWith('uint') || inp.type.startsWith('int')) {
        try {
          const num = Number(val.toString().split('.')[0].trim());
          if (!isNaN(num) && num > 0 && num < 1000000000) {
            // Apply token scale if function is token-denominated
            if (lowerFunc.includes('stake') || lowerFunc.includes('unstake') || lowerFunc.includes('redeem')) {
              return BigInt(num) * 10n ** 18n;
            }
            if (lowerFunc.includes('deposit') || lowerFunc.includes('borrow')) {
              return BigInt(num) * 10n ** 6n;
            }
          }
          return BigInt(val.toString().split('.')[0].trim());
        } catch {
          return 0n;
        }
      }
      if (inp.type === 'address') {
        if (typeof val === 'string') {
          const upper = val.toUpperCase().trim();
          if (this.contracts[upper]) return this.contracts[upper];
          if (/^0x[0-9a-fA-F]{40}$/.test(val.trim())) {
            return val.trim().toLowerCase() as Address;
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

  async executeArbitraryCall(
    client: WalletClient,
    contractKey: string,
    functionName: string,
    args: any = [],
    value: bigint = 0n
  ): Promise<{ success: boolean; txHash?: string; result?: any; error?: string }> {
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
        if (['deposit', 'stake', 'borrowFromTreasuryWithAsset', 'buyVestedBond'].includes(func.name)) {
          try {
            await client.writeContract({
              address: this.contracts.USDC,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [address, parseUnits('1000000', 6)]
            });
            await client.writeContract({
              address: this.contracts.ALPHA_TOKEN,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [address, parseUnits('1000000', 18)]
            });
          } catch {}
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
      } else {
        const readResult = await this.publicClient.readContract({
          address,
          abi,
          functionName: func.name,
          args: formattedArgs
        });
        return { success: true, result: readResult };
      }
    } catch (err: any) {
      return { success: false, error: err.shortMessage || err.message };
    }
  }

  async warpTime(seconds: number): Promise<void> {
    await this.publicClient.request({ method: 'evm_increaseTime' as any, params: [seconds] as any });
    await this.publicClient.request({ method: 'evm_mine' as any, params: [] as any });
  }

  async executeAction(client: WalletClient, action: string, params: Record<string, any>): Promise<{ success: boolean; txHash?: string; message: string }> {
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
          const res = await this.executeArbitraryCall(client, 'REAL_YIELD_ROUTER', 'claimYield', [0n]);
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
          const res = await this.executeArbitraryCall(client, 'TREASURY', 'redeem', [params.amount, 0n]);
          return { success: res.success, txHash: res.txHash, message: res.success ? `Redimidos ${params.amount} ALPHA -> USDC recibido` : (res.error || 'Revert') };
        }
        case 'borrow_from_treasury': {
          const res = await this.executeArbitraryCall(client, 'P2P_MARKET', 'borrowFromTreasuryWithAsset', [this.contracts.USDC, params.collateralAmount, params.borrowAmount, params.durationDays || 30]);
          return { success: res.success, txHash: res.txHash, message: res.success ? `Préstamo solicitado: ${params.borrowAmount} USDC` : (res.error || 'Revert') };
        }
        case 'warp_time_days': {
          const sec = Number(params.days || 15) * 86400;
          await this.warpTime(sec);
          return { success: true, message: `Tiempo adelantado ${params.days} días en la cadena Anvil` };
        }
        case 'probe_unauthorized_call': {
          const res = await this.executeArbitraryCall(client, 'TREASURY', 'emergencyRedeem', [parseUnits('99999999', 18), 0n]);
          return { success: res.success, txHash: res.txHash, message: res.success ? `Llamada no autorizada ejecutada (inesperado)` : `Protocol Guard: ${res.error}` };
        }
        default:
          return { success: false, message: `Acción desconocida: ${action}` };
      }
    } catch (err: any) {
      return { success: false, message: `Revert / Bloqueo: ${err.message}` };
    }
  }

  async checkInvariants(): Promise<InvariantResult[]> {
    const results: InvariantResult[] = [];
    const treasuryAbi = this.registry.getContractAbi('TREASURY');
    const stakingAbi = this.registry.getContractAbi('STAKING');
    const breakerAbi = this.registry.getContractAbi('CIRCUIT_BREAKER');

    // Invariant 1: Treasury Solvency & NAV Floor
    try {
      const navPerShare = await this.publicClient.readContract({
        address: this.contracts.TREASURY,
        abi: treasuryAbi,
        functionName: 'getNAVPerShare'
      }) as bigint;
      const navFormatted = parseFloat(formatUnits(navPerShare, 18));
      const passed = navFormatted >= 0.90;
      results.push({
        name: 'Solvencia y Suelo de NAV',
        passed,
        metric: `NAV actual: $${navFormatted.toFixed(4)} (Mínimo de solvencia: >= $0.90)`
      });
    } catch (e: any) {
      results.push({ name: 'Solvencia y Suelo de NAV', passed: false, metric: 'Error de consulta', error: e.message });
    }

    // Invariant 2: Staking Pool Backing Consistency
    try {
      const totalStaked = await this.publicClient.readContract({
        address: this.contracts.STAKING,
        abi: stakingAbi,
        functionName: 'totalStaked'
      }) as bigint;
      const stakingTokenBal = await this.publicClient.readContract({
        address: this.contracts.ALPHA_TOKEN,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [this.contracts.STAKING]
      }) as bigint;
      const passed = stakingTokenBal >= totalStaked;
      results.push({
        name: 'Respaldo del Pool de Staking (1:1 stALPHA)',
        passed,
        metric: `Staked en contrato: ${formatUnits(totalStaked, 18)} ALPHA | Custodia real: ${formatUnits(stakingTokenBal, 18)} ALPHA`
      });
    } catch (e: any) {
      results.push({ name: 'Respaldo de Staking', passed: false, metric: 'Error de consulta', error: e.message });
    }

    // Invariant 3: Circuit Breaker Integrity
    try {
      const isFrozen = await this.publicClient.readContract({
        address: this.contracts.CIRCUIT_BREAKER,
        abi: breakerAbi,
        functionName: 'isFrozen',
        args: [this.contracts.USDC]
      }) as boolean;
      results.push({
        name: 'Integridad de Circuit Breakers',
        passed: true,
        metric: isFrozen ? 'Breaker ACTIVADO (Modo Pánico)' : 'Breaker NORMAL (Operación fluida)'
      });
    } catch (e: any) {
      results.push({ name: 'Integridad de Circuit Breakers', passed: false, metric: 'Error de consulta', error: e.message });
    }

    // Invariant 4: Proof of Reserves Verification
    try {
      const por = await this.publicClient.readContract({
        address: this.contracts.TREASURY,
        abi: treasuryAbi,
        functionName: 'getProofOfReserves'
      }) as [bigint, bigint, bigint];
      const ratio = Number(por[2]) / 100;
      const passed = ratio >= 95.0;
      results.push({
        name: 'Proof of Reserves On-Chain',
        passed,
        metric: `Ratio de cobertura de colateral: ${ratio.toFixed(2)}% (Mínimo: 95.00%)`
      });
    } catch (e: any) {
      results.push({ name: 'Proof of Reserves On-Chain', passed: false, metric: 'Error de consulta', error: e.message });
    }

    return results;
  }
}
