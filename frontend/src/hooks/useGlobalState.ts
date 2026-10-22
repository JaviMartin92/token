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

  // Browser wallets sign every transaction. Private keys are never bundled into the UI.
  const activeKey = userAddress || '';
  const effectiveUserAddress = userAddress || '';

  return {
    walletConnected,
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
