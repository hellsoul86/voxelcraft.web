export function base64ToBytes(b64: string): Uint8Array | null {
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

