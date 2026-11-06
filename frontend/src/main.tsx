import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { WagmiProvider, createConfig, http } from 'wagmi'
import { arbitrumSepolia, arbitrum, foundry } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ENV } from './config/env.js'

const localRpcUrl = typeof window !== 'undefined' ? `${window.location.origin}/rpc` : 'http://127.0.0.1:8545';
const arbitrumRpcUrl = ENV.VITE_CHAIN_ID === 42161 && ENV.VITE_PUBLIC_RPC_URL ? ENV.VITE_PUBLIC_RPC_URL : 'https://arb1.arbitrum.io/rpc';
const arbitrumSepoliaRpcUrl = ENV.VITE_CHAIN_ID === 421614 && ENV.VITE_PUBLIC_RPC_URL ? ENV.VITE_PUBLIC_RPC_URL : 'https://sepolia-rollup.arbitrum.io/rpc';

const config = createConfig({
  chains: [arbitrumSepolia, arbitrum, foundry],
  connectors: [injected()],
  transports: {
    [arbitrumSepolia.id]: http(arbitrumSepoliaRpcUrl),
    [arbitrum.id]: http(arbitrumRpcUrl),
    [foundry.id]: http(localRpcUrl),
  },
})

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
