import http from "node:http";
import { WebSocketServer } from "ws";

const HOST = process.env.MOCK_HOST ?? "127.0.0.1";
const PORT = Number(process.env.MOCK_PORT ?? process.env.PORT ?? "8080");

const OBS_VERSION = "0.1";
const HEIGHT = Number(process.env.MOCK_HEIGHT ?? "1");

// Palette indices are the "block ids" used in CHUNK_SURFACE / CHUNK_PATCH.
const block_palette = [
  "AIR", // 0
  "DIRT", // 1
  "GRASS", // 2
  "SAND", // 3
  "STONE", // 4
  "WATER", // 5
  "ICE", // 6
  "PLANK", // 7
  "LOG", // 8
  "BRICK", // 9
  "GLASS", // 10
];

function voxKey(cx, cz) {
  return `${cx},${cz}`;
}

function surfaceB64(cx, cz) {
  const buf = Buffer.alloc(16 * 16 * 3);
  for (let z = 0; z < 16; z++) {
    for (let x = 0; x < 16; x++) {
      const i = z * 16 + x;
      const off = i * 3;

      // Two-tone pattern + a river stripe to make changes visible in screenshots.
      let block = (x + z + cx + cz) % 2 === 0 ? 2 : 3; // GRASS/SAND
      if (x === 7 || x === 8) block = 5; // WATER stripe

      const y = HEIGHT <= 1 ? 0 : 18 + ((x * 3 + z * 5 + cx * 7 + cz * 11) % 12);

      buf[off] = block & 0xff;
      buf[off + 1] = (block >> 8) & 0xff;
      buf[off + 2] = y & 0xff;
    }
  }
  return buf.toString("base64");
}

const voxelsByChunk = new Map();

function ensureChunkVoxels(cx, cz) {
  const k = voxKey(cx, cz);
  let blocks = voxelsByChunk.get(k);
  if (blocks) return blocks;

  blocks = new Uint16Array(16 * 16 * HEIGHT);
  for (let z = 0; z < 16; z++) {
    for (let x = 0; x < 16; x++) {
      if (HEIGHT <= 1) {
        // Mirror CHUNK_SURFACE's 2D pattern on the single y=0 layer.
        let block = (x + z + cx + cz) % 2 === 0 ? 2 : 3; // GRASS/SAND
        if (x === 7 || x === 8) block = 5; // WATER stripe
        blocks[x + z * 16] = block;
        continue;
      }

      const yTop = 18 + ((x * 3 + z * 5 + cx * 7 + cz * 11) % 12);
      for (let y = 0; y < HEIGHT; y++) {
        let b = 0; // AIR
        if (y <= yTop) b = y === yTop ? 2 : 4; // GRASS on top, STONE below
        if (y > yTop && y <= 20) b = 5; // WATER up to sea level
        const idx = x + z * 16 + y * 16 * 16;
        blocks[idx] = b;
      }
    }
  }

  // A small pillar in chunk (0,0) so 3D has something vertical (only if height allows it).
  if (HEIGHT > 34 && cx === 0 && cz === 0) {
    const px = 9;
    const pz = 9;
    for (let y = 22; y <= 32; y++) {
      blocks[px + pz * 16 + y * 16 * 16] = 9; // BRICK
    }
    blocks[px + pz * 16 + 33 * 16 * 16] = 10; // GLASS cap
  }

  voxelsByChunk.set(k, blocks);
  return blocks;
}

function voxelsB64(cx, cz) {
  const blocks = ensureChunkVoxels(cx, cz);
  const buf = Buffer.alloc(blocks.length * 2);
  for (let i = 0; i < blocks.length; i++) {
    const v = blocks[i];
    buf[i * 2] = v & 0xff;
    buf[i * 2 + 1] = (v >> 8) & 0xff;
  }
  return buf.toString("base64");
}

