import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { publicClient } from '../utils/web3.js';
import { ENV } from '../config/env.js';

export function useGlobalState() {
  const { address: userAddress, isConnected: walletConnected } = useAccount();
  const [snapshotId, setSnapshotId] = useState('');
  const [chainId, setChainId] = useState<number>(ENV.VITE_CHAIN_ID || 421614);
  const [blockDateStr, setBlockDateStr] = useState('');

  useEffect(() => {
    const initSnapshot = async () => {
      if (ENV.VITE_CHAIN_ID === 31337) {
        try {
          const snap = await (publicClient.request as any)({ method: 'evm_snapshot', params: [] });
          setSnapshotId(snap);
        } catch (e) {}
      }
      try {
        const cId = await publicClient.getChainId();
        setChainId(cId);
      } catch (e) {
        setChainId(ENV.VITE_CHAIN_ID || 421614);
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
    let unwatch: (() => void) | undefined;
    const fetchBlock = async () => {
      try {
        const currentBlock = await publicClient.getBlock();
        const currentSec = Number(currentBlock.timestamp);
        setBlockDateStr(new Date(currentSec * 1000).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'medium' }));
      } catch (e) {}
    };
    fetchBlock();

    try {
      if (typeof publicClient.watchBlockNumber === 'function') {
        unwatch = publicClient.watchBlockNumber({
          onBlockNumber: () => {
            fetchBlock();
          },
          onError: () => {}
        });
      }
    } catch (e) {}

    const interval = setInterval(fetchBlock, 15000);

    return () => {
      if (unwatch) unwatch();
      clearInterval(interval);
    };
  }, []);

  const activeKey = userAddress || '';
  const effectiveUserAddress = userAddress || '';

  return {
    walletConnected: !!walletConnected,
    userAddress: effectiveUserAddress,
    account: { address: effectiveUserAddress },
    snapshotId,
    setSnapshotId,
    chainId,
    blockDateStr,
    activeKey,
    isSandbox: chainId === 31337
  };
}
