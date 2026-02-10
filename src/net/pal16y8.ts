export type DecodedPAL16Y8 = {
  blocks: Uint16Array;
  ys: Uint8Array;
};

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    if (typeof atob === "function") {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
      return out;
    }
    // Node/test fallback.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const B: any = (globalThis as any).Buffer;
    if (B && typeof B.from === "function") {
      return new Uint8Array(B.from(b64, "base64"));
    }
    return null;
  } catch {
    return null;
  }
}

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

