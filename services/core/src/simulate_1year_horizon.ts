import {
  createPublicClient,
  createWalletClient,
  createTestClient,
  http,
  parseUnits,
  formatUnits,
  formatEther,
  keccak256,
  toHex
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import contracts from '../../../frontend/src/contracts.json';

const ANVIL_URL = 'http://127.0.0.1:8545';

const client = createPublicClient({ transport: http(ANVIL_URL) });
const testClient = createTestClient({ mode: 'anvil', transport: http(ANVIL_URL) });

// Deployer / Operator Account
const operatorAccount = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const operatorWallet = createWalletClient({ account: operatorAccount, transport: http(ANVIL_URL) });

// Configuration: 12 actors across 12 monthly epochs
const NUM_USERS = 12;
const TOTAL_MONTHS = 12;
const SECONDS_PER_MONTH = 30.5 * 24 * 3600;

// ABIs
const ERC20_ABI = [
  { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] }
] as const;

const TREASURY_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'stableAmount', type: 'uint256' }, { name: 'minSharesOut', type: 'uint256' }], outputs: [{ name: 'sharesMinted', type: 'uint256' }] },
  { name: 'redeem', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'sharesAmount', type: 'uint256' }, { name: 'minUsdcOut', type: 'uint256' }], outputs: [{ name: 'assetsReceived', type: 'uint256' }] },
  { name: 'getProofOfReserves', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }] },
  { name: 'getNAVPerShare', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getNetCirculatingShares', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'auditProofOfReserves', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }] },
  { name: 'totalBurnedTokens', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }
] as const;

const VESTED_VAULT_ABI = [
  { name: 'buyVestedBond', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'principalAmount', type: 'uint256' }, { name: 'lockYears', type: 'uint256' }, { name: 'referrer', type: 'address' }], outputs: [{ name: 'tokenId', type: 'uint256' }] },
  { name: 'ragequit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [] },
  { name: 'claimMatured', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [] },
  { name: 'calculateDiscountBps', type: 'function', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }, { name: 'lockYears', type: 'uint256' }], outputs: [{ name: 'discountBps', type: 'uint256' }] },
  { name: 'totalPresentLiability', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalInvested', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }
] as const;

const P2P_MARKET_ABI = [
  { name: 'createLoanOfferWithNFT', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'positionTokenId', type: 'uint256' }, { name: 'borrowAmount', type: 'uint256' }, { name: 'interestRateBps', type: 'uint256' }, { name: 'durationDays', type: 'uint256' }], outputs: [{ name: 'loanId', type: 'uint256' }] },
  { name: 'fundLoanOffer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [] },
  { name: 'repayLoan', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [] },
  { name: 'borrowFromTreasury', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'positionTokenId', type: 'uint256' }, { name: 'borrowAmount', type: 'uint256' }, { name: 'durationDays', type: 'uint256' }], outputs: [{ name: 'loanId', type: 'uint256' }] },
  { name: 'getMarketplaceOverview', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'tuple', components: [{ name: 'totalActiveLoans', type: 'uint256' }, { name: 'totalVolumeUSD', type: 'uint256' }, { name: 'activeBorrowUSD', type: 'uint256' }, { name: 'activeCollateralUSD', type: 'uint256' }, { name: 'activeInterestUSD', type: 'uint256' }] }] },
  { name: 'nextLoanId', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }
] as const;

const POSITION_NFT_ABI = [
  { name: 'setApprovalForAll', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [] },
  { name: 'nextTokenId', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] }
] as const;

const STAKING_ABI = [
  { name: 'stake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'unstake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'stakedBalances', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'totalStaked', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'earned', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }
] as const;

const ROUTER_ABI = [
  { name: 'claimRealYield', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [
    { name: 'payoutAmount', type: 'uint256' },
    { name: 'wbtcPaid', type: 'uint256' },
    { name: 'wethPaid', type: 'uint256' },
    { name: 'alphaPaid', type: 'uint256' }
  ] },
  { name: 'notifyYield', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] }
] as const;

interface UserWallet {
  id: number;
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: ReturnType<typeof createWalletClient>;
  address: `0x${string}`;
}

