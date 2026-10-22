import { describe, it, expect } from 'vitest';
import { generateQuantumKeyPair, signWinternitzMessage } from '../pqc.js';
import { keccak256, encodePacked } from 'viem';

describe('Post-Quantum Cryptography W-OTS+ Module', () => {
  it('debe generar un par de claves con 67 cadenas y un commitmentRoot de 32 bytes', () => {
    const keyPair = generateQuantumKeyPair();
    expect(keyPair.seeds).toHaveLength(67);
    expect(keyPair.publicKeys).toHaveLength(67);
    expect(keyPair.commitmentRoot).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('debe generar una firma W-OTS+ de exactamente 67 elementos', () => {
    const keyPair = generateQuantumKeyPair();
    const messageHash = keccak256(encodePacked(['string'], ['test_quantum_security_payload']));
    const signature = signWinternitzMessage(messageHash, keyPair.seeds);

    expect(signature).toHaveLength(67);
    expect(signature[0]).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });
});
