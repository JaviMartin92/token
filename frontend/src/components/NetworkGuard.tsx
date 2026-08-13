import React from 'react';
import { useAccount, useSwitchChain } from 'wagmi';

export const NetworkGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { chain, isConnected } = useAccount();
  const { chains, switchChain } = useSwitchChain();

  if (!isConnected) {
    return <>{children}</>;
  }

  const isSupportedChain = chains.some((c) => c.id === chain?.id);

  if (!isSupportedChain) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-gray-900 border border-red-500/30 p-8 rounded-xl max-w-md w-full text-center">
          <div className="text-red-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Unsupported Network</h2>
          <p className="text-gray-400 mb-6">
            Please switch to a supported network to continue using Alpha Centauri.
          </p>
          <div className="flex flex-col gap-3">
            {chains.map((supportedChain) => (
              <button
                key={supportedChain.id}
                onClick={() => switchChain({ chainId: supportedChain.id })}
                className="bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                Switch to {supportedChain.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