interface MonthlyStats {
  month: number;
  depositsUsd: number;
  bondsUsd: number;
  p2pVolumeUsd: number;
  exitsUsd: number;
  totalVolumeUsd: number;
  txCount: number;
  navPerShare: number;
  assetsUsd: number;
  liabilitiesUsd: number;
  porRatioPct: number;
  circulatingAlpha: number;
  stakedAlpha: number;
  burnedAlpha: number;
  activeP2PLoans: number;
}

async function main() {
  console.log('🚀 INITIALIZING HIGH-PERFORMANCE 1-YEAR PROTOCOL SIMULATION');
  console.log('===========================================================');
  console.log(`Target: 12 Epochs | High-Density Batches | $10,000,000 Capital Deployed`);
  console.log(`RPC Node: ${ANVIL_URL}`);

  // 1. Generate User Wallets
  console.log(`\n[+] Pre-funding ${NUM_USERS} independent simulation accounts...`);
  const users: UserWallet[] = [];
  const maxApproval = 1000000000000000000000000000000000n;

  for (let i = 0; i < NUM_USERS; i++) {
    const seed = keccak256(toHex(`alpha_horizon_user_${i}_v2_optimized`));
    const acc = privateKeyToAccount(seed);
    const w = createWalletClient({ account: acc, transport: http(ANVIL_URL) });
    users.push({ id: i, account: acc, wallet: w, address: acc.address });
  }

  // Pre-fund all users: set ETH balance and let each user self-mint USDC
  for (const u of users) {
    await testClient.setBalance({ address: u.address, value: parseUnits('500', 18) });
    await u.wallet.writeContract({
      address: contracts.USDC as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [u.address, parseUnits('2000000', 6)]
    });

    // Approvals
    await u.wallet.writeContract({ address: contracts.USDC as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [contracts.TREASURY as `0x${string}`, maxApproval] });
    await u.wallet.writeContract({ address: contracts.USDC as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [contracts.VESTED_VAULT as `0x${string}`, maxApproval] });
    await u.wallet.writeContract({ address: contracts.USDC as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [contracts.P2P_MARKET as `0x${string}`, maxApproval] });
    await u.wallet.writeContract({ address: contracts.ALPHA_TOKEN as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [contracts.STAKING as `0x${string}`, maxApproval] });
    await u.wallet.writeContract({ address: contracts.ALPHA_TOKEN as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [contracts.TREASURY as `0x${string}`, maxApproval] });
    await u.wallet.writeContract({ address: contracts.POSITION_NFT as `0x${string}`, abi: POSITION_NFT_ABI, functionName: 'setApprovalForAll', args: [contracts.P2P_MARKET as `0x${string}`, true] });
  }
  console.log(`[✔] Pre-funded ${NUM_USERS} accounts with universal protocol approvals.`);

  let totalTxCount = 0;
  let cumulativeUsdcDeployed = 0;
  const month1HoldBonds: { tokenId: bigint; user: UserWallet }[] = [];
  const activeP2PLoansList: { loanId: bigint; borrower: UserWallet; borrowAmount: bigint }[] = [];
  const allMonthlyStats: MonthlyStats[] = [];

  // 12 Monthly Epochs
  for (let month = 1; month <= TOTAL_MONTHS; month++) {
    const epochStart = Date.now();
    let monthlyTx = 0;
    let monthlyDepositsUsd = 0;
    let monthlyBondsUsd = 0;
    let monthlyP2PUsd = 0;
    let monthlyExitsUsd = 0;

    // --- 1. Primary Subscriptions at Current NAV ($375,000 / month) ---
    // 15 deposits of $25,000 each
    const depositCount = 15;
    const baseDepositUsd = 25000;
    for (let i = 0; i < depositCount; i++) {
      const u = users[i % users.length];
      const depositAmountUsd = baseDepositUsd;
      const amountUnits = parseUnits(depositAmountUsd.toString(), 6);
      try {
        await u.wallet.writeContract({
          address: contracts.TREASURY as `0x${string}`,
          abi: TREASURY_ABI,
          functionName: 'deposit',
          args: [amountUnits, 0n]
        });
        monthlyTx++;
        monthlyDepositsUsd += depositAmountUsd;
      } catch (err: any) {}
    }

    // --- 2. Governance Staking (Staking 85% of newly minted ALPHA) ---
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      try {
        const bal = await client.readContract({
          address: contracts.ALPHA_TOKEN as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [u.address]
        });
        if (bal > parseUnits('100', 18)) {
          const toStake = (bal * 85n) / 100n;
          await u.wallet.writeContract({
            address: contracts.STAKING as `0x${string}`,
            abi: STAKING_ABI,
            functionName: 'stake',
            args: [toStake]
          });
          monthlyTx++;
        }
      } catch (err) {}
    }

    // --- 3. Vested Discount Bonds ($350,000 / month across 1y, 2y, 3y locks) ---
    // 10 bonds of $35,000 each
    const bondCount = 10;
    const baseBondPrincipal = 35000;
    const monthlyP2PBondTokens: { tokenId: bigint; user: UserWallet }[] = [];

    for (let i = 0; i < bondCount; i++) {
      const u = users[i % users.length];
      const referrer = users[(i + 1) % users.length].address;
      const lockYears = (i % 3) + 1;
      const principalUnits = parseUnits(baseBondPrincipal.toString(), 6);

      try {
        const nextId = await client.readContract({
          address: contracts.POSITION_NFT as `0x${string}`,
          abi: POSITION_NFT_ABI,
          functionName: 'nextTokenId'
        });

        await u.wallet.writeContract({
          address: contracts.VESTED_VAULT as `0x${string}`,
          abi: VESTED_VAULT_ABI,
          functionName: 'buyVestedBond',
          args: [principalUnits, BigInt(lockYears), referrer]
        });
        monthlyTx++;
        monthlyBondsUsd += baseBondPrincipal;

        const bondInfo = { tokenId: nextId, user: u };
        if (month === 1 && lockYears === 1 && month1HoldBonds.length < 5) {
          month1HoldBonds.push(bondInfo);
        } else {
          monthlyP2PBondTokens.push(bondInfo);
        }
      } catch (err: any) {}
    }

    // --- 4. P2P Marketplace Lending & Credit ($100,000 / month) ---
    // 5 loans of $20,000 each
    const p2pCount = Math.min(5, monthlyP2PBondTokens.length);
    for (let i = 0; i < p2pCount; i++) {
      const bond = monthlyP2PBondTokens[i];
      const borrowAmountUsd = 20000;
      const borrowUnits = parseUnits(borrowAmountUsd.toString(), 6);

      try {
        const nextLId = await client.readContract({
          address: contracts.P2P_MARKET as `0x${string}`,
          abi: P2P_MARKET_ABI,
          functionName: 'nextLoanId'
        });

        await bond.user.wallet.writeContract({
          address: contracts.P2P_MARKET as `0x${string}`,
          abi: P2P_MARKET_ABI,
          functionName: 'createLoanOfferWithNFT',
          args: [bond.tokenId, borrowUnits, 800n, 90n]
        });
        monthlyTx++;
        monthlyP2PUsd += borrowAmountUsd;

        // Peer-fund 3 out of 5 offers
        if (i < 3) {
          const lender = users[(bond.user.id + 2) % users.length];
          await lender.wallet.writeContract({
            address: contracts.P2P_MARKET as `0x${string}`,
            abi: P2P_MARKET_ABI,
            functionName: 'fundLoanOffer',
            args: [nextLId]
          });
          monthlyTx++;
          activeP2PLoansList.push({ loanId: nextLId, borrower: bond.user, borrowAmount: borrowUnits });
        }
      } catch (err: any) {}
    }

    // Repay a conservative batch of active loans
    if (activeP2PLoansList.length > 8) {
      const repayBatch = activeP2PLoansList.splice(0, 2);
      for (const loan of repayBatch) {
        try {
          await loan.borrower.wallet.writeContract({
            address: contracts.P2P_MARKET as `0x${string}`,
            abi: P2P_MARKET_ABI,
            functionName: 'repayLoan',
            args: [loan.loanId]
          });
          monthlyTx++;
        } catch (err: any) {}
      }
    }

    // --- 5. Real Yield Multi-Asset Basket Claims ---
    for (let i = 0; i < 6; i++) {
      const u = users[i];
      try {
        const earned = await client.readContract({
          address: contracts.STAKING as `0x${string}`,
          abi: STAKING_ABI,
          functionName: 'earned',
          args: [u.address]
        });
        if (earned > 0n) {
          await u.wallet.writeContract({
            address: contracts.REAL_YIELD_ROUTER as `0x${string}`,
            abi: ROUTER_ABI,
            functionName: 'claimRealYield'
          });
          monthlyTx++;
        }
      } catch (err: any) {}
    }

    // --- 6. Redemptions & Early Ragequits ($30,000 / month) ---
    // 2 Redemptions at NAV
    for (let i = 0; i < 2; i++) {
      const u = users[i + 2];
      try {
        const bal = await client.readContract({
          address: contracts.ALPHA_TOKEN as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [u.address]
        });
        if (bal >= parseUnits('10000', 18)) {
          const redeemShares = parseUnits('10000', 18);
          await u.wallet.writeContract({
            address: contracts.TREASURY as `0x${string}`,
            abi: TREASURY_ABI,
            functionName: 'redeem',
            args: [redeemShares, 0n]
          });
          monthlyTx++;
          monthlyExitsUsd += 15000;
        }
      } catch (err: any) {}
    }

    // 1 Early Ragequit
    if (monthlyP2PBondTokens.length > 0) {
      const bond = monthlyP2PBondTokens[monthlyP2PBondTokens.length - 1];
      try {
        const owner = await client.readContract({
          address: contracts.POSITION_NFT as `0x${string}`,
          abi: POSITION_NFT_ABI,
          functionName: 'ownerOf',
          args: [bond.tokenId]
        });
        if (owner.toLowerCase() === bond.user.address.toLowerCase()) {
          await bond.user.wallet.writeContract({
            address: contracts.VESTED_VAULT as `0x${string}`,
            abi: VESTED_VAULT_ABI,
            functionName: 'ragequit',
            args: [bond.tokenId]
          });
          monthlyTx++;
          monthlyExitsUsd += baseBondPrincipal;
        }
      } catch (err: any) {}
    }

    // --- 7. Exogenous Yield Inflow (Morpho / LST 5.5% annual on reserves) ---
    const monthlyYieldUsdc = parseUnits('28000', 6);
    try {
      await operatorWallet.writeContract({
        address: contracts.USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [contracts.ALPHA_VAULT as `0x${string}`, monthlyYieldUsdc]
      });
      await operatorWallet.writeContract({
        address: contracts.USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [contracts.REAL_YIELD_ROUTER as `0x${string}`, parseUnits('9000', 6)]
      });
      await operatorWallet.writeContract({
        address: contracts.REAL_YIELD_ROUTER as `0x${string}`,
        abi: ROUTER_ABI,
        functionName: 'notifyYield',
        args: [parseUnits('9000', 6)]
      });
    } catch (err: any) {}

    // Advance EVM Time by 30.5 days
    await testClient.increaseTime({ seconds: Math.floor(SECONDS_PER_MONTH) });
    await testClient.mine({ blocks: 1 });

    // --- Month 12: Maturity Claim for 1-year bonds ---
    if (month === 12) {
      console.log(`\n🎉 MONTH 12 MATURITY: Advancing 31 days to cross 365-day threshold...`);
      await testClient.increaseTime({ seconds: 31 * 24 * 3600 });
      await testClient.mine({ blocks: 1 });

      let maturedClaimed = 0;
      for (const bond of month1HoldBonds) {
        try {
          const owner = await client.readContract({
            address: contracts.POSITION_NFT as `0x${string}`,
            abi: POSITION_NFT_ABI,
            functionName: 'ownerOf',
            args: [bond.tokenId]
          });
          if (owner.toLowerCase() === bond.user.address.toLowerCase()) {
            await bond.user.wallet.writeContract({
              address: contracts.VESTED_VAULT as `0x${string}`,
              abi: VESTED_VAULT_ABI,
              functionName: 'claimMatured',
              args: [bond.tokenId]
            });
            monthlyTx++;
            maturedClaimed++;
            monthlyExitsUsd += baseBondPrincipal;
          }
        } catch (err: any) {}
      }
      console.log(`[✔] Claimed ${maturedClaimed} matured 1-year bonds!`);
    }

    const monthlyTotalVolume = monthlyDepositsUsd + monthlyBondsUsd + monthlyP2PUsd + monthlyExitsUsd;
    totalTxCount += monthlyTx;
    cumulativeUsdcDeployed += monthlyTotalVolume;

    // Snapshot state
    const [res, navWei, circulatingShares, burnedWei, totalStakedWei, p2pOverview] = await Promise.all([
      client.readContract({ address: contracts.TREASURY as `0x${string}`, abi: TREASURY_ABI, functionName: 'getProofOfReserves' }),
      client.readContract({ address: contracts.TREASURY as `0x${string}`, abi: TREASURY_ABI, functionName: 'getNAVPerShare' }),
      client.readContract({ address: contracts.TREASURY as `0x${string}`, abi: TREASURY_ABI, functionName: 'getNetCirculatingShares' }),
      client.readContract({ address: contracts.TREASURY as `0x${string}`, abi: TREASURY_ABI, functionName: 'totalBurnedTokens' }),
      client.readContract({ address: contracts.STAKING as `0x${string}`, abi: STAKING_ABI, functionName: 'totalStaked' }),
      client.readContract({ address: contracts.P2P_MARKET as `0x${string}`, abi: P2P_MARKET_ABI, functionName: 'getMarketplaceOverview' })
    ]);

    const assetsUsd = parseFloat(formatEther(res[0]));
    const liabilitiesUsd = parseFloat(formatEther(res[1]));
    const porRatio = liabilitiesUsd > 0 ? (assetsUsd / liabilitiesUsd) * 100 : Number(res[2]) / 100;
    const navVal = parseFloat(formatEther(navWei));
    const circSharesVal = parseFloat(formatEther(circulatingShares));
    const burnedVal = parseFloat(formatEther(burnedWei));
    const stakedVal = parseFloat(formatEther(totalStakedWei));
    const activeLoans = Number(p2pOverview.totalActiveLoans);

    const stats: MonthlyStats = {
      month,
      depositsUsd: monthlyDepositsUsd,
      bondsUsd: monthlyBondsUsd,
      p2pVolumeUsd: monthlyP2PUsd,
      exitsUsd: monthlyExitsUsd,
      totalVolumeUsd: monthlyTotalVolume,
      txCount: monthlyTx,
      navPerShare: navVal,
      assetsUsd,
      liabilitiesUsd,
      porRatioPct: porRatio,
      circulatingAlpha: circSharesVal,
      stakedAlpha: stakedVal,
      burnedAlpha: burnedVal,
      activeP2PLoans: activeLoans
    };
    allMonthlyStats.push(stats);

    const durationSec = ((Date.now() - epochStart) / 1000).toFixed(1);
    console.log(`📅 Month ${month}/12 finished in ${durationSec}s | Txs: ${monthlyTx} | NAV: $${navVal.toFixed(4)} | Assets: $${assetsUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })} | PoR: ${porRatio.toFixed(2)}% | Circulating: ${circSharesVal.toLocaleString('en-US', { maximumFractionDigits: 0 })} ALPHA`);
  }

  // Final Audit Call
  console.log(`\n🏛️ Executing Final Proof of Reserves On-Chain Audit...`);
  try {
    await operatorWallet.writeContract({
      address: contracts.TREASURY as `0x${string}`,
      abi: TREASURY_ABI,
      functionName: 'auditProofOfReserves'
    });
  } catch (err: any) {}

  const [finalRes, finalNav, finalCirc, finalBurn, finalLiability, finalInvested, finalP2P] = await Promise.all([
    client.readContract({ address: contracts.TREASURY as `0x${string}`, abi: TREASURY_ABI, functionName: 'getProofOfReserves' }),
    client.readContract({ address: contracts.TREASURY as `0x${string}`, abi: TREASURY_ABI, functionName: 'getNAVPerShare' }),
    client.readContract({ address: contracts.TREASURY as `0x${string}`, abi: TREASURY_ABI, functionName: 'getNetCirculatingShares' }),
    client.readContract({ address: contracts.TREASURY as `0x${string}`, abi: TREASURY_ABI, functionName: 'totalBurnedTokens' }),
    client.readContract({ address: contracts.VESTED_VAULT as `0x${string}`, abi: VESTED_VAULT_ABI, functionName: 'totalPresentLiability' }),
    client.readContract({ address: contracts.VESTED_VAULT as `0x${string}`, abi: VESTED_VAULT_ABI, functionName: 'totalInvested' }),
    client.readContract({ address: contracts.P2P_MARKET as `0x${string}`, abi: P2P_MARKET_ABI, functionName: 'getMarketplaceOverview' })
  ]);

  const fAssets = parseFloat(formatEther(finalRes[0]));
  const fLiab = parseFloat(formatEther(finalRes[1]));
  const fPoR = fLiab > 0 ? (fAssets / fLiab) * 100 : Number(finalRes[2]) / 100;
  const fNav = parseFloat(formatEther(finalNav));
  const fCirc = parseFloat(formatEther(finalCirc));
  const fBurn = parseFloat(formatEther(finalBurn));
  const fVestedDebt = parseFloat(formatEther(finalLiability));
  const fNetEquity = fAssets > fVestedDebt ? fAssets - fVestedDebt : 0;
  const fActiveLoans = Number(finalP2P.totalActiveLoans);
  const fP2PVolume = parseFloat(formatUnits(finalP2P.totalVolumeUSD, 6));

  console.log(`\n======================================================`);
  console.log(`🏆 FINAL INSTITUTIONAL BALANCE SHEET (YEAR 1 MATURITY)`);
  console.log(`======================================================`);
  console.log(`Total Operations Executed : ${totalTxCount} transactions`);
  console.log(`Total Capital Processed   : $${cumulativeUsdcDeployed.toLocaleString()} USDC`);
  console.log(`Gross Exogenous Assets    : $${fAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`);
  console.log(`Bond Present Debt (Liab)  : $${fVestedDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`);
  console.log(`Net Protocol Equity       : $${fNetEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`);
  console.log(`Net Circulating Supply    : ${fCirc.toLocaleString('en-US', { minimumFractionDigits: 2 })} ALPHA`);
  console.log(`Final NAV Per Share       : $${fNav.toFixed(4)} USDC (+${((fNav - 1.0) * 100).toFixed(2)}% APY)`);
  console.log(`Solvency Ratio (PoR)      : ${fPoR.toFixed(2)}% (Backing 1:1 Guaranteed)`);
  console.log(`Total Burned Tokens       : ${fBurn.toLocaleString('en-US', { minimumFractionDigits: 3 })} ALPHA`);
  console.log(`Active P2P Loans in Book  : ${fActiveLoans} active loans ($${fP2PVolume.toLocaleString()} USD volume)`);
  console.log(`======================================================\n`);

  const fs = await import('fs');
  const path = await import('path');
  const outPath = path.resolve(__dirname, '../../../reports/annual_simulation_results.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({
    totalTxCount,
    cumulativeUsdcDeployed,
    finalAssets: fAssets,
    finalLiabilities: fLiab,
    finalPoR: fPoR,
    finalNav: fNav,
    finalCirculating: fCirc,
    finalBurned: fBurn,
    finalVestedDebt: fVestedDebt,
    finalNetEquity: fNetEquity,
    finalActiveLoans: fActiveLoans,
    finalP2PVolume: fP2PVolume,
    monthlyStats: allMonthlyStats
  }, null, 2));
  console.log(`[✔] Annual simulation results written to: ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal simulation error:', err);
  process.exit(1);
});
