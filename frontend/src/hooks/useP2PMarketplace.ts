import { useQuery } from '@tanstack/react-query';
import { publicClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { formatUnits } from 'viem';
import type { MarketplaceLoan } from '../components/P2PMarketplace.js';

export function useP2PMarketplace(refetchInterval = 3000) {
  const { data: loansList = [] } = useQuery({
    queryKey: ['p2pLoansList'],
    queryFn: async () => {
      let fetchedLoans: MarketplaceLoan[] = [];
      const nextId = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.P2P_MARKET,
        abi: ABIS.P2P_MARKET,
        functionName: 'nextLoanId'
      }) as bigint;

      const maxId = Number(nextId);

      for (let i = 1; i < maxId; i++) {
        try {
          const raw = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.P2P_MARKET,
            abi: ABIS.P2P_MARKET,
            functionName: 'loans',
            args: [BigInt(i)]
          }) as any;

          if (raw) {
            const loanId = Array.isArray(raw) ? BigInt(raw[0]) : BigInt(raw.id || i);
            const lender = Array.isArray(raw) ? raw[1] : raw.lender;
            const borrower = Array.isArray(raw) ? raw[2] : raw.borrower;
            const posTokenId = Array.isArray(raw) ? BigInt(raw[3]) : BigInt(raw.positionTokenId);
            const borrowAmt = Array.isArray(raw) ? BigInt(raw[4]) : BigInt(raw.borrowAmount);
            const collateralAmt = Array.isArray(raw) ? BigInt(raw[5]) : BigInt(raw.collateralAmount);
            const interestBps = Array.isArray(raw) ? Number(raw[6]) : Number(raw.interestRateBps);
            const durationDays = Array.isArray(raw) ? Number(raw[7]) : Number(raw.durationDays);
            const startTime = Array.isArray(raw) ? Number(raw[8]) : Number(raw.startTime);
            const state = Array.isArray(raw) ? Number(raw[9]) : Number(raw.state);

            const numBorrowVal = parseFloat(formatUnits(borrowAmt, 6));
            let numCollateralVal = parseFloat(formatUnits(collateralAmt, 6));

            if (numCollateralVal === 0 && posTokenId > 0n) {
              try {
                const pos = await publicClient.readContract({
                  address: CONTRACT_ADDRESSES.POSITION_NFT,
                  abi: ABIS.POSITION_NFT,
                  functionName: 'getPosition',
                  args: [posTokenId]
                }) as any;
                const principalVal = parseFloat(formatUnits(pos[2], 6));
                const paidVal = parseFloat(formatUnits(pos[3], 6));
                numCollateralVal = principalVal > 0 ? principalVal : (paidVal > 0 ? paidVal : 0);
              } catch (e) {
                numCollateralVal = 0;
              }
            }

            let hFactor = 'N/A';
            if (state === 1) {
              try {
                const hfRatio = await publicClient.readContract({
                  address: CONTRACT_ADDRESSES.P2P_MARKET,
                  abi: ABIS.P2P_MARKET,
                  functionName: 'calculateHealthFactor',
                  args: [BigInt(i)]
                }) as bigint;
                hFactor = `${(Number(hfRatio) / 10).toFixed(1)}%`;
              } catch (e) {}
            }

            const apr = (interestBps / 100).toFixed(2);

            fetchedLoans.push({
              id: Number(loanId),
              lender: lender as string,
              borrower: borrower as string,
              positionTokenId: Number(posTokenId),
              borrowAmount: numBorrowVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              collateralAmount: numCollateralVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              interestRateBps: interestBps,
              interestRateApr: apr,
              durationDays: durationDays,
              startTime: startTime,
              state: state,
              healthFactor: hFactor
            });
          }
        } catch (e) {}
      }
      return [...fetchedLoans].reverse();
    },
    refetchInterval
  });

  return { loansList };
}
