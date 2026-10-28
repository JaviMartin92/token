import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './GovernanceCommandCenter.module.css';
import { CONTRACT_ADDRESSES, publicClient, getWalletClient, ABIS } from '../utils/web3.js';
import { encodeFunctionData, parseEther, formatEther, keccak256, toHex } from 'viem';
import { UI_STRINGS } from '../constants/strings.js';
import { generateQuantumKeyPair, signWinternitzMessage } from '../utils/pqc.js';
import { Card, Badge, Button, StatCard } from './common/index.js';

interface GovernanceCommandCenterProps {
  web3Data: any;
  adminActions?: any;
  isAdmin?: boolean;
}

interface ProposalItem {
  id: number;
  proposer: string;
  startBlock: bigint;
  endBlock: bigint;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  eta: bigint;
  canceled: boolean;
  executed: boolean;
  timelockTxHash: string;
  target: string;
  value: bigint;
  data: string;
  description: string;
  state: number;
  hasUserVoted: boolean;
}

const PROPOSAL_STATE_CONFIG: Record<number, { label: string; variant: 'blue' | 'emerald' | 'amber' | 'crimson' | 'purple' | 'neutral' }> = {
  0: { label: UI_STRINGS.GOVERNANCE.STATUS_PENDING, variant: 'amber' },
  1: { label: UI_STRINGS.GOVERNANCE.STATUS_ACTIVE, variant: 'emerald' },
  2: { label: UI_STRINGS.GOVERNANCE.STATUS_CANCELED, variant: 'neutral' },
  3: { label: UI_STRINGS.GOVERNANCE.STATUS_DEFEATED, variant: 'crimson' },
  4: { label: UI_STRINGS.GOVERNANCE.STATUS_SUCCEEDED, variant: 'blue' },
  5: { label: UI_STRINGS.GOVERNANCE.STATUS_QUEUED, variant: 'purple' },
  6: { label: UI_STRINGS.GOVERNANCE.STATUS_EXPIRED, variant: 'neutral' },
  7: { label: UI_STRINGS.GOVERNANCE.STATUS_EXECUTED, variant: 'emerald' }
};

