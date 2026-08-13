export function parseWeb3Error(err: any): string {
  if (!err) return 'Unknown error occurred.';
  const msg = err.message || err.toString() || '';
  
  if (msg.includes('TreasuryManager: KYC verification required') || msg.includes('KYC')) {
    return 'KYC Verification Required. Only authorized institutions can deposit/redeem.';
  }
  if (msg.includes('Same-block deposit/redeem cooldown')) {
    return 'Flash Loan Protection: Same block deposit and redeem is not allowed.';
  }
  if (msg.includes('Redeeming 0 shares')) {
    return 'Invalid amount: Must redeem more than 0 shares.';
  }
  if (msg.includes('Deposit amount must be > 0')) {
    return 'Invalid amount: Must deposit more than 0.';
  }
  if (msg.includes('insufficient funds') || msg.includes('transfer amount exceeds balance')) {
    return 'Insufficient funds for this transaction.';
  }
  if (msg.includes('transfer amount exceeds allowance')) {
    return 'Insufficient allowance. Please approve the token first.';
  }
  if (msg.includes('User rejected the request') || msg.includes('User denied transaction signature')) {
    return 'Transaction was rejected by the user.';
  }
  
  // Extract custom contract errors
  const match = msg.match(/execution reverted: ([^"\n]+)/);
  if (match && match[1]) {
    return match[1];
  }

  return 'Transaction failed: ' + (err.shortMessage || err.name || 'Unknown RPC error');
}
