const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../frontend/src/App.tsx');
fs.writeFileSync(file, `import { useState, useEffect } from 'react';
import { publicClient, walletClient, CONTRACT_ADDRESSES, ABIS } from './utils/web3.js';
import { formatEther, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { Header } from './components/Header.js';
import { TreasuryDashboard } from './components/TreasuryDashboard.js';
import { VestedVaults, UserPosition } from './components/VestedVaults.js';
import { P2PMarketplace } from './components/P2PMarketplace.js';
import { GovernanceStakingUI } from './components/GovernanceStakingUI.js';
import { AdminControlPanel } from './components/AdminControlPanel.js';
import { ActivityLog } from './components/ActivityLog.js';
import { NotificationToast, ToastMessage } from './components/NotificationToast.js';

export default function App() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string>('');
  
  const [navValue, setNavValue] = useState<string>('0.00');
  const [targetWeights, setTargetWeights] = useState({ stables: 50, wbtc: 25, weth: 12.5, alts: 12.5 });

  const [usdcBalance, setUsdcBalance] = useState<string>('0.00');
  const [sharesBalance, setSharesBalance] = useState<string>('0.00');

  const [depositAmount, setDepositAmount] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [injectionAmount, setInjectionAmount] = useState('');
  const [oraclePrice, setOraclePrice] = useState('1.00');

  const [newStablesWeight, setNewStablesWeight] = useState('50');
  const [newWbtcWeight, setNewWbtcWeight] = useState('25');
  const [newWethWeight, setNewWethWeight] = useState('12.5');
  const [newAltsWeight, setNewAltsWeight] = useState('12.5');

  const [bondPrincipal, setBondPrincipal] = useState('1000');
  const [bondLockYears, setBondLockYears] = useState('3');
  const [bondReferrer, setBondReferrer] = useState('');

  const [p2pTokenId, setP2pTokenId] = useState('1');
  const [p2pBorrowAmount, setP2pBorrowAmount] = useState('500');
  const [p2pInterestBps, setP2pInterestBps] = useState('1000');
  const [p2pDays, setP2pDays] = useState('30');
  
  const [targetLoanId, setTargetLoanId] = useState('1');
  const [loanCollateral, setLoanCollateral] = useState('700');

  const [stakeAmount, setStakeAmount] = useState('100');
  const [stakedBalance, setStakedBalance] = useState('0.00');
  const [claimableYield, setClaimableYield] = useState('0.00');
  const [payoutPref, setPayoutPref] = useState<number>(0);

  const [userPositions, setUserPositions] = useState<UserPosition[]>([]);

  const [porAssets, setPorAssets] = useState<string>('0.00');
  const [porLiabilities, setPorLiabilities] = useState<string>('0.00');
  const [porRatio, setPorRatio] = useState<string>('100.00%');
  const [porBreakdown, setPorBreakdown] = useState<{ stables: number; wbtc: number; weth: number; alphaStaking: number }>({ stables: 0, wbtc: 0, weth: 0, alphaStaking: 0 });

  const [blockDateStr, setBlockDateStr] = useState<string>('');
  const [snapshotId, setSnapshotId] = useState<string>('');

  const [logs, setLogs] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [circuitBreakerFrozen, setCircuitBreakerFrozen] = useState(false);
  const [activeTab, setActiveTab] = useState<'client' | 'governance'>('client');

  const ADMIN_KEY = (import.meta.env.VITE_ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as \`0x\${string}\`;
  const USER_KEY = (import.meta.env.VITE_USER_KEY || '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d') as \`0x\${string}\`;

  const [activeKey, setActiveKey] = useState<\`0x\${string}\`>(ADMIN_KEY);
  const account = privateKeyToAccount(activeKey);
  const [contractOwner, setContractOwner] = useState<string>('');

  const addToast = (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => { setToasts((prev) => prev.filter((t) => t.id !== id)); }, 5000);
  };

  const addLog = (msg: string) => {
    setLogs((prev) => [\`[\${new Date().toLocaleTimeString()}] \${msg}\`, ...prev.slice(0, 14)]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => { setUserAddress(account.address); setWalletConnected(true); }, [activeKey]);

  useEffect(() => {
    const initSnapshot = async () => {
      try {
        const snap = await (publicClient.request as any)({ method: 'evm_snapshot', params: [] });
        setSnapshotId(snap);
      } catch (e) {}
    };
    initSnapshot();
  }, []);
`, 'utf8');
console.log('Part 1 written');