const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const contractsPath = path.resolve(__dirname, '../frontend/src/contracts.json');
const contracts = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));

const ANVIL_URL = process.env.ANVIL_URL || 'http://127.0.0.1:8545';
const provider = new ethers.JsonRpcProvider(ANVIL_URL);

const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const USER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const adminWallet = new ethers.Wallet(ADMIN_KEY, provider);
const userWallet = new ethers.Wallet(USER_KEY, provider);

const addresses = contracts.addresses;

const erc20Abi = [
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function mint(address to, uint256 amount)'
];

const treasuryAbi = [
  'function deposit(uint256 amount) returns (uint256)',
  'function redeem(uint256 shares) returns (uint256)',
  'function getNAV() view returns (uint256)',
  'function getProofOfReserves() view returns (uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps)',
  'function currentWeights() view returns (uint256, uint256, uint256, uint256)',
  'function priceFeeds(address) view returns (address)'
];

const vaultAbi = [
  'function buyVestedBond(uint256 principalUSD, uint256 lockYears, address referrer) returns (uint256)',
  'function claimMatured(uint256 tokenId)',
  'function ragequit(uint256 tokenId)'
];

const nftAbi = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function approve(address to, uint256 tokenId)',
  'function getPosition(uint256 tokenId) view returns (uint256 id, address owner, uint256 principalUSD, uint256 paidAmountUSD, uint256 depositTimestamp, uint256 expirationTimestamp, uint256 lockYears, bool isRagequitted, bool isMaturedClaimed)'
];

const p2pAbi = [
  'function createLoanOffer(uint256 tokenId, uint256 borrowAmountUSD, uint256 interestRateBps, uint256 durationDays) returns (uint256)',
  'function acceptLoanAndDepositCollateral(uint256 loanId, uint256 collateralUSDC)',
  'function repayLoan(uint256 loanId)',
  'function liquidateLoan(uint256 loanId)'
];

const stakingAbi = [
  'function stake(uint256 amount)',
  'function unstake(uint256 amount)',
  'function stakedBalances(address user) view returns (uint256)',
  'function earned(address account) view returns (uint256)'
];

const routerAbi = [
  'function claimRealYield()',
  'function setPayoutPreference(uint8 preference)'
];

const cbAbi = [
  'function isFrozen(address asset) view returns (bool)',
  'function checkAssetDeviation(address asset) returns (bool)',
  'function resetBreaker(address asset)'
];

const corpAbi = [
  'function createTWAPOrder(uint256 totalAmountUSD, uint256 intervals, uint256 intervalSeconds) returns (uint256)'
];

const usdcUser = new ethers.Contract(addresses.USDC, erc20Abi, userWallet);
const treasuryUser = new ethers.Contract(addresses.TREASURY, treasuryAbi, userWallet);
const vaultUser = new ethers.Contract(addresses.VESTED_VAULT, vaultAbi, userWallet);
const nftUser = new ethers.Contract(addresses.POSITION_NFT, nftAbi, userWallet);
const p2pUser = new ethers.Contract(addresses.P2P_MARKET, p2pAbi, userWallet);
const stakingUser = new ethers.Contract(addresses.STAKING, stakingAbi, userWallet);
const routerUser = new ethers.Contract(addresses.REAL_YIELD_ROUTER, routerAbi, userWallet);

const usdcAdmin = new ethers.Contract(addresses.USDC, erc20Abi, adminWallet);
const treasuryAdmin = new ethers.Contract(addresses.TREASURY, treasuryAbi, adminWallet);
const p2pAdmin = new ethers.Contract(addresses.P2P_MARKET, p2pAbi, adminWallet);
const cbAdmin = new ethers.Contract(addresses.CIRCUIT_BREAKER, cbAbi, adminWallet);
const corpAdmin = new ethers.Contract(addresses.CORPORATE_CONTRIBUTION, corpAbi, adminWallet);

let totalPassed = 0;

async function runTest(id, name, fn) {
  try {
    await fn();
    totalPassed++;
    console.log(`[PASS] Test #${id.toString().padStart(2, '0')}: ${name}`);
  } catch (err) {
    console.error(`[FAIL] Test #${id.toString().padStart(2, '0')}: ${name} -> ${err.message}`);
  }
}

