import { describe, expect, it } from "vitest";

import { decodePAL16Y8 } from "./pal16y8";
import { decodePAL16U16LEYZX } from "./voxels";
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

describe("PAL16_U16LE_YZX", () => {
  it("decodes little-endian u16 blocks", () => {
    const height = 4;
    const bytes = Buffer.alloc(16 * 16 * height * 2);
    bytes[0] = 0x34;
    bytes[1] = 0x12;
    const b64 = bytes.toString("base64");

    const out = decodePAL16U16LEYZX(b64, height);
    expect(out).not.toBeNull();
    expect(out![0]).toBe(0x1234);
  });

  it("applies CHUNK_VOXEL_PATCH to store voxel arrays", () => {
    const height = 4;
    const blocks = new Uint16Array(16 * 16 * height);
    const key = "0,0";
    useObserverStore.setState({
      voxels: new Map([[key, { cx: 0, cz: 0, blocks }]]),
      bootstrap: {
        protocol_version: "0.1",
        world_id: "t",
        tick: 1,
        world_params: {
          tick_rate_hz: 5,
          chunk_size: [16, 16, height],
          height,
          seed: 1,
          boundary_r: 10,
        },
        block_palette: ["AIR"],
      },
    });

    useObserverStore.getState().ingest_chunk_voxel_patch({
      type: "CHUNK_VOXEL_PATCH",
      protocol_version: "0.1",
      cx: 0,
      cz: 0,
      cells: [{ x: 1, y: 2, z: 3, block: 7 }],
    });

    const after = useObserverStore.getState().voxels.get(key)!;
    const idx = 1 + 3 * 16 + 2 * 16 * 16;
    expect(after.blocks[idx]).toBe(7);
  });
});
