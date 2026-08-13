import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { publicClient } from '../utils/web3.js';

export function useGlobalState() {
  const { address: userAddress, isConnected: walletConnected } = useAccount();
  const [snapshotId, setSnapshotId] = useState('');
  const [chainId, setChainId] = useState<number>(31337);
  const [blockDateStr, setBlockDateStr] = useState('');

  useEffect(() => {
    const initSnapshot = async () => {
      try {
        const snap = await (publicClient.request as any)({ method: 'evm_snapshot', params: [] });
        setSnapshotId(snap);
      } catch (e) {}
      try {
        const cId = await publicClient.getChainId();
        setChainId(cId);
      } catch (e) {
        setChainId(31337);
      }
    };
    initSnapshot();

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const handleChainChanged = (hexChainId: string) => {
        const parsedId = parseInt(hexChainId, 16);
        if (!isNaN(parsedId)) setChainId(parsedId);
      };
      (window as any).ethereum.on('chainChanged', handleChainChanged);
      return () => {
        (window as any).ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  useEffect(() => {
    const fetchBlock = async () => {
      try {
        const currentBlock = await publicClient.getBlock();
        const currentSec = Number(currentBlock.timestamp);
        setBlockDateStr(new Date(currentSec * 1000).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'medium' }));
      } catch (e) {}
    };
    fetchBlock();
    const interval = setInterval(fetchBlock, 10000); // Only update block time every 10s
    return () => clearInterval(interval);
  }, []);

  const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const [activeKey, setActiveKey] = useState<string>(ADMIN_KEY);
  
  useEffect(() => {
      if (walletConnected && userAddress) {
          setActiveKey(ADMIN_KEY); // Simplified for local dev
      } else {
          setActiveKey(ADMIN_KEY); // Default to local dev admin key
      }
  }, [walletConnected, userAddress]);

  const DEFAULT_DEV_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const effectiveUserAddress = userAddress || DEFAULT_DEV_ADDRESS;

  return {
    walletConnected: true,
    userAddress: effectiveUserAddress,
    account: { address: effectiveUserAddress },
    snapshotId,
    setSnapshotId,
    chainId,
    blockDateStr,
    activeKey,
    ADMIN_KEY
  };
}
