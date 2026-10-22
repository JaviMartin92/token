import { publicClient } from './web3.js';
import { decodeWeb3Error, type DecodedWeb3Error } from './web3ErrorDecoder.js';

export interface PreflightCheckResult {
  canExecute: boolean;
  error?: DecodedWeb3Error;
  warning?: string;
}

/**
 * Simulates a smart contract call on-chain before prompting the user's wallet.
 * If the transaction will revert, returns a decoded human-readable explanation
 * and prevents wallet transaction popup failures (Zero-Revert UX standard).
 */
export async function simulatePreflightTransaction(
  contractAddress: `0x${string}`,
  abi: readonly any[],
  functionName: string,
  args: readonly any[],
  userAccount?: `0x${string}`
): Promise<PreflightCheckResult> {
  if (!userAccount || userAccount === '0x0000000000000000000000000000000000000000') {
    return {
      canExecute: false,
      error: {
        title: 'Billetera No Conectada',
        message: 'Conecta tu billetera Web3 para realizar esta operación.',
        actionableHint: 'Haz clic en Conectar Billetera en la esquina superior derecha.',
        isUserRejection: false
      }
    };
  }

  try {
    await publicClient.simulateContract({
      address: contractAddress,
      abi,
      functionName,
      args,
      account: userAccount
    });

    return { canExecute: true };
  } catch (err: any) {
    const decoded = decodeWeb3Error(err);
    return {
      canExecute: false,
      error: decoded
    };
  }
}
