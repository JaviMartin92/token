const RPC_URL = process.env.ANVIL_URL || 'http://127.0.0.1:8545';

export async function evmSnapshot(): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'evm_snapshot', params: [] })
  });
  const json = await res.json();
  return json.result;
}

export async function evmRevert(snapshotId: string): Promise<boolean> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'evm_revert', params: [snapshotId] })
  });
  const json = await res.json();
  return json.result;
}

export async function timeWarp(seconds: number): Promise<void> {
  await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'evm_increaseTime', params: [seconds] })
  });
  await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'evm_mine', params: [] })
  });
}
