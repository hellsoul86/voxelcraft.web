import { base64ToBytes } from "./base64";

export type DecodedPAL16Y8 = {
  blocks: Uint16Array;
  ys: Uint8Array;
};

export function decodePAL16Y8(b64: string): DecodedPAL16Y8 | null {
  const bytes = base64ToBytes(b64);
  if (!bytes || bytes.length !== 16 * 16 * 3) return null;

  const blocks = new Uint16Array(16 * 16);
  const ys = new Uint8Array(16 * 16);
  for (let i = 0; i < 16 * 16; i++) {
    const off = i * 3;
    const lo = bytes[off];
    const hi = bytes[off + 1];
    blocks[i] = lo | (hi << 8);
    ys[i] = bytes[off + 2];
  }
  return { blocks, ys };
}
