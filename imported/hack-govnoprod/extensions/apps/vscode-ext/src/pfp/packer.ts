import { simhash64FromString, pathhash24FromPath, crc8 } from './fingerprints';

function writeBits(buffer: Uint8Array, bitOffset: number, value: bigint, length: number) {
  for (let i = 0; i < length; i++) {
    const bit = Number((value >> BigInt(i)) & 1n);
    const idx = Math.floor((bitOffset + i) / 8);
    const off = (bitOffset + i) % 8;
    buffer[idx] |= bit << off;
  }
}

export function packProfile(opts: { schema_id: number; flags: number; tier: number; corePlanes: bigint[]; extendedPlanes?: bigint[]; hpcMask?: bigint; qBuckets?: number[]; enums?: number[]; simhash?: bigint; pathhash24?: number; crc?: number }): string {
  // minimal packer for full-tier subset; produce Uint8Array and Base85 encode (simple Ascii85)
  const buf = new Uint8Array(256);
  // header 32 bits
  const header = (BigInt(opts.schema_id & 0xfff) << 20n) | (BigInt(opts.flags & 0xfff) << 8n) | BigInt(opts.tier & 0xf);
  writeBits(buf, 0, header, 32);
  let offset = 32;
  // core planes C0..C3 (4 * 64)
  for (let i = 0; i < Math.min(4, opts.corePlanes.length); i++) {
    writeBits(buf, offset, opts.corePlanes[i], 64);
    offset += 64;
  }
  // HPC 64 — always include when provided, even if 0n
  if (typeof opts.hpcMask !== 'undefined') { writeBits(buf, offset, opts.hpcMask as bigint, 64); offset += 64; }
  // Q buckets (pack 24*3 bits = 72)
  if (opts.qBuckets) {
    for (let i = 0; i < Math.min(24, opts.qBuckets.length); i++) {
      writeBits(buf, offset + i * 3, BigInt(opts.qBuckets[i] & 0x7), 3);
    }
    offset += 72;
  }
  // enums (16*5 = 80)
  if (opts.enums) {
    for (let i = 0; i < Math.min(16, opts.enums.length); i++) {
      writeBits(buf, offset + i * 5, BigInt(opts.enums[i] & 0x1f), 5);
    }
    offset += 80;
  }
  // IDs (simhash64 | pathhash24 | crc8)
  if (typeof opts.simhash !== 'undefined') { writeBits(buf, offset, opts.simhash as bigint, 64); offset += 64; }
  if (typeof opts.pathhash24 === 'number') { writeBits(buf, offset, BigInt(opts.pathhash24 & 0xffffff), 24); offset += 24; }
  if (typeof opts.crc === 'number') { writeBits(buf, offset, BigInt(opts.crc & 0xff), 8); offset += 8; }

  // slice used bytes
  const used = Math.ceil(offset / 8);
  const out = buf.slice(0, used);
  // Encode with Ascii85 (base85) per spec — simple local implementation
  const encoded = ascii85Encode(Buffer.from(out));
  return 'pfp2:' + encoded;
}

function ascii85Encode(buf: Buffer): string {
  const chars: string[] = [];
  const n = buf.length;
  const base = 85;
  for (let i = 0; i < n; i += 4) {
    const chunk = buf.slice(i, i + 4);
    let value = 0 >>> 0;
    for (let j = 0; j < 4; j++) {
      value = (value << 8) >>> 0;
      if (j < chunk.length) value |= chunk[j];
    }
    // if chunk length < 4, pad with zeros — output fewer chars later
    const outChars: number[] = [];
    for (let k = 0; k < 5; k++) {
      outChars.push(value % base);
      value = Math.floor(value / base) >>> 0;
    }
    // outChars currently little-endian; reverse
    outChars.reverse();
    const pad = 4 - chunk.length;
    const take = 5 - pad;
    for (let t = 0; t < take; t++) {
      chars.push(String.fromCharCode(33 + outChars[t]));
    }
  }
  return chars.join('');
}

export default { packProfile };


