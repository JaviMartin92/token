import { useState, useEffect } from 'react';
import { publicClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { formatEther, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { UserPosition } from '../components/VestedVaults.js';
import type { MarketplaceLoan } from '../components/P2PMarketplace.js';

export function useWeb3State() {
  const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY;
  const USER_KEY = import.meta.env.VITE_USER_KEY;

  const [activeKey, setActiveKey] = useState(ADMIN_KEY);
  console.log("DEBUG: ADMIN_KEY", ADMIN_KEY);
  console.log("DEBUG: activeKey", activeKey);
  const account = privateKeyToAccount(activeKey as `0x${string}`);
  console.log("DEBUG: account", account);

  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');

  const [navValue, setNavValue] = useState('1.00');
  const [targetWeights, setTargetWeights] = useState({ stables: 50, wbtc: 25, weth: 12.5, alts: 12.5 });

  const [usdcBalance, setUsdcBalance] = useState('0.00');
  const [sharesBalance, setSharesBalance] = useState('0.00');
  const [stakedBalance, setStakedBalance] = useState('0.00');
  const [claimableYield, setClaimableYield] = useState('0.00');
  const [userPositions, setUserPositions] = useState<UserPosition[]>([]);
  const [loansList, setLoansList] = useState<MarketplaceLoan[]>([]);

  const [porAssets, setPorAssets] = useState('100,000.00');
  const [porLiabilities, setPorLiabilities] = useState('0.00');
  const [porRatio, setPorRatio] = useState('100.50%');
  const [porBreakdown, setPorBreakdown] = useState({ stables: 5000, wbtc: 2500, weth: 1250, alphaStaking: 1250 });
  const [totalBurnedTokens, setTotalBurnedTokens] = useState('0.00');
  const [circulatingSupply, setCirculatingSupply] = useState('99,500.00');
  const [totalStakedSupply, setTotalStakedSupply] = useState('0.00');
  const [communityStakedSupply, setCommunityStakedSupply] = useState('0.00');
  const [corporateStakedSupply, setCorporateStakedSupply] = useState('0.00');
  const [treasuryStakedSupply, setTreasuryStakedSupply] = useState('0.00');
  const [stakingRatioPct, setStakingRatioPct] = useState('0.00%');
  const [navPerShareUSD, setNavPerShareUSD] = useState('$1.0050 USDC');
  const [navPerShareNum, setNavPerShareNum] = useState(1.005025);

  const [blockDateStr, setBlockDateStr] = useState('');
  const [snapshotId, setSnapshotId] = useState('');
  const [circuitBreakerFrozen, setCircuitBreakerFrozen] = useState(false);

  useEffect(() => {
    setUserAddress(account.address);
    setWalletConnected(true);
  }, [activeKey]);

  useEffect(() => {
    const initSnapshot = async () => {
      try {
        const snap = await (publicClient.request as any)({ method: 'evm_snapshot', params: [] });
        setSnapshotId(snap);
      } catch (e) {}
    };
    initSnapshot();
  }, []);

  const fetchData = async () => {
    try {
      let currentSec = Math.floor(Date.now() / 1000);
      try {
        const currentBlock = await publicClient.getBlock();
        currentSec = Number(currentBlock.timestamp);
        setBlockDateStr(new Date(currentSec * 1000).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'medium' }));
      } catch (e) {}

      let rawBurned = 0n;
      let rawTotalSupply = 0n;
      let rawTotalStaked = 0n;

      try {
        rawBurned = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.TREASURY,
          abi: [{ name: 'totalBurnedTokens', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }] as const,
          functionName: 'totalBurnedTokens'
        }) as bigint;
        setTotalBurnedTokens(parseFloat(formatEther(rawBurned)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }));
      } catch (e) {
        setTotalBurnedTokens('0.00');
      }

      try {
        rawTotalSupply = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.ALPHA_TOKEN,
          abi: ABIS.ERC20,
          functionName: 'totalSupply'
        }) as bigint;
      } catch (e) {}

      try {
        rawTotalStaked = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.STAKING,
          abi: ABIS.STAKING,
          functionName: 'totalStaked'
        }) as bigint;
        setTotalStakedSupply(parseFloat(formatEther(rawTotalStaked)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      } catch (e) {}

      let opExGovStaked = 0n;
      let profitGovStaked = 0n;
      let opExAlphaBal = 0n;
      let profitAlphaBal = 0n;
      try {
        if (CONTRACT_ADDRESSES.CORPORATE_OPEX) {
          opExGovStaked = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.STAKING,
            abi: ABIS.STAKING,
            functionName: 'stakedBalances',
            args: [CONTRACT_ADDRESSES.CORPORATE_OPEX]
          }) as bigint;
          opExAlphaBal = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.ALPHA_TOKEN,
            abi: ABIS.ERC20,
            functionName: 'balanceOf',
            args: [CONTRACT_ADDRESSES.CORPORATE_OPEX]
          }) as bigint;
        }
        if (CONTRACT_ADDRESSES.CORPORATE_PROFIT) {
          profitGovStaked = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.STAKING,
            abi: ABIS.STAKING,
            functionName: 'stakedBalances',
            args: [CONTRACT_ADDRESSES.CORPORATE_PROFIT]
          }) as bigint;
          profitAlphaBal = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.ALPHA_TOKEN,
            abi: ABIS.ERC20,
            functionName: 'balanceOf',
            args: [CONTRACT_ADDRESSES.CORPORATE_PROFIT]
          }) as bigint;
        }
      } catch (e) {}

      let treasuryAlphaBalance = 0n;
      let treasuryStakedInGov = 0n;
      let vaultAlphaBalance = 0n;
      let vaultStakedInGov = 0n;
      try {
        // ALPHA balance held directly in Treasury wallet
        treasuryAlphaBalance = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.ALPHA_TOKEN,
          abi: ABIS.ERC20,
          functionName: 'balanceOf',
          args: [CONTRACT_ADDRESSES.TREASURY]
        }) as bigint;
        // ALPHA sub-reserve held in AlphaVault.sol (12.5% target allocation)
        if (CONTRACT_ADDRESSES.ALPHA_VAULT) {
          vaultAlphaBalance = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.ALPHA_TOKEN,
            abi: ABIS.ERC20,
            functionName: 'balanceOf',
            args: [CONTRACT_ADDRESSES.ALPHA_VAULT]
          }) as bigint;
          vaultStakedInGov = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.STAKING,
            abi: ABIS.STAKING,
            functionName: 'stakedBalances',
            args: [CONTRACT_ADDRESSES.ALPHA_VAULT]
          }) as bigint;
        }
        // Treasury staked in GovernanceStaking
        treasuryStakedInGov = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.STAKING,
          abi: ABIS.STAKING,
          functionName: 'stakedBalances',
          args: [CONTRACT_ADDRESSES.TREASURY]
        }) as bigint;
      } catch (e) {}

      const corporateTotal = opExGovStaked + profitGovStaked + opExAlphaBal + profitAlphaBal;
      const treasuryTotal = treasuryStakedInGov + vaultStakedInGov + treasuryAlphaBalance + vaultAlphaBalance;
      const institutionalGovStaked = opExGovStaked + profitGovStaked + treasuryStakedInGov + vaultStakedInGov;

      // Stake Comunidad = Total Staked inside GovernanceStaking MINUS institutional staked inside contract
      const communityTotal = rawTotalStaked > institutionalGovStaked ? rawTotalStaked - institutionalGovStaked : rawTotalStaked;
      const netCirculating = rawTotalSupply > rawBurned ? rawTotalSupply - rawBurned : 0n;
      setCirculatingSupply(parseFloat(formatEther(netCirculating)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

      const globalLockedTotal = communityTotal + corporateTotal + treasuryTotal;

      setCorporateStakedSupply(parseFloat(formatEther(corporateTotal)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setCommunityStakedSupply(parseFloat(formatEther(communityTotal)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setTreasuryStakedSupply(parseFloat(formatEther(treasuryTotal)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setTotalStakedSupply(parseFloat(formatEther(globalLockedTotal)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

      if (netCirculating > 0n) {
        const ratio = (Number(globalLockedTotal * 10000n / netCirculating) / 100).toFixed(2);
        setStakingRatioPct(`${ratio}%`);
      } else {
        setStakingRatioPct('0.00%');
      }

      try {
        const nav = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.TREASURY,
          abi: ABIS.TREASURY,
          functionName: 'getNAV'
        }) as bigint;
        const navNum = parseFloat(formatEther(nav));
        setNavValue(navNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

        const netCirculatingNum = parseFloat(formatEther(netCirculating));
        if (netCirculatingNum > 0) {
          const navPerShare = (navNum / netCirculatingNum).toFixed(4);
          setNavPerShareUSD(`$${navPerShare} USDC`);
          setNavPerShareNum(navNum / netCirculatingNum);
        } else {
          setNavPerShareUSD('$1.0000 USDC');
          setNavPerShareNum(1.0);
        }
      } catch (e) {}

      try {
        const weights = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.TREASURY,
          abi: ABIS.TREASURY,
          functionName: 'currentWeights'
        }) as readonly [bigint, bigint, bigint, bigint];
        setTargetWeights({
          stables: Number(weights[0]) / 100,
          wbtc: Number(weights[1]) / 100,
          weth: Number(weights[2]) / 100,
          alts: Number(weights[3]) / 100
        });
      } catch (e) {}

      try {
        const isCBFrozen = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.CIRCUIT_BREAKER,
          abi: ABIS.CIRCUIT_BREAKER,
          functionName: 'isFrozen',
          args: [CONTRACT_ADDRESSES.USDC]
        }) as boolean;
        setCircuitBreakerFrozen(isCBFrozen);
      } catch (e) {}

      // 1. Fetch P2P Marketplace Loans
      let fetchedLoans: MarketplaceLoan[] = [];

      try {
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
        setLoansList([...fetchedLoans].reverse()); // Show newest first
      } catch (e) {}

      // 2. Fetch Proof of Reserves (assets, liabilities and collateral ratio come directly from the contract)
      try {
        const res = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.TREASURY,
          abi: [
            { name: 'getProofOfReserves', type: 'function', stateMutability: 'view', inputs: [], outputs: [
              { name: 'totalAssetsUSD', type: 'uint256' },
              { name: 'totalLiabilitiesUSD', type: 'uint256' },
              { name: 'collateralRatioBps', type: 'uint256' }
            ]}
          ] as const,
          functionName: 'getProofOfReserves'
        }) as readonly [bigint, bigint, bigint];

        // Pure real on-chain Assets, Liabilities, and Ratio directly from Treasury.sol
        // FIX #2: Active Treasury loans are tracked separately (shown below PoR as Activos Totales)
        // The NAV from the contract already excludes P2P escrow; we do NOT add loans to assets
        // to avoid double-counting — loans are shown in the separate loans counter below the PoR widget.
        const assetsVal = parseFloat(formatEther(res[0]));
        const liabilitiesVal = parseFloat(formatEther(res[1]));
        const ratioVal = liabilitiesVal > 0 ? (assetsVal / liabilitiesVal) * 100 : 100.0;

        setPorAssets(assetsVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        setPorLiabilities(liabilitiesVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        setPorRatio(`${ratioVal.toFixed(2)}%`);

        try {
          const breakdown = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.TREASURY,
            abi: [
              { name: 'getAssetBreakdown', type: 'function', stateMutability: 'view', inputs: [], outputs: [
                { name: 'stablesBal', type: 'uint256' },
                { name: 'wbtcBal', type: 'uint256' },
                { name: 'wethBal', type: 'uint256' },
                { name: 'alphaStakingBal', type: 'uint256' }
              ]}
            ] as const,
            functionName: 'getAssetBreakdown'
          }) as readonly [bigint, bigint, bigint, bigint];

          const bStables = parseFloat(formatEther(breakdown[0]));
          const bWbtc = parseFloat(formatEther(breakdown[1]));
          const bWeth = parseFloat(formatEther(breakdown[2]));
          const bAlphaLoan = parseFloat(formatEther(breakdown[3]));

          if (bStables > 0 || bWbtc > 0 || bWeth > 0 || bAlphaLoan > 0) {
            setPorBreakdown({ stables: bStables, wbtc: bWbtc, weth: bWeth, alphaStaking: bAlphaLoan });
          } else {
            // Target Multi-Asset Portfolio Allocation (50% USDC, 25% WBTC, 12.5% WETH, 12.5% Loans)
            setPorBreakdown({ stables: 0, wbtc: 0, weth: 0, alphaStaking: 0 });
          }
        } catch (e) {
          setPorBreakdown({ stables: 0, wbtc: 0, weth: 0, alphaStaking: 0 });
        }
      } catch (e) {}

      if (userAddress) {
        try {
          const usdc = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.USDC,
            abi: ABIS.ERC20,
            functionName: 'balanceOf',
            args: [userAddress as `0x${string}`]
          }) as bigint;
          setUsdcBalance(parseFloat(formatUnits(usdc, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

        } catch (e) {}

        try {
          const shares = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.ALPHA_TOKEN,
            abi: ABIS.ERC20,
            functionName: 'balanceOf',
            args: [userAddress as `0x${string}`]
          }) as bigint;
          setSharesBalance(parseFloat(formatEther(shares)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        } catch (e) {}

        try {
          const staked = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.STAKING,
            abi: ABIS.STAKING,
            functionName: 'stakedBalances',
            args: [userAddress as `0x${string}`]
          }) as bigint;
          setStakedBalance(parseFloat(formatEther(staked)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

          const earnedYield = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.STAKING,
            abi: ABIS.STAKING,
            functionName: 'earned',
            args: [userAddress as `0x${string}`]
          }) as bigint;
          setClaimableYield(parseFloat(formatUnits(earnedYield, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        } catch (e) {}

        try {
          const posList: UserPosition[] = [];
          for (let i = 1; i <= 20; i++) {
            try {
              const nftOwner = await publicClient.readContract({
                address: CONTRACT_ADDRESSES.POSITION_NFT,
                abi: [{ name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] }] as const,
                functionName: 'ownerOf',
                args: [BigInt(i)]
              }) as string;

              if (nftOwner.toLowerCase() === userAddress.toLowerCase()) {
                const pos = await publicClient.readContract({
                  address: CONTRACT_ADDRESSES.POSITION_NFT,
                  abi: ABIS.POSITION_NFT,
                  functionName: 'getPosition',
                  args: [BigInt(i)]
                }) as any;

                const expSec = Number(pos[5]);
                const isExpired = currentSec >= expSec;
                posList.push({
                  id: i,
                  principal: parseFloat(formatUnits(pos[2], 6)).toLocaleString('en-US', { maximumFractionDigits: 2 }),
                  paid: parseFloat(formatUnits(pos[3], 6)).toLocaleString('en-US', { maximumFractionDigits: 2 }),
                  expirationTimestamp: expSec,
                  expDateStr: new Date(expSec * 1000).toLocaleDateString('es-ES'),
                  lockYears: pos[6].toString(),
                  isRagequitted: pos[7],
                  isMaturedClaimed: pos[8],
                  canClaim: isExpired && !pos[7] && !pos[8]
                });
              }
            } catch (e) {
              if (i > 1) break;
            }
          }
          setUserPositions(posList);
        } catch (e) {}
      }
    } catch (error) {
      console.error('Error polling smart contracts:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [userAddress, activeKey]);

  return {
    ADMIN_KEY,
    USER_KEY,
    activeKey,
    setActiveKey,
    account,
    walletConnected,
    userAddress,
    navValue,
    targetWeights,
    usdcBalance,
    sharesBalance,
    stakedBalance,
    claimableYield,
    userPositions,
    loansList,
    porAssets,
    porLiabilities,
    porRatio,
    porBreakdown,
    totalBurnedTokens,
    circulatingSupply,
    totalStakedSupply,
    communityStakedSupply,
    corporateStakedSupply,
    treasuryStakedSupply,
    stakingRatioPct,
    navPerShareUSD,
    navPerShareNum,
    blockDateStr,
    snapshotId,
    setSnapshotId,
    circuitBreakerFrozen,
    fetchData
  };
}
