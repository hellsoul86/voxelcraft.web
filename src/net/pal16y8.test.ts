import { describe, expect, it } from "vitest";

import { decodePAL16Y8 } from "./pal16y8";
import { useObserverStore } from "../state/observerStore";

describe("PAL16_Y8", () => {
  it("decodes little-endian u16 + y", () => {
    const bytes = new Uint8Array(16 * 16 * 3);
    bytes[0] = 0x34;
    bytes[1] = 0x12;
    bytes[2] = 21;
    const b64 = Buffer.from(bytes).toString("base64");

    const out = decodePAL16Y8(b64);
    expect(out).not.toBeNull();
    expect(out!.blocks[0]).toBe(0x1234);
    expect(out!.ys[0]).toBe(21);
  });

  it("rejects wrong length", () => {
    expect(decodePAL16Y8("AA==")).toBeNull();
  });

  it("applies CHUNK_PATCH to store surface arrays", () => {
    const bytes = new Uint8Array(16 * 16 * 3);
    const b64 = Buffer.from(bytes).toString("base64");
    const decoded = decodePAL16Y8(b64)!;

    const key = "0,0";
    useObserverStore.setState({
      chunks: new Map([[key, { cx: 0, cz: 0, blocks: decoded.blocks, ys: decoded.ys }]]),
    });

    useObserverStore.getState().ingest_chunk_patch({
      type: "CHUNK_PATCH",
      protocol_version: "0.1",
      cx: 0,
      cz: 0,
      cells: [{ x: 3, z: 9, block: 12, y: 33 }],
    });

    const after = useObserverStore.getState().chunks.get(key)!;
    const idx = 9 * 16 + 3;
    expect(after.blocks[idx]).toBe(12);
    expect(after.ys[idx]).toBe(33);
  });
});

