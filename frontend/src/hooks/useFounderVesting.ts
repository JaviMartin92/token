import { useQuery } from '@tanstack/react-query';
import { publicClient, getWalletClient, getFreshNonce, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { formatEther } from 'viem';
import { parseWeb3Error } from '../utils/web3ErrorDecoder.js';

export function useFounderVesting(userAddress?: string, addLog?: (msg: string) => void, addToast?: (type: any, title: string, msg: string) => void, refetchInterval = 4000) {
  const vestingAddress = (CONTRACT_ADDRESSES as any).FOUNDER_VESTING_VAULT;

  const { data: vestingData = {
    totalAllocation: '100,000.00',
    totalClaimed: '0.00',
    remainingAllocation: '100,000.00',
    beneficiary: '',
    claimableAlpha: '0.00',
    claimableAlphaNum: 0,
    surplusUSD: '0.00',
    surplusUSDNum: 0,
    canClaim: false,
    nextAvailableDate: '',
    isBeneficiary: false,
    cooldownRemainingSec: 0
  }, refetch } = useQuery({
    queryKey: ['founderVesting', vestingAddress, userAddress],
    queryFn: async () => {
      if (!vestingAddress || vestingAddress === '0x0000000000000000000000000000000000000000') {
        return {
          totalAllocation: '100,000.00',
          totalClaimed: '0.00',
          remainingAllocation: '100,000.00',
          beneficiary: '',
          claimableAlpha: '0.00',
          claimableAlphaNum: 0,
          surplusUSD: '0.00',
          surplusUSDNum: 0,
          canClaim: false,
          nextAvailableDate: '',
          isBeneficiary: false,
          cooldownRemainingSec: 0
        };
      }

      try {
        const [claimedRaw, remainingRaw, beneficiaryRaw, infoRaw] = await Promise.all([
          publicClient.readContract({
            address: vestingAddress,
            abi: ABIS.FOUNDER_VESTING,
            functionName: 'totalClaimed'
          }),
          publicClient.readContract({
            address: vestingAddress,
            abi: ABIS.FOUNDER_VESTING,
            functionName: 'remainingAllocation'
          }),
          publicClient.readContract({
            address: vestingAddress,
            abi: ABIS.FOUNDER_VESTING,
            functionName: 'beneficiary'
          }),
          publicClient.readContract({
            address: vestingAddress,
            abi: ABIS.FOUNDER_VESTING,
            functionName: 'getClaimableInfo'
          })
        ]);

        const [claimableAlphaRaw, surplusUSDRaw, nextTsRaw, canClaim] = infoRaw as [bigint, bigint, bigint, boolean];
        const claimableNum = parseFloat(formatEther(claimableAlphaRaw));
        const surplusNum = parseFloat(formatEther(surplusUSDRaw));
        const claimedNum = parseFloat(formatEther(claimedRaw as bigint));
        const remainingNum = parseFloat(formatEther(remainingRaw as bigint));

        const nextSec = Number(nextTsRaw);
        const nowSec = Math.floor(Date.now() / 1000);
        const cooldownRemainingSec = Math.max(0, nextSec - nowSec);

        const nextDateStr = nextSec > 0 ? new Date(nextSec * 1000).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Inmediato';
        const isBen = userAddress ? userAddress.toLowerCase() === (beneficiaryRaw as string).toLowerCase() : false;

        return {
          totalAllocation: '100,000.00',
          totalClaimed: claimedNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          remainingAllocation: remainingNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          beneficiary: beneficiaryRaw as string,
          claimableAlpha: claimableNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          claimableAlphaNum: claimableNum,
          surplusUSD: surplusNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          surplusUSDNum: surplusNum,
          canClaim,
          nextAvailableDate: nextDateStr,
          isBeneficiary: isBen,
          cooldownRemainingSec
        };
      } catch {
        return {
          totalAllocation: '100,000.00',
          totalClaimed: '0.00',
          remainingAllocation: '100,000.00',
          beneficiary: '',
          claimableAlpha: '0.00',
          claimableAlphaNum: 0,
          surplusUSD: '0.00',
          surplusUSDNum: 0,
          canClaim: false,
          nextAvailableDate: '',
          isBeneficiary: false,
          cooldownRemainingSec: 0
        };
      }
    },
    refetchInterval
  });

  const executeClaim = async () => {
    if (!vestingAddress) return;
    try {
      if (addLog) addLog('Iniciando reclamo de asignación de reservas de Fundador...');
      if (addToast) addToast('info', 'Reclamo Fundador', 'Enviando transacción de liberación...');

      const client = getWalletClient(userAddress);
      const addresses = await client.getAddresses();
      const account = (userAddress && userAddress.startsWith('0x') ? userAddress as `0x${string}` : addresses[0]);
      const nonce = await getFreshNonce(account);

      const tx = await client.writeContract({
        address: vestingAddress,
        abi: ABIS.FOUNDER_VESTING,
        functionName: 'claimVestedAlpha',
        account,
        ...(nonce !== undefined ? { nonce } : {})
      });

      await publicClient.waitForTransactionReceipt({ hash: tx });
      if (addLog) addLog('Reclamo de ALPHA completado con éxito.');
      if (addToast) addToast('success', 'Éxito Reclamo', 'ALPHA transferido a tu billetera.');
      await refetch();
    } catch (err: any) {
      const parsedErr = parseWeb3Error(err);
      if (addLog) addLog(`[Error] Reclamo falló: ${parsedErr}`);
      if (addToast) addToast('error', 'Error Reclamo', parsedErr);
    }
  };

  return {
    ...vestingData,
    executeClaim,
    refetch
  };
}
