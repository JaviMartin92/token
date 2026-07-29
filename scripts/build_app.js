const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../frontend/src/App.tsx');

const imports = `import { useState, useEffect } from 'react';
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
`;

fs.writeFileSync(file, imports, 'utf8');
console.log('App.tsx initialized with imports');