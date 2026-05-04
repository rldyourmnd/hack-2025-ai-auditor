import * as crypto from 'crypto';

// simhash64: simple n-gram token simhash over tokens (imports + AST-like tokens)
export function simhash64FromString(s: string, n = 3): bigint {
  const tokens = s.split(/[^A-Za-z0-9_]+/).filter(Boolean);
  const v = new Array(64).fill(0);
  for (let i = 0; i + n <= tokens.length; i++) {
    const gram = tokens.slice(i, i + n).join(' ');
    const h = crypto.createHash('sha256').update(gram).digest();
    // take 64-bit from hash
    for (let bit = 0; bit < 64; bit++) {
      const byteIdx = Math.floor(bit / 8);
      const bitIdx = bit % 8;
      const bitVal = (h[byteIdx] >> bitIdx) & 1;
      v[bit] += bitVal ? 1 : -1;
    }
  }
  let out = 0n;
  for (let i = 0; i < 64; i++) {
    if (v[i] > 0) out |= 1n << BigInt(i);
  }
  return out;
}

// pathhash24: stable 24-bit hash from normalized path
export function pathhash24FromPath(p: string): number {
  const norm = p.replace(/\\\\/g, '/').replace(/^\/+/, '').toLowerCase();
  const h = crypto.createHash('sha256').update(norm).digest();
  // take first 3 bytes
  return (h[0] << 16) | (h[1] << 8) | h[2];
}

// crc8: simple CRC-8 (polynomial 0x07)
export function crc8(buf: Buffer | Uint8Array): number {
  // CRC-8-CCITT (poly 0x07) simple implementation
  let crc = 0x00;
  for (const b of buf) {
    crc ^= b;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x80) !== 0) crc = ((crc << 1) ^ 0x07) & 0xff;
      else crc = (crc << 1) & 0xff;
    }
  }
  return crc & 0xff;
}

export default { simhash64FromString, pathhash24FromPath, crc8 };


