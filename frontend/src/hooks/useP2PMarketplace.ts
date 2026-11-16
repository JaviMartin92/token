import { useQuery } from '@tanstack/react-query';
import { publicClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { formatUnits } from 'viem';
import type { MarketplaceLoan } from '../components/P2PMarketplace.js';

export interface TreasuryCreditStats {
  maxTotalDebtUSD: number;
  currentTotalDebtUSD: number;
  availableCapacityUSD: number;
  circularCapBps: number;
  circularDebtUSD: number;
  circularCapacityUSD: number;
}

export function useP2PMarketplace(refetchInterval = 3000) {
  const { data: treasuryCreditStats = {
    maxTotalDebtUSD: 7634.25,
    currentTotalDebtUSD: 0,
    availableCapacityUSD: 7634.25,
    circularCapBps: 4500,
    circularDebtUSD: 0,
    circularCapacityUSD: 3435.41
  } } = useQuery<TreasuryCreditStats>({
    queryKey: ['treasuryCreditStats'],
    queryFn: async () => {
      try {
        const [limits, capBps, circDebt] = await Promise.all([
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.TREASURY,
            abi: ABIS.TREASURY,
            functionName: 'treasuryLoanLimits'
          }) as Promise<[bigint, bigint, bigint]>,
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.P2P_MARKET,
            abi: ABIS.P2P_MARKET,
            functionName: 'circularCollateralCapBps'
          }) as Promise<bigint>,
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.P2P_MARKET,
            abi: ABIS.P2P_MARKET,
            functionName: 'treasuryCircularDebtUSD'
          }) as Promise<bigint>
        ]);

        const maxTotalDebt = limits ? BigInt((limits as any).maxTotalDebt ?? limits[0]) : 0n;
        const currentTotalDebt = limits ? BigInt((limits as any).currentTotalDebt ?? limits[1]) : 0n;
        const availableCapacity = limits ? BigInt((limits as any).availableCapacity ?? limits[2]) : 0n;
        const circularCapBps = Number(capBps || 4500n);
        const circularDebt = BigInt(circDebt || 0n);

        const circularLimit = (maxTotalDebt * BigInt(circularCapBps)) / 10000n;
        const circularCapacity = circularLimit > circularDebt ? circularLimit - circularDebt : 0n;

        return {
          maxTotalDebtUSD: parseFloat(formatUnits(maxTotalDebt, 6)),
          currentTotalDebtUSD: parseFloat(formatUnits(currentTotalDebt, 6)),
          availableCapacityUSD: parseFloat(formatUnits(availableCapacity, 6)),
          circularCapBps,
          circularDebtUSD: parseFloat(formatUnits(circularDebt, 6)),
          circularCapacityUSD: parseFloat(formatUnits(circularCapacity, 6))
        };
      } catch (e) {
        return {
          maxTotalDebtUSD: 7634.25,
          currentTotalDebtUSD: 0,
          availableCapacityUSD: 7634.25,
          circularCapBps: 4500,
          circularDebtUSD: 0,
          circularCapacityUSD: 3435.41
        };
      }
    },
    refetchInterval
  });

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
            let numCollateralVal = 0;
            let colSymbol = 'NFT';

            if (posTokenId > 0n) {
              try {
                const pos = await publicClient.readContract({
                  address: CONTRACT_ADDRESSES.POSITION_NFT,
                  abi: ABIS.POSITION_NFT,
                  functionName: 'getPosition',
                  args: [posTokenId]
                }) as any;
                const principalWei = pos.principalAmount ?? (Array.isArray(pos) ? pos[7] : 0n);
                const paidWei = pos.discountedPricePaid ?? (Array.isArray(pos) ? pos[8] : 0n);
                const principalVal = parseFloat(formatUnits(BigInt(principalWei), 6));
                const paidVal = parseFloat(formatUnits(BigInt(paidWei), 6));
                numCollateralVal = paidVal > 0 ? paidVal : (principalVal > 0 ? principalVal : 0);
              } catch (e) {
                numCollateralVal = 0;
              }
              colSymbol = `NFT #${posTokenId}`;
            } else if (collateralAmt > 0n) {
              let dec = 18;
              colSymbol = 'VIRAJE';
              try {
                const assetAddr = await publicClient.readContract({
                  address: CONTRACT_ADDRESSES.P2P_MARKET,
                  abi: ABIS.P2P_MARKET,
                  functionName: 'loanCollateralAsset',
                  args: [BigInt(i)]
                }) as string;
                if (assetAddr && assetAddr.toLowerCase() === CONTRACT_ADDRESSES.USDC.toLowerCase()) {
                  colSymbol = 'USDC';
                  dec = 6;
                } else if (assetAddr && assetAddr.toLowerCase() === CONTRACT_ADDRESSES.WBTC.toLowerCase()) {
                  colSymbol = 'WBTC';
                  dec = 8;
                } else if (assetAddr && assetAddr.toLowerCase() === CONTRACT_ADDRESSES.WETH.toLowerCase()) {
                  colSymbol = 'WETH';
                  dec = 18;
                } else {
                  colSymbol = 'VIRAJE';
                  dec = 18;
                }
              } catch (e) {}
              numCollateralVal = parseFloat(formatUnits(collateralAmt, dec));
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
                hFactor = `${Number(hfRatio)}%`;
              } catch (e) {}
            }

            const apr = (interestBps / 100).toFixed(2);

            fetchedLoans.push({
              id: Number(loanId),
              lender: lender as string,
              borrower: borrower as string,
              positionTokenId: Number(posTokenId),
              borrowAmount: numBorrowVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              collateralAmount: numCollateralVal.toLocaleString('en-US', { minimumFractionDigits: colSymbol === 'WBTC' ? 4 : colSymbol === 'WETH' ? 4 : 2, maximumFractionDigits: colSymbol === 'WBTC' ? 6 : colSymbol === 'WETH' ? 4 : 2 }),
              collateralSymbol: colSymbol,
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

  return { loansList, treasuryCreditStats };
}
