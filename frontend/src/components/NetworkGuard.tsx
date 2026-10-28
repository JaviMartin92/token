import React from 'react';
import { useAccount, useSwitchChain } from 'wagmi';

export const NetworkGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { chain, isConnected } = useAccount();
  const { chains, switchChainAsync } = useSwitchChain();

  if (!isConnected) {
    return <>{children}</>;
  }

  const isSupportedChain = chains.some((c) => c.id === chain?.id);

  if (!isSupportedChain) {
    const handleSwitch = async (targetChainId: number) => {
      try {
        await switchChainAsync({ chainId: targetChainId });
      } catch (err: any) {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          try {
            const chainConfigs: Record<number, any> = {
              42161: {
                chainId: '0xa4b1',
                chainName: 'Arbitrum One',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://arb1.arbitrum.io/rpc'],
                blockExplorerUrls: ['https://arbiscan.io']
              },
              421614: {
                chainId: '0x66eee',
                chainName: 'Arbitrum Sepolia',
                nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
                blockExplorerUrls: ['https://sepolia.arbiscan.io']
              },
              31337: {
                chainId: '0x7a69',
                chainName: 'Anvil Localhost',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: [window.location.origin + '/rpc', 'http://127.0.0.1:8545'],
              }
            };

            const config = chainConfigs[targetChainId];
            if (config) {
              await (window as any).ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [config],
              });
            }
          } catch (addErr) {
            console.error('Failed to add chain to wallet', addErr);
          }
        }
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="network-guard-title">
        <div className="bg-gray-900 border border-blue-500/30 p-8 rounded-xl max-w-md w-full text-center shadow-2xl">
          <div className="text-blue-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 id="network-guard-title" className="text-2xl font-bold text-white mb-2">Red No Compatible</h2>
          <p className="text-gray-400 mb-6 text-sm">
            Alpha Centauri está desplegado en la red de Capa 2 <strong>Arbitrum One</strong> (y Arbitrum Sepolia en pruebas). Por favor conecta tu billetera a una de las redes compatibles para operar.
          </p>
          <div className="flex flex-col gap-3">
            {chains.map((supportedChain) => (
              <button
                key={supportedChain.id}
                type="button"
                onClick={() => handleSwitch(supportedChain.id)}
                className="bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span>Conectar a</span> <strong>{supportedChain.name}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
