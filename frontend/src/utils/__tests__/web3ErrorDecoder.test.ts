import { describe, it, expect } from 'vitest';
import { decodeWeb3Error } from '../../utils/web3ErrorDecoder.js';

describe('web3ErrorDecoder Unit Tests', () => {
  it('identifies and translates user rejection error code 4001', () => {
    const err = { code: 4001, message: 'User rejected the request' };
    const decoded = decodeWeb3Error(err);
    expect(decoded.isUserRejection).toBe(true);
    expect(decoded.title).toBe('Transacción Cancelada');
    expect(decoded.code).toBe(4001);
  });

  it('identifies insufficient funds for gas (-32000)', () => {
    const err = { code: -32000, message: 'insufficient funds for gas * price + value' };
    const decoded = decodeWeb3Error(err);
    expect(decoded.isUserRejection).toBe(false);
    expect(decoded.title).toBe('Saldo Insuficiente para Gas');
  });

  it('detects flash loan cooldown revert reason', () => {
    const err = { message: 'execution reverted: Same-block deposit/redeem cooldown active' };
    const decoded = decodeWeb3Error(err);
    expect(decoded.title).toBe('Protección Anti-Arbitraje Flash Loan');
  });

  it('handles null / undefined cleanly without crashing', () => {
    const decoded = decodeWeb3Error(null);
    expect(decoded.title).toBe('Error Desconocido');
    expect(decoded.isUserRejection).toBe(false);
  });
});
