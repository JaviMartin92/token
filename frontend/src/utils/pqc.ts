import { keccak256, encodePacked, encodeAbiParameters, parseAbiParameters } from 'viem';

/**
 * @title Post-Quantum Cryptography Utility (W-OTS+ w=4)
 * @notice Genera pares de claves y firmas post-cuánticas basadas en cadenas de hash Keccak-256.
 *         Alineado con directrices de NIST SP 800-208 / RFC 8391 para resistencia ante ordenadores cuánticos (Shor & Grover).
 */

export interface QuantumKeyPair {
  seeds: `0x${string}`[];
  publicKeys: `0x${string}`[];
  commitmentRoot: `0x${string}`;
}

/**
 * Genera un par de claves post-cuánticas deterministas en el navegador.
 */
export function generateQuantumKeyPair(): QuantumKeyPair {
  const seeds: `0x${string}`[] = [];
  const publicKeys: `0x${string}`[] = [];

  for (let i = 0; i < 67; i++) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const seed = (`0x` + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
    seeds.push(seed);

    let pk = seed;
    for (let step = 0; step < 15; step++) {
      pk = keccak256(encodePacked(['bytes32'], [pk]));
    }
    publicKeys.push(pk);
  }

  // Raíz de compromiso: keccak256(abi.encode(publicKeys))
  const commitmentRoot = keccak256(
    (encodeAbiParameters as any)(
      parseAbiParameters('bytes32[67]'),
      [publicKeys]
    )
  );

  return { seeds, publicKeys, commitmentRoot };
}

/**
 * Firma un digest de 32 bytes utilizando las 67 cadenas de hash Winternitz.
 */
export function signWinternitzMessage(messageHash: `0x${string}`, seeds: `0x${string}`[]): `0x${string}`[] {
  const cleanHex = messageHash.startsWith('0x') ? messageHash.slice(2) : messageHash;
  const bytes = new Uint8Array(cleanHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  const signature: `0x${string}`[] = [];
  let sumNibbles = 0;

  // 1. Firmar los 64 nibbles del mensaje
  for (let i = 0; i < 32; i++) {
    const byteVal = bytes[i];
    const n0 = byteVal >> 4;
    const n1 = byteVal & 0x0f;
    sumNibbles += (n0 + n1);

    let s0 = seeds[i * 2];
    for (let step = 0; step < n0; step++) {
      s0 = keccak256(encodePacked(['bytes32'], [s0]));
    }
    signature.push(s0);

    let s1 = seeds[i * 2 + 1];
    for (let step = 0; step < n1; step++) {
      s1 = keccak256(encodePacked(['bytes32'], [s1]));
    }
    signature.push(s1);
  }

  // 2. Checksum (960 - sumNibbles) para prevenir falsificaciones incrementales
  const checksum = 960 - sumNibbles;
  const c0 = (checksum >> 8) & 0x0f;
  const c1 = (checksum >> 4) & 0x0f;
  const c2 = checksum & 0x0f;

  const checksumNibbles = [c0, c1, c2];
  for (let j = 0; j < 3; j++) {
    let sc = seeds[64 + j];
    for (let step = 0; step < checksumNibbles[j]; step++) {
      sc = keccak256(encodePacked(['bytes32'], [sc]));
    }
    signature.push(sc);
  }

  return signature;
}
