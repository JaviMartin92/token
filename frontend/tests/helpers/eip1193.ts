import type { Page } from '@playwright/test';

export async function injectEip1193Provider(
  page: Page,
  accountAddress: string = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  rpcUrl: string = 'http://127.0.0.1:8545'
) {
  await page.addInitScript(
    ({ account, rpc }) => {
      const listeners: Record<string, Function[]> = {};

      const provider = {
        isMetaMask: true,
        selectedAddress: account,
        networkVersion: '31337',
        chainId: '0x7a69',

        on(event: string, fn: Function) {
          listeners[event] = listeners[event] || [];
          listeners[event].push(fn);
          return this;
        },

        removeListener(event: string, fn: Function) {
          if (!listeners[event]) return this;
          listeners[event] = listeners[event].filter((cb) => cb !== fn);
          return this;
        },

        emit(event: string, ...args: any[]) {
          if (listeners[event]) {
            listeners[event].forEach((fn) => fn(...args));
          }
        },

        async request({ method, params = [] }: { method: string; params?: any[] }) {
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
            return [account];
          }

          if (method === 'eth_chainId') {
            return '0x7a69'; // 31337 in hex
          }

          if (method === 'net_version') {
            return '31337';
          }

          if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') {
            return null;
          }

          if (method === 'eth_sendTransaction') {
            const tx = params[0] || {};
            if (!tx.from) tx.from = account;
            params = [tx];
          }

          const res = await fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: Date.now(),
              method,
              params
            })
          });

          const data = await res.json();
          if (data.error) {
            const err = new Error(data.error.message || 'RPC Error');
            (err as any).data = data.error.data;
            (err as any).code = data.error.code;
            throw err;
          }
          return data.result;
        }
      };

      (window as any).ethereum = provider;
    },
    { account: accountAddress, rpc: rpcUrl }
  );
}