function json(res, code, body) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/admin/v1/observer/bootstrap") {
    return json(res, 200, {
      protocol_version: OBS_VERSION,
      world_id: "mock_world",
      tick: 1,
      world_params: {
        tick_rate_hz: 5,
        chunk_size: [16, 16, HEIGHT],
        height: HEIGHT,
        seed: 1337,
        boundary_r: 4000,
      },
      block_palette,
    });
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/admin/v1/observer/ws") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", (ws) => {
  let tick = 1;
  let timer = null;
  let voxelsEnabled = false;

  const send = (obj) => {
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      // ignore
    }
  };

  const start = () => {
    // Initial surfaces.
    send({ type: "CHUNK_SURFACE", protocol_version: OBS_VERSION, cx: 0, cz: 0, encoding: "PAL16_Y8", data: surfaceB64(0, 0) });
    send({ type: "CHUNK_SURFACE", protocol_version: OBS_VERSION, cx: 1, cz: 0, encoding: "PAL16_Y8", data: surfaceB64(1, 0) });
    send({ type: "CHUNK_SURFACE", protocol_version: OBS_VERSION, cx: -1, cz: 0, encoding: "PAL16_Y8", data: surfaceB64(-1, 0) });

    if (voxelsEnabled) {
      send({ type: "CHUNK_VOXELS", protocol_version: OBS_VERSION, cx: 0, cz: 0, encoding: "PAL16_U16LE_YZX", data: voxelsB64(0, 0) });
      send({ type: "CHUNK_VOXELS", protocol_version: OBS_VERSION, cx: 1, cz: 0, encoding: "PAL16_U16LE_YZX", data: voxelsB64(1, 0) });
      send({ type: "CHUNK_VOXELS", protocol_version: OBS_VERSION, cx: -1, cz: 0, encoding: "PAL16_U16LE_YZX", data: voxelsB64(-1, 0) });
    }

    timer = setInterval(() => {
      tick++;

      const a1x = 2 + (tick % 18);
      const a1z = 2 + ((tick * 2) % 12);
      const a2x = 28 - ((tick * 3) % 20);
      const a2z = 12 + ((tick * 2) % 10);

      const audits = [];
      const patches = [];
      const voxelPatches = [];

      // Every few ticks, flip one surface cell between GRASS and WATER.
      if (tick % 4 === 0) {
        const x = 9;
        const z = 9;
        const block = tick % 8 === 0 ? 2 : 5; // GRASS/WATER
        const y = HEIGHT <= 1 ? 0 : 22;
        patches.push({ x, z, block, y });
        voxelPatches.push({ x, y, z, block });

        // Keep voxel state consistent for the chunk (0,0).
        const blocks = ensureChunkVoxels(0, 0);
        const idx = HEIGHT <= 1 ? x + z * 16 : x + z * 16 + 22 * 16 * 16;
        blocks[idx] = block;
        audits.push({
          tick,
          actor: "A01",
          action: "SET_BLOCK",
          pos: [x, HEIGHT <= 1 ? 0 : 22, z],
          from: block === 5 ? 2 : 5,
          to: block,
          reason: "BUILD_BLUEPRINT",
        });
      }

      if (patches.length) {
        send({
          type: "CHUNK_PATCH",
          protocol_version: OBS_VERSION,
          cx: 0,
          cz: 0,
          cells: patches,
        });
      }
      if (voxelsEnabled && voxelPatches.length) {
        send({
          type: "CHUNK_VOXEL_PATCH",
          protocol_version: OBS_VERSION,
          cx: 0,
          cz: 0,
          cells: voxelPatches,
        });
      }

      send({
        type: "TICK",
        protocol_version: OBS_VERSION,
        tick,
        time_of_day: ((tick % 6000) / 6000),
        weather: tick % 30 < 20 ? "CLEAR" : "STORM",
        active_event_id: "",
        active_event_ends_tick: 0,
        agents: [
          {
            id: "A01",
            name: "bot1",
            connected: true,
            org_id: "",
            pos: [a1x, 22, a1z],
            yaw: (tick * 12) % 360,
            hp: 20,
            hunger: 10,
            stamina_milli: 900,
            move_task: { kind: "MOVE_TO", target: [a1x + 5, 22, a1z + 3], progress: 0.4, eta_ticks: 12 },
            work_task: { kind: "MINE", progress: 0.7 },
          },
          {
            id: "A02",
            name: "bot2",
            connected: true,
            org_id: "",
            pos: [a2x, 22, a2z],
            yaw: (tick * 7) % 360,
            hp: 18,
            hunger: 12,
            stamina_milli: 820,
            move_task: { kind: "FOLLOW", target_id: "A01", target: [a1x, 22, a1z], progress: 0.1, eta_ticks: 30 },
          },
        ],
        joins: tick === 2 ? [{ agent_id: "A02", name: "bot2" }] : [],
        leaves: [],
        actions: [
          {
            agent_id: "A01",
            act: {
              type: "ACT",
              protocol_version: "0.9",
              tick,
              agent_id: "A01",
              instants: tick % 10 === 0 ? [{ id: "I1", type: "SAY", channel: "LOCAL", text: "hello" }] : [],
              tasks: [],
            },
          },
        ],
        audits,
      });
    }, 200);
  };

  let subscribed = false;
  const subTimer = setTimeout(() => {
    if (subscribed) return;
    try {
      ws.close(1008, "expected SUBSCRIBE");
    } catch {
      // ignore
    }
  }, 5000);

  ws.on("message", (data) => {
    let msg = null;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    if (!msg || msg.type !== "SUBSCRIBE" || msg.protocol_version !== OBS_VERSION) return;
    // Enable voxels when requested by client.
    const vr = Number(msg.voxel_radius ?? 0);
    voxelsEnabled = Number.isFinite(vr) && vr > 0;
    subscribed = true;
    clearTimeout(subTimer);
    if (!timer) start();

    // If the client toggles voxels after start, push current chunks immediately.
    if (timer && voxelsEnabled) {
      send({ type: "CHUNK_VOXELS", protocol_version: OBS_VERSION, cx: 0, cz: 0, encoding: "PAL16_U16LE_YZX", data: voxelsB64(0, 0) });
      send({ type: "CHUNK_VOXELS", protocol_version: OBS_VERSION, cx: 1, cz: 0, encoding: "PAL16_U16LE_YZX", data: voxelsB64(1, 0) });
      send({ type: "CHUNK_VOXELS", protocol_version: OBS_VERSION, cx: -1, cz: 0, encoding: "PAL16_U16LE_YZX", data: voxelsB64(-1, 0) });
    }
  });

  ws.on("close", () => {
    clearTimeout(subTimer);
    if (timer) clearInterval(timer);
    timer = null;
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[mock] listening on http://${HOST}:${PORT}`);
});