export const GovernanceCommandCenter: React.FC<GovernanceCommandCenterProps> = ({
  web3Data,
  adminActions: _adminActions,
  isAdmin: _isAdmin
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'proposals' | 'create' | 'metrics' | 'wallets' | 'security'>('proposals');

  // Live Proposals State
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState<boolean>(false);
  const [actionInProgressId, setActionInProgressId] = useState<number | null>(null);

  // Guided Proposal Creator State
  const [activeTemplate, setActiveTemplate] = useState<'weights' | 'fees' | 'circuit_breaker' | 'buyback' | 'grant' | 'custom'>('weights');
  const [customTarget, setCustomTarget] = useState<string>(CONTRACT_ADDRESSES.TREASURY || '');
  const [customEthValue, setCustomEthValue] = useState<string>('0');
  const [customCalldata, setCustomCalldata] = useState<string>('0x');
  const [proposalTitle, setProposalTitle] = useState<string>('');
  const [isSubmittingProposal, setIsSubmittingProposal] = useState<boolean>(false);
  const [proposalSubmitStatus, setProposalSubmitStatus] = useState<string | null>(null);

  // Template Specific Inputs
  // 1. Weights Template
  const [weightStables, setWeightStables] = useState<string>('50.0');
  const [weightWbtc, setWeightWbtc] = useState<string>('25.0');
  const [weightWeth, setWeightWeth] = useState<string>('12.5');
  const [weightAlts, setWeightAlts] = useState<string>('12.5');

  // 2. Fees Template
  const [feeDepositInput, setFeeDepositInput] = useState<string>('0.50');
  const [feeRedeemInput, setFeeRedeemInput] = useState<string>('1.00');
  const [feeP2pInput, setFeeP2pInput] = useState<string>('0.50');
  const [selectedFeeType, setSelectedFeeType] = useState<'deposit' | 'redeem' | 'p2p'>('deposit');

  // 3. Circuit Breaker Template
  const [breakerAsset, setBreakerAsset] = useState<string>(CONTRACT_ADDRESSES.USDC || '');

  // 4. Buyback Engine Template
  const [buybackBudgetInput, setBuybackBudgetInput] = useState<string>('50000');
  const [buybackDiscountBpsInput, setBuybackDiscountBpsInput] = useState<string>('500');

  // 5. Grant Template
  const [grantRecipient, setGrantRecipient] = useState<string>('');
  const [grantUsdcAmount, setGrantUsdcAmount] = useState<string>('10000');

  // Post-Quantum Cryptography (PQC W-OTS+) State
  const [pqcKeyPair, setPqcKeyPair] = useState<{ seeds: `0x${string}`[]; publicKeys: `0x${string}`[]; commitmentRoot: `0x${string}` } | null>(null);
  const [pqcCommitment, setPqcCommitment] = useState<string>('');
  const [pqcStatusMsg, setPqcStatusMsg] = useState<string>('');
  const [isPqcProcessing, setIsPqcProcessing] = useState<boolean>(false);

  // Derived Web3 Data
  const {
    navPerShareNum,
    proofOfReserves,
    totalBurnedTokens,
    porBreakdown,
    targetWeights
  } = web3Data;

  const currentChainId = web3Data.chainId ?? 31337;
  const userStakedBalanceNum = parseFloat((web3Data.stakedBalance || '0').replace(/,/g, ''));
  const PROPOSAL_THRESHOLD = 25000; // 25,000 stALPHA required to submit proposals
  const QUORUM_REQUIRED = 80000;    // 80,000 stALPHA required to pass
  const canPropose = userStakedBalanceNum >= PROPOSAL_THRESHOLD;

  const twStables = targetWeights?.stables ?? 50.00;
  const twWbtc = targetWeights?.wbtc ?? 25.00;
  const twWeth = targetWeights?.weth ?? 12.50;
  const twAlts = targetWeights?.alts ?? 12.50;

  const reserveBreakdown = porBreakdown ? {
    usdcUsd: String(porBreakdown.stables ?? 0),
    wbtcUsd: String(porBreakdown.wbtc ?? 0),
    wethUsd: String(porBreakdown.weth ?? 0),
    stakedAlphaUsd: String(porBreakdown.alphaStaking ?? 0)
  } : { usdcUsd: '0', wbtcUsd: '0', wethUsd: '0', stakedAlphaUsd: '0' };

  const totalAssetsVal = parseFloat(proofOfReserves?.totalAssetsUSD || '0');
  const totalLiabVal = parseFloat(proofOfReserves?.totalLiabilitiesUSD || '0');
  const solvencyRatio = totalLiabVal > 0 ? ((totalAssetsVal / totalLiabVal) * 100).toFixed(2) : '100.00';
  const navValueNum = navPerShareNum !== undefined ? navPerShareNum : 1.0;
  const burnedTokensStr = totalBurnedTokens || '0.00';

  // ---------------------------------------------------------------------------
  // 1. Fetch On-Chain Proposals from GovernorAlphaCentauri
  // ---------------------------------------------------------------------------
  const fetchProposals = useCallback(async () => {
    if (!CONTRACT_ADDRESSES.GOVERNOR || CONTRACT_ADDRESSES.GOVERNOR === '0x0000000000000000000000000000000000000000') {
      return;
    }
    setIsLoadingProposals(true);
    try {
      const count = (await publicClient.readContract({
        address: CONTRACT_ADDRESSES.GOVERNOR as `0x${string}`,
        abi: ABIS.GOVERNOR,
        functionName: 'proposalCount'
      })) as bigint;

      const numProposals = Number(count);
      const items: ProposalItem[] = [];
      const userAddr = (web3Data.userAddress || web3Data.activeKey || '0x0000000000000000000000000000000000000000') as `0x${string}`;

      for (let id = numProposals; id >= 1; id--) {
        try {
          const idBig = BigInt(id);
          const [pData, actions, pState, voted] = await Promise.all([
            publicClient.readContract({
              address: CONTRACT_ADDRESSES.GOVERNOR as `0x${string}`,
              abi: ABIS.GOVERNOR,
              functionName: 'proposals',
              args: [idBig]
            }) as Promise<any>,
            publicClient.readContract({
              address: CONTRACT_ADDRESSES.GOVERNOR as `0x${string}`,
              abi: ABIS.GOVERNOR,
              functionName: 'getProposalActions',
              args: [idBig]
            }) as Promise<[string, bigint, string, string]>,
            publicClient.readContract({
              address: CONTRACT_ADDRESSES.GOVERNOR as `0x${string}`,
              abi: ABIS.GOVERNOR,
              functionName: 'state',
              args: [idBig]
            }) as Promise<number>,
            userAddr && userAddr !== '0x0000000000000000000000000000000000000000'
              ? (publicClient.readContract({
                  address: CONTRACT_ADDRESSES.GOVERNOR as `0x${string}`,
                  abi: ABIS.GOVERNOR,
                  functionName: 'hasVoted',
                  args: [idBig, userAddr]
                }) as Promise<boolean>)
              : Promise.resolve(false)
          ]);

          items.push({
            id,
            proposer: pData.proposer || pData[1],
            startBlock: pData.startBlock || pData[2],
            endBlock: pData.endBlock || pData[3],
            forVotes: pData.forVotes || pData[4],
            againstVotes: pData.againstVotes || pData[5],
            abstainVotes: pData.abstainVotes || pData[6],
            eta: pData.eta || pData[7],
            canceled: pData.canceled !== undefined ? pData.canceled : pData[8],
            executed: pData.executed !== undefined ? pData.executed : pData[9],
            timelockTxHash: pData.timelockTxHash || pData[10],
            target: actions[0],
            value: actions[1],
            data: actions[2],
            description: actions[3] || `Propuesta #${id}`,
            state: pState,
            hasUserVoted: voted
          });
        } catch (innerErr) {
          console.warn(`Error al cargar datos de propuesta #${id}:`, innerErr);
        }
      }
      setProposals(items);
    } catch (err: any) {
      console.error('Error al consultar propuestas on-chain:', err);
    } finally {
      setIsLoadingProposals(false);
    }
  }, [web3Data.userAddress, web3Data.activeKey]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (isMounted) {
        await fetchProposals();
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [fetchProposals]);

  // ---------------------------------------------------------------------------
  // 2. Voting & Timelock Actions Handlers
  // ---------------------------------------------------------------------------
  const handleCastVote = async (proposalId: number, support: number) => {
    try {
      setActionInProgressId(proposalId);
      const client = getWalletClient(web3Data.activeKey || web3Data.userAddress);
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESSES.GOVERNOR as `0x${string}`,
        abi: ABIS.GOVERNOR,
        functionName: 'castVote',
        args: [BigInt(proposalId), support]
      });
      await publicClient.waitForTransactionReceipt({ hash });
      web3Data.addToast?.('success', 'Voto Registrado', `Voto emitido con éxito en la propuesta #${proposalId}.`, hash);
      web3Data.addLog?.(`✅ Voto emitido en propuesta #${proposalId}. Tx: ${hash}`);
      await fetchProposals();
      if (web3Data.fetchData) await web3Data.fetchData();
    } catch (err: any) {
      console.error('Error al emitir voto:', err);
      web3Data.addToast?.('error', 'Error al Votar', err.shortMessage || err.message || 'Fallo en voto');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleQueueProposal = async (proposalId: number) => {
    try {
      setActionInProgressId(proposalId);
      const client = getWalletClient(web3Data.activeKey || web3Data.userAddress);
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESSES.GOVERNOR as `0x${string}`,
        abi: ABIS.GOVERNOR,
        functionName: 'queue',
        args: [BigInt(proposalId)]
      });
      await publicClient.waitForTransactionReceipt({ hash });
      web3Data.addToast?.('info', 'Propuesta Encolada', `Propuesta #${proposalId} encolada en Timelock (72h).`, hash);
      web3Data.addLog?.(`⏱️ Propuesta #${proposalId} encolada en Timelock. Tx: ${hash}`);
      await fetchProposals();
      if (web3Data.fetchData) await web3Data.fetchData();
    } catch (err: any) {
      console.error('Error al encolar en timelock:', err);
      web3Data.addToast?.('error', 'Error Timelock', err.shortMessage || err.message || 'Fallo al encolar');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleExecuteProposal = async (proposalId: number) => {
    try {
      setActionInProgressId(proposalId);
      const client = getWalletClient(web3Data.activeKey || web3Data.userAddress);
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESSES.GOVERNOR as `0x${string}`,
        abi: ABIS.GOVERNOR,
        functionName: 'execute',
        args: [BigInt(proposalId)]
      });
      await publicClient.waitForTransactionReceipt({ hash });
      web3Data.addToast?.('success', 'Propuesta Ejecutada', `Propuesta #${proposalId} ejecutada on-chain.`, hash);
      web3Data.addLog?.(`⚡ Propuesta #${proposalId} ejecutada on-chain. Tx: ${hash}`);
      await fetchProposals();
      if (web3Data.fetchData) await web3Data.fetchData();
    } catch (err: any) {
      console.error('Error al ejecutar propuesta:', err);
      web3Data.addToast?.('error', 'Error de Ejecución', err.shortMessage || err.message || 'Fallo al ejecutar');
    } finally {
      setActionInProgressId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. Calldata Encoding based on Active Template
  // ---------------------------------------------------------------------------
  const { generatedTarget, generatedCalldata, generatedDescription } = useMemo(() => {
    try {
      if (activeTemplate === 'weights') {
        const uBps = BigInt(Math.round(parseFloat(weightStables || '0') * 100));
        const bBps = BigInt(Math.round(parseFloat(weightWbtc || '0') * 100));
        const eBps = BigInt(Math.round(parseFloat(weightWeth || '0') * 100));
        const aBps = BigInt(Math.round(parseFloat(weightAlts || '0') * 100));
        const data = encodeFunctionData({
          abi: [{
            name: 'setTargetWeights',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'usdcBps', type: 'uint256' },
              { name: 'wbtcBps', type: 'uint256' },
              { name: 'wethBps', type: 'uint256' },
              { name: 'altsBps', type: 'uint256' }
            ],
            outputs: []
          }] as const,
          functionName: 'setTargetWeights',
          args: [uBps, bBps, eBps, aBps]
        });
        return {
          generatedTarget: CONTRACT_ADDRESSES.TREASURY as `0x${string}`,
          generatedCalldata: data,
          generatedDescription: proposalTitle.trim() || `Rebalanceo de Ponderaciones de Reserva: ${weightStables}% USDC / ${weightWbtc}% WBTC / ${weightWeth}% WETH / ${weightAlts}% stALPHA`
        };
      }

      if (activeTemplate === 'fees') {
        if (selectedFeeType === 'deposit') {
          const bps = BigInt(Math.round(parseFloat(feeDepositInput || '0') * 100));
          const data = encodeFunctionData({
            abi: [{ name: 'setDepositFee', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'feeBps', type: 'uint256' }], outputs: [] }] as const,
            functionName: 'setDepositFee',
            args: [bps]
          });
          return {
            generatedTarget: CONTRACT_ADDRESSES.TREASURY as `0x${string}`,
            generatedCalldata: data,
            generatedDescription: proposalTitle.trim() || `Ajuste Comisión de Depósito Tesorería a ${feeDepositInput}% (${bps} Bps)`
          };
        } else if (selectedFeeType === 'redeem') {
          const bps = BigInt(Math.round(parseFloat(feeRedeemInput || '0') * 100));
          const data = encodeFunctionData({
            abi: [{ name: 'setRedeemFee', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'feeBps', type: 'uint256' }], outputs: [] }] as const,
            functionName: 'setRedeemFee',
            args: [bps]
          });
          return {
            generatedTarget: CONTRACT_ADDRESSES.TREASURY as `0x${string}`,
            generatedCalldata: data,
            generatedDescription: proposalTitle.trim() || `Ajuste Comisión de Canje Directo / Redeem a ${feeRedeemInput}% (${bps} Bps)`
          };
        } else {
          const bps = BigInt(Math.round(parseFloat(feeP2pInput || '0') * 100));
          const data = encodeFunctionData({
            abi: [{ name: 'setFeeBps', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'feeBps', type: 'uint256' }], outputs: [] }] as const,
            functionName: 'setFeeBps',
            args: [bps]
          });
          return {
            generatedTarget: CONTRACT_ADDRESSES.P2P_MARKET as `0x${string}`,
            generatedCalldata: data,
            generatedDescription: proposalTitle.trim() || `Ajuste Fee Originación Préstamos P2P a ${feeP2pInput}% (${bps} Bps)`
          };
        }
      }

      if (activeTemplate === 'circuit_breaker') {
        const targetAsset = (breakerAsset && breakerAsset.startsWith('0x') ? breakerAsset : CONTRACT_ADDRESSES.USDC) as `0x${string}`;
        const data = encodeFunctionData({
          abi: [{ name: 'resetBreaker', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }], outputs: [] }] as const,
          functionName: 'resetBreaker',
          args: [targetAsset]
        });
        return {
          generatedTarget: CONTRACT_ADDRESSES.CIRCUIT_BREAKER as `0x${string}`,
          generatedCalldata: data,
          generatedDescription: proposalTitle.trim() || `Descongelar Circuit Breaker de Emergencia para el Activo ${targetAsset.slice(0, 10)}...`
        };
      }

      if (activeTemplate === 'buyback') {
        const budgetUnits = BigInt(Math.floor(parseFloat(buybackBudgetInput || '0') * 1e6));
        const discBps = BigInt(parseInt(buybackDiscountBpsInput || '0', 10));
        const data = encodeFunctionData({
          abi: [{
            name: 'setBuybackParameters',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'dailyBudgetUSDC', type: 'uint256' },
              { name: 'targetDiscountBps', type: 'uint256' }
            ],
            outputs: []
          }] as const,
          functionName: 'setBuybackParameters',
          args: [budgetUnits, discBps]
        });
        return {
          generatedTarget: CONTRACT_ADDRESSES.DISCOUNT_BUYBACK_ENGINE as `0x${string}`,
          generatedCalldata: data,
          generatedDescription: proposalTitle.trim() || `Actualizar Parámetros Motor de Recompra DEX: Presupuesto ${buybackBudgetInput} USDC/día @ ${buybackDiscountBpsInput} Bps Descuento`
        };
      }

      if (activeTemplate === 'grant') {
        const recipient = (grantRecipient && grantRecipient.startsWith('0x') ? grantRecipient : '0x0000000000000000000000000000000000000000') as `0x${string}`;
        const amountUnits = BigInt(Math.floor(parseFloat(grantUsdcAmount || '0') * 1e6));
        const data = encodeFunctionData({
          abi: [{
            name: 'withdrawUSDC',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'recipient', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ],
            outputs: []
          }] as const,
          functionName: 'withdrawUSDC',
          args: [recipient, amountUnits]
        });
        return {
          generatedTarget: CONTRACT_ADDRESSES.TREASURY as `0x${string}`,
          generatedCalldata: data,
          generatedDescription: proposalTitle.trim() || `Asignación de Subvención / Presupuesto de Tesorería: ${grantUsdcAmount} USDC a ${recipient.slice(0, 10)}...`
        };
      }

      // Default Custom
      return {
        generatedTarget: (customTarget && customTarget.startsWith('0x') ? customTarget : CONTRACT_ADDRESSES.TREASURY) as `0x${string}`,
        generatedCalldata: (customCalldata && customCalldata.startsWith('0x') ? customCalldata : '0x') as `0x${string}`,
        generatedDescription: proposalTitle.trim() || 'Propuesta de Gobernanza DAO Personalizada'
      };
    } catch {
      return {
        generatedTarget: CONTRACT_ADDRESSES.TREASURY as `0x${string}`,
        generatedCalldata: '0x' as `0x${string}`,
        generatedDescription: proposalTitle.trim() || 'Propuesta de Gobernanza'
      };
    }
  }, [
    activeTemplate,
    weightStables,
    weightWbtc,
    weightWeth,
    weightAlts,
    selectedFeeType,
    feeDepositInput,
    feeRedeemInput,
    feeP2pInput,
    breakerAsset,
    buybackBudgetInput,
    buybackDiscountBpsInput,
    grantRecipient,
    grantUsdcAmount,
    customTarget,
    customCalldata,
    proposalTitle
  ]);

  // ---------------------------------------------------------------------------
  // 4. Submit Guided Governance Proposal to GovernorAlphaCentauri.propose()
  // ---------------------------------------------------------------------------
  const handleSubmitProposal = async () => {
    if (!canPropose) {
      web3Data.addToast?.('warning', 'Umbral Insuficiente', `Posees ${userStakedBalanceNum} stALPHA. Se requieren al menos ${PROPOSAL_THRESHOLD.toLocaleString()} stALPHA para presentar propuestas.`);
      return;
    }
    if (!generatedCalldata || generatedCalldata === '0x') {
      web3Data.addToast?.('error', 'Calldata Inválido', 'Los datos calldata codificados están vacíos o son inválidos.');
      return;
    }

    try {
      setIsSubmittingProposal(true);
      setProposalSubmitStatus(null);
      const client = getWalletClient(web3Data.activeKey || web3Data.userAddress);
      const governorAddress = CONTRACT_ADDRESSES.GOVERNOR;
      if (!governorAddress) throw new Error('Dirección de Governor no configurada');

      const ethVal = activeTemplate === 'custom' ? parseEther(customEthValue || '0') : 0n;

      const hash = await client.writeContract({
        address: governorAddress as `0x${string}`,
        abi: ABIS.GOVERNOR,
        functionName: 'propose',
        args: [generatedTarget, ethVal, generatedCalldata as `0x${string}`, generatedDescription]
      });

      await publicClient.waitForTransactionReceipt({ hash });
      setProposalSubmitStatus(`✅ Propuesta registrada con éxito en GovernorAlphaCentauri. Tx: ${hash}`);
      setProposalTitle('');
      await fetchProposals();
      setActiveSubTab('proposals');
      if (web3Data.fetchData) await web3Data.fetchData();
    } catch (err: any) {
      console.error('Error enviando propuesta DAO:', err);
      setProposalSubmitStatus(`❌ Error al enviar propuesta: ${err.shortMessage || err.message || err}`);
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. Post-Quantum Cryptography Handlers
  // ---------------------------------------------------------------------------
  const handleGeneratePqcKeys = () => {
    try {
      setIsPqcProcessing(true);
      const kp = generateQuantumKeyPair();
      setPqcKeyPair(kp);
      setPqcStatusMsg(`⚡ Par de claves post-cuánticas generado (67 cadenas W-OTS+). Raíz: ${kp.commitmentRoot.slice(0, 18)}...`);
    } catch (err: any) {
      setPqcStatusMsg(`Error generando claves PQC: ${err.message || err}`);
    } finally {
      setIsPqcProcessing(false);
    }
  };

  const handleRegisterCommitmentOnChain = async () => {
    if (!pqcKeyPair) return;
    try {
      setIsPqcProcessing(true);
      setPqcStatusMsg('Enviando raíz de compromiso a PostQuantumGuard.sol en blockchain...');
      const client = getWalletClient(web3Data.activeKey || web3Data.userAddress);
      const targetContract = CONTRACT_ADDRESSES.POST_QUANTUM_GUARD;
      if (!targetContract || targetContract === '0x0000000000000000000000000000000000000000') {
        throw new Error('Contrato PostQuantumGuard no configurado o no desplegado');
      }
      const tx = await client.writeContract({
        address: targetContract as `0x${string}`,
        abi: [
          {
            name: 'registerQuantumCommitment',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [{ name: 'commitmentRoot', type: 'bytes32' }],
            outputs: []
          }
        ] as const,
        functionName: 'registerQuantumCommitment',
        args: [pqcKeyPair.commitmentRoot]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setPqcCommitment(pqcKeyPair.commitmentRoot);
      setPqcStatusMsg(`✅ Compromiso Post-Cuántica anclado con éxito. Tx: ${tx.slice(0, 16)}...`);
    } catch (err: any) {
      setPqcStatusMsg(`Error registrando compromiso cuántico: ${err.message || err}`);
    } finally {
      setIsPqcProcessing(false);
    }
  };

  const handleTestQuantumVerification = async () => {
    if (!pqcKeyPair || !pqcCommitment) return;
    try {
      setIsPqcProcessing(true);
      setPqcStatusMsg('Firmando acción administrativa con W-OTS+ y verificando on-chain...');
      const client = getWalletClient(web3Data.activeKey || web3Data.userAddress);
      const targetContract = CONTRACT_ADDRESSES.POST_QUANTUM_GUARD;
      const actionId = keccak256(toHex(`PQC_ACTION_${Date.now()}`));
      const signature = signWinternitzMessage(actionId, pqcKeyPair.seeds);

      const tx = await client.writeContract({
        address: targetContract as `0x${string}`,
        abi: [
          {
            name: 'authorizeActionWithQuantumSignature',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'commitmentRoot', type: 'bytes32' },
              { name: 'actionId', type: 'bytes32' },
              { name: 'signature', type: 'bytes32[]' }
            ],
            outputs: []
          }
        ] as const,
        functionName: 'authorizeActionWithQuantumSignature',
        args: [pqcKeyPair.commitmentRoot as `0x${string}`, actionId, signature]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setPqcStatusMsg(`🛡️ ¡Acción certificada y ejecutada con Firma Cuántica W-OTS+! Tx: ${tx.slice(0, 16)}...`);
    } catch (err: any) {
      setPqcStatusMsg(`Error verificando firma cuántica: ${err.message || err}`);
    } finally {
      setIsPqcProcessing(false);
    }
  };

  return (
    <Card
      variant="surface"
      collapsible
      defaultExpanded={true}
      headerTitle={`⚖️ ${UI_STRINGS.GOVERNANCE.TITLE}`}
      headerSubtitle={UI_STRINGS.GOVERNANCE.SUBTITLE}
      headerAction={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Badge variant="blue" size="sm">
            EVM Chain {currentChainId}
          </Badge>
          <Badge variant="emerald" size="sm">
            <span data-testid="admin-por-solvency-ratio">{solvencyRatio}% Solvencia</span>
          </Badge>
          <Badge variant="purple" size="sm">
            <span data-testid="admin-nav-per-share">${navValueNum.toFixed(4)} NAV</span>
          </Badge>
          <Badge variant={canPropose ? 'emerald' : 'amber'} size="sm">
            {userStakedBalanceNum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} stALPHA Voto
          </Badge>
        </div>
      }
    >
      <div className={styles.container}>
        {/* Anti-Spam & Quorum Global Status Banner */}
        <div className={canPropose ? styles.antiSpamSuccess : styles.antiSpamBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{canPropose ? '✅' : '⚠️'}</span>
            <span>
              <strong>{UI_STRINGS.GOVERNANCE.VOTING_POWER_LABEL}</strong>{' '}
              {userStakedBalanceNum.toLocaleString('en-US', { minimumFractionDigits: 2 })} stALPHA |{' '}
              <strong>{UI_STRINGS.GOVERNANCE.LABEL_PROPOSAL_THRESHOLD}</strong> {UI_STRINGS.GOVERNANCE.VAL_PROPOSAL_THRESHOLD} |{' '}
              <strong>{UI_STRINGS.GOVERNANCE.LABEL_QUORUM_REQUIRED}</strong> {UI_STRINGS.GOVERNANCE.VAL_QUORUM_REQUIRED}
            </span>
          </div>
          <Badge variant={canPropose ? 'emerald' : 'amber'} size="sm">
            {canPropose ? UI_STRINGS.GOVERNANCE.ELIGIBLE_BADGE : UI_STRINGS.GOVERNANCE.INELIGIBLE_BADGE}
          </Badge>
        </div>

        {/* 🧭 Sub-Tabs Navigation */}
        <div className={styles.subTabsBar}>
          {[
            { key: 'proposals', label: UI_STRINGS.GOVERNANCE.TAB_PROPOSALS_LIST, icon: '📜' },
            { key: 'create', label: UI_STRINGS.GOVERNANCE.TAB_PARAM_CONTROL, icon: '➕' },
            { key: 'metrics', label: UI_STRINGS.GOVERNANCE.TAB_AUDIT_METRICS, icon: '📊' },
            { key: 'wallets', label: UI_STRINGS.GOVERNANCE.TAB_PROTOCOL_VAULTS, icon: '💼' },
            { key: 'security', label: UI_STRINGS.GOVERNANCE.TAB_SECURITY, icon: '🛡️' }
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              data-testid={`admin-subtab-${tab.key}`}
              onClick={() => setActiveSubTab(tab.key as any)}
              className={activeSubTab === tab.key ? styles.subTabBtnActive : styles.subTabBtn}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ================================================================== */}
        {/* TAB 1: 📜 ON-CHAIN PROPOSALS FEED & VOTING CONSOLE                 */}
        {/* ================================================================== */}
        {activeSubTab === 'proposals' && (
          <div className={styles.proposalsList}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 className={styles.sectionHeading} style={{ margin: 0 }}>
                <span>📜</span>
                <span>{UI_STRINGS.GOVERNANCE.PROPOSALS_TABLE_TITLE} ({proposals.length})</span>
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchProposals}
                disabled={isLoadingProposals}
              >
                {isLoadingProposals ? 'Cargando...' : '🔄 Actualizar'}
              </Button>
            </div>

            {proposals.length === 0 ? (
              <div className={styles.noProposalsBox}>
                <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                  🏛️ {UI_STRINGS.GOVERNANCE.NO_PROPOSALS_FOUND}
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: '0.8125rem' }}>
                  Utiliza la pestaña <strong>"{UI_STRINGS.GOVERNANCE.TAB_PARAM_CONTROL}"</strong> para crear la primera propuesta de la DAO con tus tokens stALPHA.
                </p>
              </div>
            ) : (
              proposals.map((prop) => {
                const cfg = PROPOSAL_STATE_CONFIG[prop.state] || { label: 'Desconocido', variant: 'neutral' };
                const forNum = parseFloat(formatEther(prop.forVotes));
                const againstNum = parseFloat(formatEther(prop.againstVotes));
                const abstainNum = parseFloat(formatEther(prop.abstainVotes));
                const totalParticipationNum = forNum + againstNum + abstainNum;
                const quorumMet = totalParticipationNum >= QUORUM_REQUIRED;
                const quorumPct = Math.min(100, (totalParticipationNum / QUORUM_REQUIRED) * 100);
                const isProcessing = actionInProgressId === prop.id;

                return (
                  <div key={prop.id} className={styles.proposalCard} data-testid={`proposal-card-${prop.id}`}>
                    <div className={styles.proposalHeader}>
                      <div className={styles.proposalTitleBlock}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={styles.proposalIdTag}>Propuesta #{prop.id}</span>
                          <Badge variant={cfg.variant} size="sm">
                            {cfg.label}
                          </Badge>
                          {prop.hasUserVoted && (
                            <Badge variant="emerald" size="sm">
                              ✅ Voto Registrado
                            </Badge>
                          )}
                        </div>
                        <h4 className={styles.proposalTitle}>{prop.description}</h4>
                        <div className={styles.proposalMeta}>
                          <span className={styles.proposalMetaItem}>
                            <strong>Propositor:</strong> <code>{prop.proposer.slice(0, 8)}...{prop.proposer.slice(-6)}</code>
                          </span>
                          <span className={styles.proposalMetaItem}>
                            <strong>Bloques:</strong> {prop.startBlock.toString()} → {prop.endBlock.toString()}
                          </span>
                          {prop.eta > 0n && (
                            <span className={styles.proposalMetaItem}>
                              <strong>ETA Timelock:</strong> {new Date(Number(prop.eta) * 1000).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Target & Calldata preview */}
                    <div className={styles.proposalTargetBox}>
                      <span style={{ color: 'var(--text-tertiary)' }}>Target: </span>
                      <span style={{ color: 'var(--color-blue-light)' }}>{prop.target}</span>
                      <span style={{ margin: '0 8px', color: 'var(--border-default)' }}>|</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>Data: </span>
                      <span>{prop.data.slice(0, 34)}...</span>
                    </div>

                    {/* Votes Grid */}
                    <div className={styles.proposalVotesGrid}>
                      <div className={styles.voteTallyCard}>
                        <span className={styles.voteTallyLabel}>{UI_STRINGS.GOVERNANCE.TH_VOTES_FOR}</span>
                        <span className={styles.voteTallyValFor}>
                          {forNum.toLocaleString('en-US', { maximumFractionDigits: 0 })} stALPHA
                        </span>
                      </div>
                      <div className={styles.voteTallyCard}>
                        <span className={styles.voteTallyLabel}>{UI_STRINGS.GOVERNANCE.TH_VOTES_AGAINST}</span>
                        <span className={styles.voteTallyValAgainst}>
                          {againstNum.toLocaleString('en-US', { maximumFractionDigits: 0 })} stALPHA
                        </span>
                      </div>
                      <div className={styles.voteTallyCard}>
                        <span className={styles.voteTallyLabel}>Abstención</span>
                        <span className={styles.voteTallyValAbstain}>
                          {abstainNum.toLocaleString('en-US', { maximumFractionDigits: 0 })} stALPHA
                        </span>
                      </div>
                    </div>

                    {/* Quorum Progress Bar */}
                    <div className={styles.quorumContainer}>
                      <div className={styles.quorumHeader}>
                        <span>
                          Quórum de Participación: <strong>{totalParticipationNum.toLocaleString('en-US', { maximumFractionDigits: 0 })} / {QUORUM_REQUIRED.toLocaleString('en-US')} stALPHA</strong> ({quorumPct.toFixed(1)}%)
                        </span>
                        <span className={quorumMet ? styles.quorumMetText : styles.quorumPendingText}>
                          {quorumMet ? '✅ Quórum Alcanzado' : `Faltan ${(QUORUM_REQUIRED - totalParticipationNum).toLocaleString('en-US', { maximumFractionDigits: 0 })} stALPHA`}
                        </span>
                      </div>
                      <div className={styles.quorumProgressBar}>
                        <div
                          className={quorumMet ? styles.quorumProgressFillMet : styles.quorumProgressFill}
                          style={{ width: `${quorumPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Proposal Action Buttons */}
                    <div className={styles.proposalActionsRow}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                        {prop.state === 1 && !prop.hasUserVoted && 'Emite tu voto ponderado con tu saldo stALPHA:'}
                        {prop.state === 1 && prop.hasUserVoted && 'Has participado en esta votación on-chain.'}
                        {prop.state === 4 && 'La propuesta ha superado el quórum y puede ser puesta en cola en Timelock (72h).'}
                        {prop.state === 5 && 'Propuesta asegurada en Timelock. Lista para ejecución definitiva al cumplir el plazo.'}
                      </span>

                      <div className={styles.voteButtonGroup}>
                        {/* Vote Buttons when Active */}
                        {prop.state === 1 && !prop.hasUserVoted && (
                          <>
                            <Button
                              variant="emerald"
                              size="sm"
                              onClick={() => handleCastVote(prop.id, 1)}
                              disabled={isProcessing}
                            >
                              {UI_STRINGS.GOVERNANCE.BTN_VOTE_FOR}
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleCastVote(prop.id, 0)}
                              disabled={isProcessing}
                            >
                              {UI_STRINGS.GOVERNANCE.BTN_VOTE_AGAINST}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleCastVote(prop.id, 2)}
                              disabled={isProcessing}
                            >
                              {UI_STRINGS.GOVERNANCE.BTN_VOTE_ABSTAIN}
                            </Button>
                          </>
                        )}

                        {/* Queue Button when Succeeded */}
                        {prop.state === 4 && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleQueueProposal(prop.id)}
                            disabled={isProcessing}
                          >
                            {UI_STRINGS.GOVERNANCE.BTN_QUEUE_TIMELOCK}
                          </Button>
                        )}

                        {/* Execute Button when Queued */}
                        {prop.state === 5 && (
                          <Button
                            variant="emerald"
                            size="sm"
                            onClick={() => handleExecuteProposal(prop.id)}
                            disabled={isProcessing}
                          >
                            {UI_STRINGS.GOVERNANCE.BTN_EXECUTE_TIMELOCK}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 2: ➕ GUIDED PROPOSAL CREATOR (PURE DEFI GOVERNANCE)           */}
        {/* ================================================================== */}
        {activeSubTab === 'create' && (
          <div>
            <h3 className={styles.sectionHeading}>
              <span>🏛️</span>
              <span>{UI_STRINGS.GOVERNANCE.CARD_PROPOSE_TITLE}</span>
            </h3>

            <div className={styles.pureBanner}>
              🏛️ <strong>Gobernanza Soberana Pure DeFi</strong>: Toda modificación de parámetros, comisiones, ponderaciones de reserva o asignaciones financieras debe nacer formalmente de una propuesta on-chain en <code>GovernorAlphaCentauri.sol</code> y superar el quórum mínimo de {UI_STRINGS.GOVERNANCE.VAL_QUORUM_REQUIRED} con timelock mandatorio de {UI_STRINGS.GOVERNANCE.VAL_TIMELOCK_DELAY}.
            </div>

            {/* Template Selector */}
            <div className={styles.templateSelector}>
              {[
                { key: 'weights', label: UI_STRINGS.GOVERNANCE.TEMPLATE_WEIGHTS, icon: '⚖️' },
                { key: 'fees', label: UI_STRINGS.GOVERNANCE.TEMPLATE_FEES, icon: '💰' },
                { key: 'circuit_breaker', label: UI_STRINGS.GOVERNANCE.TEMPLATE_CIRCUIT_BREAKER, icon: '⚡' },
                { key: 'buyback', label: UI_STRINGS.GOVERNANCE.TEMPLATE_BUYBACK, icon: '🔥' },
                { key: 'grant', label: UI_STRINGS.GOVERNANCE.TEMPLATE_GRANT, icon: '🏦' },
                { key: 'custom', label: UI_STRINGS.GOVERNANCE.TEMPLATE_CUSTOM, icon: '🛠️' }
              ].map((tmpl) => (
                <button
                  key={tmpl.key}
                  type="button"
                  onClick={() => setActiveTemplate(tmpl.key as any)}
                  className={activeTemplate === tmpl.key ? styles.templateBtnActive : styles.templateBtn}
                >
                  <span>{tmpl.icon}</span>
                  <span>{tmpl.label}</span>
                </button>
              ))}
            </div>

            {/* Dynamic Template Form */}
            <div className={styles.promoForm} style={{ maxWidth: '100%' }}>
              {/* TEMPLATE 1: WEIGHTS */}
              {activeTemplate === 'weights' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <span className={styles.paramLabel}>
                    Ponderaciones Objetivo de Reserva (% Total debe sumar 100.0%):
                  </span>
                  <div className={styles.paramGrid}>
                    <div className={styles.paramCard}>
                      <span className={styles.paramLabel}>💵 USDC Sub-Reserva (%)</span>
                      <input
                        type="number"
                        step="0.5"
                        value={weightStables}
                        onChange={(e) => setWeightStables(e.target.value)}
                        className={styles.paramInput}
                      />
                    </div>
                    <div className={styles.paramCard}>
                      <span className={styles.paramLabel}>₿ Wrapped Bitcoin - WBTC (%)</span>
                      <input
                        type="number"
                        step="0.5"
                        value={weightWbtc}
                        onChange={(e) => setWeightWbtc(e.target.value)}
                        className={styles.paramInput}
                      />
                    </div>
                    <div className={styles.paramCard}>
                      <span className={styles.paramLabel}>Ξ Wrapped Ethereum - WETH (%)</span>
                      <input
                        type="number"
                        step="0.5"
                        value={weightWeth}
                        onChange={(e) => setWeightWeth(e.target.value)}
                        className={styles.paramInput}
                      />
                    </div>
                    <div className={styles.paramCard}>
                      <span className={styles.paramLabel}>🥩 Staked ALPHA (%)</span>
                      <input
                        type="number"
                        step="0.5"
                        value={weightAlts}
                        onChange={(e) => setWeightAlts(e.target.value)}
                        className={styles.paramInput}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TEMPLATE 2: FEES */}
              {activeTemplate === 'fees' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      variant={selectedFeeType === 'deposit' ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setSelectedFeeType('deposit')}
                    >
                      Comisión Depósito Tesorería
                    </Button>
                    <Button
                      variant={selectedFeeType === 'redeem' ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setSelectedFeeType('redeem')}
                    >
                      Comisión Canje / Redeem
                    </Button>
                    <Button
                      variant={selectedFeeType === 'p2p' ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setSelectedFeeType('p2p')}
                    >
                      Fee Originación P2P
                    </Button>
                  </div>

                  {selectedFeeType === 'deposit' && (
                    <div className={styles.paramCard}>
                      <span className={styles.paramLabel}>{UI_STRINGS.GOVERNANCE.LABEL_DEPOSIT_FEE_PCT}</span>
                      <input
                        type="number"
                        step="0.05"
                        value={feeDepositInput}
                        onChange={(e) => setFeeDepositInput(e.target.value)}
                        className={styles.paramInput}
                      />
                      <span className={styles.paramSubtext}>
                        Equivalente: {Math.round(parseFloat(feeDepositInput || '0') * 100)} Puntos Básicos (BPS)
                      </span>
                    </div>
                  )}

                  {selectedFeeType === 'redeem' && (
                    <div className={styles.paramCard}>
                      <span className={styles.paramLabel}>{UI_STRINGS.GOVERNANCE.LABEL_REDEEM_FEE_PCT}</span>
                      <input
                        type="number"
                        step="0.05"
                        value={feeRedeemInput}
                        onChange={(e) => setFeeRedeemInput(e.target.value)}
                        className={styles.paramInput}
                      />
                      <span className={styles.paramSubtext}>
                        Equivalente: {Math.round(parseFloat(feeRedeemInput || '0') * 100)} Puntos Básicos (BPS)
                      </span>
                    </div>
                  )}

                  {selectedFeeType === 'p2p' && (
                    <div className={styles.paramCard}>
                      <span className={styles.paramLabel}>{UI_STRINGS.GOVERNANCE.LABEL_P2P_FEE_PCT}</span>
                      <input
                        type="number"
                        step="0.05"
                        value={feeP2pInput}
                        onChange={(e) => setFeeP2pInput(e.target.value)}
                        className={styles.paramInput}
                      />
                      <span className={styles.paramSubtext}>
                        Equivalente: {Math.round(parseFloat(feeP2pInput || '0') * 100)} Puntos Básicos (BPS)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* TEMPLATE 3: CIRCUIT BREAKER */}
              {activeTemplate === 'circuit_breaker' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>Dirección del Activo de Reserva a Descongelar / Resetear:</span>
                    <input
                      type="text"
                      value={breakerAsset}
                      onChange={(e) => setBreakerAsset(e.target.value)}
                      placeholder="0x..."
                      className={styles.paramInput}
                    />
                    <span className={styles.paramSubtext}>
                      Llama a <code>CircuitBreaker.resetBreaker(address)</code> para restablecer la liquidez tras una alerta de volatilidad.
                    </span>
                  </div>
                </div>
              )}

              {/* TEMPLATE 4: BUYBACK ENGINE */}
              {activeTemplate === 'buyback' && (
                <div className={styles.twoColInputs}>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>Presupuesto Diario de Recompra (USDC):</span>
                    <input
                      type="number"
                      value={buybackBudgetInput}
                      onChange={(e) => setBuybackBudgetInput(e.target.value)}
                      className={styles.paramInput}
                    />
                  </div>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>Umbral Mínimo de Descuento DEX (BPS):</span>
                    <input
                      type="number"
                      value={buybackDiscountBpsInput}
                      onChange={(e) => setBuybackDiscountBpsInput(e.target.value)}
                      className={styles.paramInput}
                    />
                    <span className={styles.paramSubtext}>500 Bps = 5.0% de descuento bajo el NAV</span>
                  </div>
                </div>
              )}

              {/* TEMPLATE 5: GRANT */}
              {activeTemplate === 'grant' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setGrantRecipient('0xC4000000000000000000000000000000000000C4');
                        setGrantUsdcAmount('25000');
                        setProposalTitle('Financiación de Auditoría Comunitaria On-Chain (Code4rena / Cantina Escrow)');
                      }}
                    >
                      🛡️ Pre-llenar Auditoría Comunitaria (Code4rena Escrow 25K USDC)
                    </Button>
                  </div>
                  <div className={styles.twoColInputs}>
                    <div className={styles.paramCard}>
                      <span className={styles.paramLabel}>Billetera Receptora / Contrato Escrow (Beneficiary):</span>
                      <input
                        type="text"
                        placeholder="0x..."
                        value={grantRecipient}
                        onChange={(e) => setGrantRecipient(e.target.value)}
                        className={styles.paramInput}
                      />
                    </div>
                    <div className={styles.paramCard}>
                      <span className={styles.paramLabel}>Monto de Fondos en USDC:</span>
                      <input
                        type="number"
                        placeholder="10000"
                        value={grantUsdcAmount}
                        onChange={(e) => setGrantUsdcAmount(e.target.value)}
                        className={styles.paramInput}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TEMPLATE 6: CUSTOM */}
              {activeTemplate === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className={styles.paramCard}>
                    <span className={styles.paramLabel}>{UI_STRINGS.GOVERNANCE.LABEL_TARGET_CONTRACT}</span>
                    <input
                      type="text"
                      value={customTarget}
                      onChange={(e) => setCustomTarget(e.target.value)}
                      className={styles.paramInput}
                    />
                  </div>
                  <div className={styles.twoColInputs}>
                    <div className={styles.paramCard}>
                      <span className={styles.paramLabel}>Valor ETH a Transferir (msg.value):</span>
                      <input
                        type="text"
                        value={customEthValue}
                        onChange={(e) => setCustomEthValue(e.target.value)}
                        className={styles.paramInput}
                      />
                    </div>
                    <div className={styles.paramCard}>
                      <span className={styles.paramLabel}>{UI_STRINGS.GOVERNANCE.LABEL_CALLDATA}</span>
                      <input
                        type="text"
                        value={customCalldata}
                        onChange={(e) => setCustomCalldata(e.target.value)}
                        placeholder="0x..."
                        className={styles.paramInput}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Description & Justification */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className={styles.paramLabel}>{UI_STRINGS.GOVERNANCE.LABEL_DESCRIPTION}</label>
                <input
                  type="text"
                  placeholder="Ej. Rebalanceo Trimestral de Reservas para Maximizar Morpho Blue"
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  className={styles.paramInput}
                />
              </div>

              {/* Live Calldata Preview */}
              <div className={styles.calldataPreview}>
                <span className={styles.calldataHeader}>Preview de Ejecución On-Chain:</span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <strong>Target:</strong> <code>{generatedTarget}</code>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <strong>Descripción:</strong> "{generatedDescription}"
                </div>
                <div className={styles.calldataCode}>
                  <strong>Calldata:</strong> {generatedCalldata}
                </div>
              </div>

              {proposalSubmitStatus && (
                <div className={proposalSubmitStatus.includes('Error') ? styles.pqcStatusError : styles.pqcStatusSuccess}>
                  {proposalSubmitStatus}
                </div>
              )}

              {/* Action Button guarded by Anti-Spam */}
              <Button
                variant={canPropose ? 'primary' : 'secondary'}
                size="md"
                disabled={!canPropose || isSubmittingProposal}
                onClick={handleSubmitProposal}
              >
                {isSubmittingProposal
                  ? 'Registrando en Blockchain...'
                  : canPropose
                  ? UI_STRINGS.GOVERNANCE.BTN_SUBMIT_PROPOSAL
                  : `🔒 ${UI_STRINGS.GOVERNANCE.INELIGIBLE_BADGE}`}
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 3: 📊 PARÁMETROS & ESTADO DAO (PROOF OF RESERVES)              */}
        {/* ================================================================== */}
        {activeSubTab === 'metrics' && (
          <div>
            <div className={styles.metricsGrid}>
              <StatCard
                title={UI_STRINGS.METRICS.TOTAL_ASSETS_LABEL}
                value={
                  <span data-testid="admin-total-assets-por">
                    ${totalAssetsVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                }
                variant="blue"
                icon="🏦"
                subtext={UI_STRINGS.GOVERNANCE.COVERAGE_VERIFIED}
              />

              <StatCard
                title={UI_STRINGS.STAKING.METRIC_TOTAL_BURNED}
                value={
                  <span data-testid="admin-deflation-accumulated">
                    {burnedTokensStr} {UI_STRINGS.COMMON.SYMBOL_ALPHA}
                  </span>
                }
                variant="crimson"
                icon="🔥"
                subtext={UI_STRINGS.GOVERNANCE.BURNED_BY_FEES}
              />

              <StatCard
                title={UI_STRINGS.GOVERNANCE.INCOME_MODEL_TITLE}
                value={UI_STRINGS.GOVERNANCE.INCOME_MODEL_DESC}
                variant="emerald"
                icon="📈"
                subtext={UI_STRINGS.GOVERNANCE.INCOME_MODEL_AUTODISTRIB}
              />
            </div>

            <h3 className={styles.sectionHeading}>
              <span>🎯</span>
              <span>
                {UI_STRINGS.GOVERNANCE.SECTION_TARGET_DISTRIB} ({twStables.toFixed(1)} / {twWbtc.toFixed(1)} / {twWeth.toFixed(1)} / {twAlts.toFixed(1)})
              </span>
            </h3>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.thRow}>
                    <th className={styles.thCell}>{UI_STRINGS.METRICS.TH_ASSET}</th>
                    <th className={styles.thCell}>{UI_STRINGS.GOVERNANCE.TH_REAL_USD_VAL}</th>
                    <th className={styles.thCell}>{UI_STRINGS.METRICS.TH_TARGET_WEIGHT}</th>
                    <th className={styles.thCell}>{UI_STRINGS.GOVERNANCE.TH_TREASURY_ROLE}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={styles.trBorder}>
                    <td data-label="Activo" className={styles.tdBold}>💵 {UI_STRINGS.COMMON.SYMBOL_USDC} (Sub-Reserva Exógena)</td>
                    <td data-label="Valoración">${parseFloat(reserveBreakdown?.usdcUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
                    <td data-label="Ponderación Objetivo" className={styles.tdGreen}>{twStables.toFixed(2)}%</td>
                    <td data-label="Rol Fiduciario" className={styles.tdMuted}>{UI_STRINGS.GOVERNANCE.ROLE_MORPHO_P2P}</td>
                  </tr>
                  <tr className={styles.trBorder}>
                    <td data-label="Activo" className={styles.tdBold}>₿ Wrapped Bitcoin ({UI_STRINGS.COMMON.SYMBOL_WBTC})</td>
                    <td data-label="Valoración">${parseFloat(reserveBreakdown?.wbtcUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
                    <td data-label="Ponderación Objetivo" className={styles.tdGreen}>{twWbtc.toFixed(2)}%</td>
                    <td data-label="Rol Fiduciario" className={styles.tdMuted}>{UI_STRINGS.GOVERNANCE.ROLE_DEX_BUYS}</td>
                  </tr>
                  <tr className={styles.trBorder}>
                    <td data-label="Activo" className={styles.tdBold}>Ξ Wrapped Ethereum ({UI_STRINGS.COMMON.SYMBOL_WETH})</td>
                    <td data-label="Valoración">${parseFloat(reserveBreakdown?.wethUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
                    <td data-label="Ponderación Objetivo" className={styles.tdGreen}>{twWeth.toFixed(2)}%</td>
                    <td data-label="Rol Fiduciario" className={styles.tdMuted}>{UI_STRINGS.GOVERNANCE.ROLE_DEX_BUYS}</td>
                  </tr>
                  <tr className={styles.trBorder}>
                    <td data-label="Activo" className={styles.tdBold}>🥩 Native {UI_STRINGS.COMMON.SYMBOL_ALPHA} Staked</td>
                    <td data-label="Valoración">${parseFloat(reserveBreakdown?.stakedAlphaUsd || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
                    <td data-label="Ponderación Objetivo" className={styles.tdGreen}>{twAlts.toFixed(2)}%</td>
                    <td data-label="Rol Fiduciario" className={styles.tdMuted}>{UI_STRINGS.GOVERNANCE.ROLE_AUTO_STAKE}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Protocol Rules Card */}
            <div className={styles.rulesGrid}>
              <div className={styles.ruleItem}>
                <span className={styles.ruleTitle}>🛡️ Anti-Spam Threshold</span>
                <span className={styles.ruleDesc}>
                  Se requiere un mínimo de <strong>{UI_STRINGS.GOVERNANCE.VAL_PROPOSAL_THRESHOLD}</strong> delegados para registrar propuestas formales en la blockchain.
                </span>
              </div>
              <div className={styles.ruleItem}>
                <span className={styles.ruleTitle}>🗳️ Quórum Mandatorio</span>
                <span className={styles.ruleDesc}>
                  Cualquier propuesta debe acumular al menos <strong>{UI_STRINGS.GOVERNANCE.VAL_QUORUM_REQUIRED}</strong> en participación para ser vinculante.
                </span>
              </div>
              <div className={styles.ruleItem}>
                <span className={styles.ruleTitle}>⏱️ Timelock de 72 Horas</span>
                <span className={styles.ruleDesc}>
                  Las propuestas aprobadas deben esperar <strong>{UI_STRINGS.GOVERNANCE.VAL_TIMELOCK_DELAY}</strong> antes de su ejecución para salvaguardar a los usuarios.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 4: 💼 BÓVEDAS DEL PROTOCOLO                                    */}
        {/* ================================================================== */}
        {activeSubTab === 'wallets' && (
          <div>
            <h3 className={styles.sectionHeading}>
              <span>💼</span>
              <span>{UI_STRINGS.GOVERNANCE.SECTION_VAULT_ADDRESSES}</span>
            </h3>

            <div className={styles.vaultStack}>
              <div className={styles.vaultItem}>
                <div className={styles.vaultHeader}>
                  <span className={styles.vaultLabel}>{UI_STRINGS.GOVERNANCE.LABEL_BUNKER_WALLET}</span>
                  <Badge variant="blue" size="sm">Bunker Sub-Reserves</Badge>
                </div>
                <input
                  type="text"
                  readOnly
                  value={CONTRACT_ADDRESSES.TREASURY || '0x...'}
                  className={styles.vaultInput}
                />
              </div>

              <div className={styles.vaultItem}>
                <div className={styles.vaultHeader}>
                  <span className={styles.vaultLabel}>{UI_STRINGS.GOVERNANCE.LABEL_COMMUNITY_YIELD_VAULT}</span>
                  <Badge variant="emerald" size="sm">Community Real Yield</Badge>
                </div>
                <input
                  type="text"
                  readOnly
                  value={CONTRACT_ADDRESSES.COMMUNITY_YIELD_VAULT || '0x...'}
                  className={styles.vaultInput}
                />
              </div>

              <div className={styles.vaultItem}>
                <div className={styles.vaultHeader}>
                  <span className={styles.vaultLabel}>⏱️ CONTRATO TIMELOCK CONTROLLER (ADMIN SOLEMNE PROTOCOLO)</span>
                  <Badge variant="purple" size="sm">72h Safety Delay</Badge>
                </div>
                <input
                  type="text"
                  readOnly
                  value={CONTRACT_ADDRESSES.TIMELOCK || '0x...'}
                  className={styles.vaultInput}
                />
              </div>

              <div className={styles.vaultItem}>
                <div className={styles.vaultHeader}>
                  <span className={styles.vaultLabel}>🏛️ CONTRATO GOVERNOR ALPHA CENTAURI (DAO ON-CHAIN)</span>
                  <Badge variant="blue" size="sm">Bravo-Standard Governor</Badge>
                </div>
                <input
                  type="text"
                  readOnly
                  value={CONTRACT_ADDRESSES.GOVERNOR || '0x...'}
                  className={styles.vaultInput}
                />
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 5: 🛡️ SEGURIDAD & CERTIFICACIÓN POST-CUÁNTICA (PQC W-OTS+)    */}
        {/* ================================================================== */}
        {activeSubTab === 'security' && (
          <div>
            <h3 className={styles.sectionHeading}>
              <span>🛡️</span>
              <span>{UI_STRINGS.GOVERNANCE.SECTION_SECURITY_TITLE}</span>
            </h3>

            <div className={styles.pqcCard} style={{ marginTop: 0 }}>
              <div className={styles.pqcHeader}>
                <h4 className={styles.pqcTitle}>
                  <span>⚛️</span>
                  <span>Blindaje Criptográfico Post-Cuántico (NIST SP 800-208 / W-OTS+)</span>
                </h4>
                <Badge variant="blue" size="sm">
                  Grover-Resistant O(2^128)
                </Badge>
              </div>

              <p className={styles.secDesc}>
                Módulo institucional de resistencia post-cuántica que protege las acciones críticas de gobernanza y tesorería frente a ataques de ordenadores cuánticos (algoritmos de Shor y Grover). Implementa esquemas de firma basados en hash de Winternitz (W-OTS+ w=4, 67 cadenas) verificados directamente por el contrato inteligente <code>PostQuantumGuard.sol</code>.
              </p>

              <div className={styles.pqcInfoGrid}>
                <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>CONTRATO POST-CUÁNTICO:</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-primary)', wordBreak: 'break-all', marginTop: '4px' }}>
                    {CONTRACT_ADDRESSES.POST_QUANTUM_GUARD || '0x...'}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>ESTADO DE COMPROMISO ACTIVO:</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: pqcCommitment ? 'var(--color-emerald-light)' : 'var(--color-amber-light)', wordBreak: 'break-all', marginTop: '4px' }}>
                    {pqcCommitment ? `Raíz On-Chain: ${pqcCommitment.slice(0, 10)}...${pqcCommitment.slice(-8)}` : 'Sin Compromiso Activo en Sesión'}
                  </div>
                </div>
              </div>

              {pqcStatusMsg && (
                <div className={pqcStatusMsg.includes('Error') ? styles.pqcStatusError : styles.pqcStatusSuccess}>
                  {pqcStatusMsg}
                </div>
              )}

              <div className={styles.pqcButtons}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGeneratePqcKeys}
                  disabled={isPqcProcessing}
                >
                  ⚡ Generar Par de Claves Cuánticas W-OTS+
                </Button>

                {pqcKeyPair && (
                  <Button
                    variant="emerald"
                    size="sm"
                    onClick={handleRegisterCommitmentOnChain}
                    disabled={isPqcProcessing}
                  >
                    📝 Registrar Raíz de Compromiso On-Chain
                  </Button>
                )}

                {pqcKeyPair && pqcCommitment && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleTestQuantumVerification}
                    disabled={isPqcProcessing}
                  >
                    🛡️ Certificar Acción con Firma Cuántica
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
