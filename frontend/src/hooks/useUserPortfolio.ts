import { useQuery } from '@tanstack/react-query';
import { publicClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { formatEther, formatUnits } from 'viem';
import type { UserPosition } from '../components/VestedVaults.js';

export function useUserPortfolio(userAddress: string | undefined, refetchInterval = 3000) {
  
  const { data: portfolio = { usdcBalance: '0.00', sharesBalance: '0.00', stakedBalance: '0.00', claimableYield: '0.00', userPositions: [] as UserPosition[] } } = useQuery({
    queryKey: ['userPortfolio', userAddress],
    queryFn: async () => {
      if (!userAddress) return { usdcBalance: '0.00', sharesBalance: '0.00', stakedBalance: '0.00', claimableYield: '0.00', userPositions: [] };

      const targetAddr = userAddress as `0x${string}`;
      
      let usdcBalance = '0.00';
      let sharesBalance = '0.00';
      let stakedBalance = '0.00';
      let claimableYield = '0.00';
      const userPositions: UserPosition[] = [];

      try {
        const usdc = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.USDC,
          abi: ABIS.ERC20,
          functionName: 'balanceOf',
          args: [targetAddr]
        }) as bigint;
        usdcBalance = parseFloat(formatUnits(usdc, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } catch (e) {}

      try {
        const shares = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.ALPHA_TOKEN,
          abi: ABIS.ERC20,
          functionName: 'balanceOf',
          args: [targetAddr]
        }) as bigint;
        sharesBalance = parseFloat(formatEther(shares)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } catch (e) {}

      try {
        const staked = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.STAKING,
          abi: ABIS.STAKING,
          functionName: 'stakedBalances',
          args: [targetAddr]
        }) as bigint;
        stakedBalance = parseFloat(formatEther(staked)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const earnedYield = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.STAKING,
          abi: ABIS.STAKING,
          functionName: 'earned',
          args: [targetAddr]
        }) as bigint;
        claimableYield = parseFloat(formatUnits(earnedYield, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } catch (e) {}

      try {
        const currentBlock = await publicClient.getBlock();
        const currentSec = Number(currentBlock.timestamp);

        let maxTokens = 50;
        try {
          const nextTokenId = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.POSITION_NFT,
            abi: ABIS.POSITION_NFT,
            functionName: 'nextTokenId'
          }) as bigint;
          maxTokens = Number(nextTokenId);
        } catch (e) {}

        for (let i = 1; i < maxTokens; i++) {
          try {
            const nftOwner = await publicClient.readContract({
              address: CONTRACT_ADDRESSES.POSITION_NFT,
              abi: [{ name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] }] as const,
              functionName: 'ownerOf',
              args: [BigInt(i)]
            }) as string;

            if (nftOwner.toLowerCase() === targetAddr.toLowerCase()) {
              const pos = await publicClient.readContract({
                address: CONTRACT_ADDRESSES.POSITION_NFT,
                abi: ABIS.POSITION_NFT,
                functionName: 'getPosition',
                args: [BigInt(i)]
              }) as any;

              const principalWei = pos.principalAmount ?? (Array.isArray(pos) ? pos[7] : 0n);
              const paidWei = pos.discountedPricePaid ?? (Array.isArray(pos) ? pos[8] : 0n);
              const expSec = Number(pos.expirationTimestamp ?? (Array.isArray(pos) ? pos[4] : 0));
              const lockYearsVal = (pos.lockYears ?? (Array.isArray(pos) ? pos[3] : 1)).toString();
              const isRagequitted = Boolean(pos.isRagequitted ?? (Array.isArray(pos) ? pos[5] : false));
              const isMaturedClaimed = Boolean(pos.isMaturedClaimed ?? (Array.isArray(pos) ? pos[6] : false));

              const isExpired = currentSec >= expSec;
              userPositions.push({
                id: i,
                principal: parseFloat(formatUnits(BigInt(principalWei), 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                paid: parseFloat(formatUnits(BigInt(paidWei), 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                expirationTimestamp: expSec,
                expDateStr: new Date(expSec * 1000).toLocaleDateString('es-ES'),
                lockYears: lockYearsVal,
                isRagequitted,
                isMaturedClaimed,
                canClaim: isExpired && !isRagequitted && !isMaturedClaimed
              });
            }
          } catch (e) {
            // Token may have been burned or does not exist
          }
        }
      } catch (e) {}

      return {
        usdcBalance,
        sharesBalance,
        stakedBalance,
        claimableYield,
        userPositions
      };
    },
    refetchInterval
  });

  return portfolio;
}
