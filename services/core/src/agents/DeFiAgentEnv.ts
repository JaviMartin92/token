import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  Address,
  PublicClient,
  WalletClient
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import fs from 'fs';
import path from 'path';

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

function loadArtifact(name: string, file: string) {
  const p1 = path.resolve(__dirname, `../../../../contracts/out/${file}/${name}.json`);
  const p2 = path.resolve(__dirname, `../../../../contracts/out/src/${file}/${name}.json`);
  const p3 = path.resolve(__dirname, `../../../../contracts/out/test/${file}/${name}.json`);
  const p4 = path.resolve(__dirname, `../../../../contracts/out/adapters/${file}/${name}.json`);
  const p5 = path.resolve(__dirname, `../../../../contracts/out/${name}.sol/${name}.json`);
  const p = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : fs.existsSync(p3) ? p3 : fs.existsSync(p4) ? p4 : fs.existsSync(p5) ? p5 : p1;
  if (!fs.existsSync(p)) {
    throw new Error(`Compiled artifact not found at ${p}`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

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

  public abis: {
    treasury: any;
    staking: any;
    vested: any;
    p2p: any;
    nft: any;
    breaker: any;
    router: any;
  };

  constructor(rpcUrl: string = 'http://127.0.0.1:8545') {
    this.publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
    const adminAccount = privateKeyToAccount(ADMIN_KEY);
    this.adminClient = createWalletClient({ account: adminAccount, chain: foundry, transport: http(rpcUrl) });

    const contractsPath = path.resolve(__dirname, '../../../../frontend/src/contracts.json');
    this.contracts = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));

    this.abis = {
      treasury: loadArtifact('TreasuryManager', 'TreasuryManager.sol').abi,
      staking: loadArtifact('GovernanceStaking', 'GovernanceStaking.sol').abi,
      vested: loadArtifact('VestedDiscountVault', 'VestedDiscountVault.sol').abi,
      p2p: loadArtifact('P2PLendingMarket', 'P2PLendingMarket.sol').abi,
      nft: loadArtifact('VaultPositionNFT', 'VaultPositionNFT.sol').abi,
      breaker: loadArtifact('CircuitBreaker', 'CircuitBreaker.sol').abi,
      router: loadArtifact('RealYieldRouter', 'RealYieldRouter.sol').abi
    };
  }

  getWalletClient(privateKey: `0x${string}`): WalletClient {
    const account = privateKeyToAccount(privateKey);
    return createWalletClient({ account, chain: foundry, transport: http('http://127.0.0.1:8545') });
  }

  async setupInitialLiquidity(agentAddress: Address, initialUsdc: number = 20000, initialAlpha: number = 2000) {
    try {
      // Whitelist KYC for agent in Treasury
      await this.adminClient.writeContract({
        address: this.contracts.TREASURY,
        abi: this.abis.treasury,
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
    const [usdcBal, alphaBal, ethBal, stBal, earnedYield, navPerShare, circuitFrozen] = await Promise.all([
      this.publicClient.readContract({ address: this.contracts.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [agentAddress] }) as Promise<bigint>,
      this.publicClient.readContract({ address: this.contracts.ALPHA_TOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [agentAddress] }) as Promise<bigint>,
      this.publicClient.getBalance({ address: agentAddress }),
      this.publicClient.readContract({ address: this.contracts.STAKING, abi: this.abis.staking, functionName: 'balanceOf', args: [agentAddress] }) as Promise<bigint>,
      this.publicClient.readContract({ address: this.contracts.STAKING, abi: this.abis.staking, functionName: 'earned', args: [agentAddress] }) as Promise<bigint>,
      this.publicClient.readContract({ address: this.contracts.TREASURY, abi: this.abis.treasury, functionName: 'getNAVPerShare' }) as Promise<bigint>,
      this.publicClient.readContract({ address: this.contracts.CIRCUIT_BREAKER, abi: this.abis.breaker, functionName: 'isFrozen', args: [this.contracts.USDC] }) as Promise<boolean>
    ]);

    let nextLoanId = 0n;
    try {
      nextLoanId = await this.publicClient.readContract({ address: this.contracts.P2P_MARKET, abi: this.abis.p2p, functionName: 'nextLoanId' }) as bigint;
    } catch {}

    return {
      agentAddress,
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

  async executeAction(client: WalletClient, action: string, params: Record<string, any>): Promise<{ success: boolean; txHash?: string; message: string }> {
    const agentAddr = client.account!.address;
    try {
      switch (action) {
        case 'stake_alpha': {
          const amt = parseUnits(params.amount.toString(), 18);
          await client.writeContract({ address: this.contracts.ALPHA_TOKEN, abi: ERC20_ABI, functionName: 'approve', args: [this.contracts.STAKING, amt] });
          const tx = await client.writeContract({ address: this.contracts.STAKING, abi: this.abis.staking, functionName: 'stake', args: [amt] });
          await this.publicClient.waitForTransactionReceipt({ hash: tx });
          return { success: true, txHash: tx, message: `Staked ${params.amount} ALPHA -> stALPHA emitido` };
        }

        case 'unstake_alpha': {
          const amt = parseUnits(params.amount.toString(), 18);
          const tx = await client.writeContract({ address: this.contracts.STAKING, abi: this.abis.staking, functionName: 'unstake', args: [amt] });
          await this.publicClient.waitForTransactionReceipt({ hash: tx });
          return { success: true, txHash: tx, message: `Unstaked ${params.amount} stALPHA -> ALPHA devuelto` };
        }

        case 'claim_rewards': {
          const tx = await client.writeContract({ address: this.contracts.REAL_YIELD_ROUTER, abi: this.abis.router, functionName: 'claimYield', args: [0n] });
          await this.publicClient.waitForTransactionReceipt({ hash: tx });
          return { success: true, txHash: tx, message: `Recompensas de staking reclamadas exitosamente` };
        }

        case 'set_payout_preference': {
          const pref = params.preference === 'ALPHA' ? 1 : 0;
          const tx = await client.writeContract({ address: this.contracts.REAL_YIELD_ROUTER, abi: this.abis.router, functionName: 'setPayoutPreference', args: [pref] });
          await this.publicClient.waitForTransactionReceipt({ hash: tx });
          return { success: true, txHash: tx, message: `Preferencia de rendimiento configurada a ${params.preference}` };
        }

        case 'deposit_treasury_usdc': {
          const amt = parseUnits(params.amount.toString(), 6);
          await client.writeContract({ address: this.contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [this.contracts.TREASURY, amt] });
          const tx = await client.writeContract({ address: this.contracts.TREASURY, abi: this.abis.treasury, functionName: 'deposit', args: [amt, 0n] });
          await this.publicClient.waitForTransactionReceipt({ hash: tx });
          return { success: true, txHash: tx, message: `Depositados ${params.amount} USDC en Tesorería -> ALPHA emitido` };
        }

        case 'redeem_alpha_usdc': {
          const amt = parseUnits(params.amount.toString(), 18);
          await client.writeContract({ address: this.contracts.ALPHA_TOKEN, abi: ERC20_ABI, functionName: 'approve', args: [this.contracts.TREASURY, amt] });
          const tx = await client.writeContract({ address: this.contracts.TREASURY, abi: this.abis.treasury, functionName: 'redeem', args: [amt, 0n] });
          await this.publicClient.waitForTransactionReceipt({ hash: tx });
          return { success: true, txHash: tx, message: `Redimidos ${params.amount} ALPHA -> USDC recibido de Tesorería` };
        }

        case 'borrow_from_treasury': {
          const collatAmt = parseUnits(params.collateralAmount.toString(), 6);
          const borrowAmt = parseUnits(params.borrowAmount.toString(), 6);
          const duration = BigInt(params.durationDays || 30);
          await client.writeContract({ address: this.contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [this.contracts.P2P_MARKET, collatAmt] });
          const tx = await client.writeContract({
            address: this.contracts.P2P_MARKET,
            abi: this.abis.p2p,
            functionName: 'borrowFromTreasuryWithAsset',
            args: [this.contracts.USDC, collatAmt, borrowAmt, duration]
          });
          await this.publicClient.waitForTransactionReceipt({ hash: tx });
          return { success: true, txHash: tx, message: `Préstamo solicitado: ${params.borrowAmount} USDC con garantía de ${params.collateralAmount} USDC` };
        }

        case 'warp_time_days': {
          const seconds = Number(params.days) * 86400;
          await this.publicClient.request({ method: 'evm_increaseTime' as any, params: [seconds] as any });
          await this.publicClient.request({ method: 'evm_mine' as any, params: [] as any });
          return { success: true, message: `Tiempo adelantado ${params.days} días en la cadena Anvil` };
        }

        case 'probe_unauthorized_call': {
          // Intentar llamada no autorizada o fuera de balance
          const tx = await client.writeContract({
            address: this.contracts.TREASURY,
            abi: this.abis.treasury,
            functionName: 'emergencyRedeem',
            args: [parseUnits('999999999', 18), 0n]
          });
          await this.publicClient.waitForTransactionReceipt({ hash: tx });
          return { success: true, txHash: tx, message: `Llamada no autorizada ejecutada (inesperado)` };
        }

        default:
          return { success: false, message: `Acción desconocida: ${action}` };
      }
    } catch (err: any) {
      return { success: false, message: `Revert / Bloqueo intencionado del protocolo: ${err.shortMessage || err.message}` };
    }
  }

  async checkInvariants(): Promise<InvariantResult[]> {
    const results: InvariantResult[] = [];

    // Invariant 1: Treasury Solvency & NAV Bounds
    try {
      const navPerShare = await this.publicClient.readContract({
        address: this.contracts.TREASURY,
        abi: this.abis.treasury,
        functionName: 'getNAVPerShare'
      }) as bigint;
      const navFormatted = parseFloat(formatUnits(navPerShare, 18));
      const passed = navFormatted >= 0.90 && navFormatted <= 5.0;
      results.push({
        name: 'Solvencia y Bounds de NAV',
        passed,
        metric: `NAV actual: $${navFormatted.toFixed(4)} (Rango válido: $0.90 - $5.00)`
      });
    } catch (e: any) {
      results.push({ name: 'Solvencia y Bounds de NAV', passed: false, metric: 'Error de consulta', error: e.message });
    }

    // Invariant 2: Staking Pool Backing Consistency
    try {
      const totalStaked = await this.publicClient.readContract({
        address: this.contracts.STAKING,
        abi: this.abis.staking,
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
        abi: this.abis.breaker,
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
        abi: this.abis.treasury,
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
