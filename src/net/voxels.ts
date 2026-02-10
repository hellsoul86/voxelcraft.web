import { base64ToBytes } from "./base64";

export function decodePAL16U16LEYZX(b64: string, height: number): Uint16Array | null {
  const h = Math.max(0, Math.floor(height));
  const bytes = base64ToBytes(b64);
  if (!bytes || bytes.length !== 16 * 16 * h * 2) return null;

  const blocks = new Uint16Array(16 * 16 * h);
  for (let i = 0; i < blocks.length; i++) {
    const off = i * 2;
    blocks[i] = bytes[off] | (bytes[off + 1] << 8);
  }
  return blocks;
}