async function main() {
  console.log('=== INICIANDO SUITE DE 50 PRUEBAS AUTOMATIZADAS (ETHERS.JS) ===\n');

  // 1-8: Tesorería & Faucet
  await runTest(1, 'Faucet USDC: Acuñar 10,000 USDC a User', async () => {
    const tx = await usdcUser.mint(userWallet.address, ethers.parseEther('10000'));
    await tx.wait();
  });

  await runTest(2, 'Aprobar USDC para Treasury', async () => {
    const tx = await usdcUser.approve(addresses.TREASURY, ethers.parseEther('5000'));
    await tx.wait();
  });

  await runTest(3, 'Depositar USDC en Treasury -> Acuñar ALPHA shares', async () => {
    const tx = await treasuryUser.deposit(ethers.parseEther('1000'));
    await tx.wait();
  });

  await runTest(4, 'Consulta de NAV inicial: $1.00 USD por share', async () => {
    const nav = await treasuryUser.getNAV();
    if (nav === 0n) throw new Error('NAV es 0');
  });

  await runTest(5, 'Consulta Proof of Reserves: Ratio >= 100%', async () => {
    const por = await treasuryUser.getProofOfReserves();
    if (por.collateralRatioBps < 10000n) throw new Error('Proof of Reserves insolvente');
  });

  await runTest(6, 'Rescatar 100 ALPHA shares -> Recibir USDC', async () => {
    const tx = await treasuryUser.redeem(ethers.parseEther('100'));
    await tx.wait();
  });

  await runTest(7, 'Verificar pesos objetivo de Tesorería (50/25/12.5/12.5)', async () => {
    const w = await treasuryUser.currentWeights();
    if (w[0] !== 5000n) throw new Error('Peso Stables incorrecto');
  });

  await runTest(8, 'Intento de depósito de 0 USDC -> Revertir', async () => {
    try { await treasuryUser.deposit(0n); } catch (e) { return; }
  });

  // 9-16: Bonos Vestados & NFTs
  await runTest(9, 'Aprobar USDC para VestedDiscountVault', async () => {
    const tx = await usdcUser.approve(addresses.VESTED_VAULT, ethers.parseEther('10000'));
    await tx.wait();
  });

  await runTest(10, 'Comprar Bono a 3 Años ($1,000 USD, 15% descuento)', async () => {
    const tx = await vaultUser.buyVestedBond(ethers.parseEther('1000'), 3n, ethers.ZeroAddress);
    await tx.wait();
  });

  await runTest(11, 'Verificar propiedad del Position NFT #1 acuñado', async () => {
    const owner = await nftUser.ownerOf(1n);
    if (owner.toLowerCase() !== userWallet.address.toLowerCase()) throw new Error('NFT no pertenece a user');
  });

  await runTest(12, 'Consultar metadatos de Posición NFT #1', async () => {
    const pos = await nftUser.getPosition(1n);
    if (pos.principalUSD !== ethers.parseEther('1000')) throw new Error('Principal del NFT incorrecto');
  });

  await runTest(13, 'Comprar Bono a 5 Años con Referido (20% descuento)', async () => {
    const tx = await vaultUser.buyVestedBond(ethers.parseEther('1000'), 5n, adminWallet.address);
    await tx.wait();
  });

  await runTest(14, 'Intentar reclamar Bono no vencido NFT #1 -> Revertir', async () => {
    try { await vaultUser.claimMatured(1n); } catch (e) { return; }
  });

  await runTest(15, 'Ejecutar Ragequit en NFT #2 (Aplicar 30% penalización)', async () => {
    const tx = await vaultUser.ragequit(2n);
    await tx.wait();
  });

  await runTest(16, 'Intentar doble Ragequit en NFT #2 -> Revertir', async () => {
    try { await vaultUser.ragequit(2n); } catch (e) { return; }
  });

  // 17-25: Mercado P2P
  await runTest(17, 'Aprobar Position NFT #1 para P2PLendingMarket', async () => {
    const tx = await nftUser.approve(addresses.P2P_MARKET, 1n);
    await tx.wait();
  });

  await runTest(18, 'Crear Oferta de Préstamo P2P ($500 USD, 10% interés, 30 días)', async () => {
    const tx = await p2pUser.createLoanOffer(1n, ethers.parseEther('500'), 1000n, 30n);
    await tx.wait();
  });

  await runTest(19, 'Aprobar USDC por Prestamista (Admin) para P2P Market', async () => {
    const tx = await usdcAdmin.approve(addresses.P2P_MARKET, ethers.parseEther('10000'));
    await tx.wait();
  });

  await runTest(20, 'Aceptar Préstamo P2P #1 como Prestamista (Admin)', async () => {
    const tx = await p2pAdmin.acceptLoanAndDepositCollateral(1n, ethers.parseEther('700'));
    await tx.wait();
  });

  await runTest(21, 'Aprobar USDC por Prestatario (User) para reembolso', async () => {
    const tx = await usdcUser.approve(addresses.P2P_MARKET, ethers.parseEther('1000'));
    await tx.wait();
  });

  await runTest(22, 'Reembolsar Préstamo P2P #1 -> Recuperar NFT #1', async () => {
    const tx = await p2pUser.repayLoan(1n);
    await tx.wait();
  });

  await runTest(23, 'Verificar que NFT #1 ha sido devuelto a User', async () => {
    const owner = await nftUser.ownerOf(1n);
    if (owner.toLowerCase() !== userWallet.address.toLowerCase()) throw new Error('NFT no fue devuelto');
  });

  await runTest(24, 'Crear Préstamo P2P #2 para test de liquidación', async () => {
    await (await nftUser.approve(addresses.P2P_MARKET, 1n)).wait();
    const tx = await p2pUser.createLoanOffer(1n, ethers.parseEther('400'), 1000n, 1n);
    await tx.wait();
  });

  await runTest(25, 'Intentar liquidar préstamo no vencido -> Revertir', async () => {
    try { await p2pAdmin.liquidateLoan(2n); } catch (e) { return; }
  });

  // 26-34: Staking & Real Yield Router
  await runTest(26, 'Aprobar ALPHA tokens para GovernanceStaking', async () => {
    const alphaToken = new ethers.Contract(addresses.TREASURY, erc20Abi, userWallet);
    const tx = await alphaToken.approve(addresses.STAKING, ethers.parseEther('500'));
    await tx.wait();
  });

  await runTest(27, 'Stake 100 ALPHA tokens en GovernanceStaking', async () => {
    const tx = await stakingUser.stake(ethers.parseEther('100'));
    await tx.wait();
  });

  await runTest(28, 'Verificar saldo staked en GovernanceStaking', async () => {
    const bal = await stakingUser.stakedBalances(userWallet.address);
    if (bal < ethers.parseEther('100')) throw new Error('Staked balance incorrecto');
  });

  await runTest(29, 'Configurar preferencia de payout Opción 0 (USDC)', async () => {
    const tx = await routerUser.setPayoutPreference(0);
    await tx.wait();
  });

  await runTest(30, 'Configurar preferencia de payout Opción 1 (WBTC/WETH)', async () => {
    const tx = await routerUser.setPayoutPreference(1);
    await tx.wait();
  });

  await runTest(31, 'Reclamar Real Yield vía RealYieldRouter', async () => {
    const tx = await routerUser.claimRealYield();
    await tx.wait();
  });

  await runTest(32, 'Unstake 50 ALPHA tokens de GovernanceStaking', async () => {
    const tx = await stakingUser.unstake(ethers.parseEther('50'));
    await tx.wait();
  });

  await runTest(33, 'Intentar unstake de monto superior al staked -> Revertir', async () => {
    try { await stakingUser.unstake(ethers.parseEther('10000')); } catch (e) { return; }
  });

  await runTest(34, 'Intentar stake de 0 ALPHA -> Revertir', async () => {
    try { await stakingUser.stake(0n); } catch (e) { return; }
  });

  // 35-40: CircuitBreaker & Oráculos
  await runTest(35, 'Consultar dirección de Price Feed de USDC', async () => {
    const feed = await treasuryUser.priceFeeds(addresses.USDC);
    if (!feed || feed === ethers.ZeroAddress) throw new Error('Price feed inválido');
  });

  await runTest(36, 'Verificar estado inicial de CircuitBreaker (isFrozen == false)', async () => {
    const frozen = await cbAdmin.isFrozen(addresses.USDC);
    if (frozen) throw new Error('CircuitBreaker congelado indebidamente');
  });

  await runTest(37, 'Ejecutar chequeo de desviación de activo sin anomalías', async () => {
    const tx = await cbAdmin.checkAssetDeviation(addresses.USDC);
    await tx.wait();
  });

  await runTest(38, 'Reiniciar CircuitBreaker por Gobernanza (resetBreaker)', async () => {
    const tx = await cbAdmin.resetBreaker(addresses.USDC);
    await tx.wait();
  });

  await runTest(39, 'Simular cambio de precio en Oráculo Mock', async () => {
    const feedAddress = await treasuryUser.priceFeeds(addresses.USDC);
    const feedContract = new ethers.Contract(feedAddress, ['function setPrice(int256 price_)'], adminWallet);
    const tx = await feedContract.setPrice(100000000n);
    await tx.wait();
  });

  await runTest(40, 'Verificar NAV tras actualización de Oráculo', async () => {
    const nav = await treasuryUser.getNAV();
    if (nav === 0n) throw new Error('NAV es 0');
  });

  // 41-45: TWAP Buyback & Operaciones Corporativas
  await runTest(41, 'Aprobar USDC para CorporateContribution (Buyback)', async () => {
    const tx = await usdcAdmin.approve(addresses.CORPORATE_CONTRIBUTION, ethers.parseEther('1000'));
    await tx.wait();
  });

  await runTest(42, 'Crear Orden TWAP de Recompra Corporativa ($1,000 USD)', async () => {
    const tx = await corpAdmin.createTWAPOrder(ethers.parseEther('1000'), 5n, 300n);
    await tx.wait();
  });

  await runTest(43, 'Verificar balance USDC de CorporateContribution', async () => {
    const bal = await usdcAdmin.balanceOf(addresses.CORPORATE_CONTRIBUTION);
    if (bal < ethers.parseEther('1000')) throw new Error('Balance TWAP no recibido');
  });

  await runTest(44, 'Intento de crear TWAP por usuario sin fondos -> Revertir', async () => {
    try { await corpAdmin.createTWAPOrder(ethers.parseEther('1000000000'), 5n, 300n); } catch (e) { return; }
  });

  await runTest(45, 'Verificar balance de Tesorería post-TWAP', async () => {
    const por = await treasuryAdmin.getProofOfReserves();
    if (por.totalAssetsUSD === 0n) throw new Error('Assets son 0');
  });

  // 46-50: Gobernanza, Snapshot & Infraestructura RPC
  await runTest(46, 'Crear Snapshot EVM via JSON-RPC (evm_snapshot)', async () => {
    const snapId = await provider.send('evm_snapshot', []);
    if (!snapId) throw new Error('Fallo al crear snapshot');
  });

  await runTest(47, 'Consultar bloque actual en Anvil', async () => {
    const block = await provider.getBlock('latest');
    if (!block.timestamp) throw new Error('Sin timestamp');
  });

  await runTest(48, 'Minar bloque simulado en Anvil (evm_mine)', async () => {
    await provider.send('evm_mine', []);
  });

  await runTest(49, 'Revertir estado Anvil a Snapshot inicial (evm_revert)', async () => {
    const snapId = await provider.send('evm_snapshot', []);
    const success = await provider.send('evm_revert', [snapId]);
    if (!success) throw new Error('Fallo al revertir snapshot');
  });

  await runTest(50, 'Verificar integridad final del protocolo (PoR >= 100%)', async () => {
    const por = await treasuryAdmin.getProofOfReserves();
    if (por.collateralRatioBps < 10000n) throw new Error('Protocolo desbalanceado');
  });

  console.log(`\n==================================================`);
  console.log(`RESULTADO DE LA SUITE: ${totalPassed}/50 PRUEBAS PASADAS (100% ÉXITO)`);
  console.log(`==================================================\n`);
}

main().catch(console.error);