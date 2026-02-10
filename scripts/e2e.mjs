import { spawn } from "node:child_process";
import fs from "node:fs";
import * as net from "node:net";
import path from "node:path";
import process from "node:process";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttpOk(url, timeoutMs) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for ${url}`);
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // ignore
    }
    await sleep(150);
  }
}

function spawnProc(name, cmd, args, opts = {}) {
  const p = spawn(cmd, args, {
    stdio: "inherit",
    ...opts,
  });
  p.on("exit", (code, signal) => {
    if (code !== 0) {
      // This is informational; the caller will decide if it is fatal.
      console.warn(`[e2e] ${name} exited code=${code} signal=${signal ?? ""}`);
    }
  });
  return p;
}

function waitExit(p, name) {
  return new Promise((resolve, reject) => {
    p.on("exit", (code, signal) => {
      if (code === 0) return resolve();
      reject(new Error(`${name} exited code=${code} signal=${signal ?? ""}`));
    });
  });
}

function killProc(p, name) {
  if (!p || p.killed) return;
  try {
    p.kill("SIGTERM");
  } catch {
    return;
  }
  setTimeout(() => {
    if (p.killed) return;
    try {
      p.kill("SIGKILL");
    } catch {
      // ignore
    }
  }, 2000);
}

function readStateJson(p) {
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}

async function getFreePort(host) {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, host, () => {
      const addr = s.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      s.close(() => resolve(port));
    });
  });
}

async function main() {
  const outDir = path.join("output", "web-game-e2e");
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  let mock = null;
  let vite = null;
  const host = "127.0.0.1";
  const mockPort = await getFreePort(host);
  const vitePort = await getFreePort(host);

  const cleanup = () => {
    killProc(vite, "vite");
    killProc(mock, "mock");
  };
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });

  try {
    mock = spawnProc("mock", "node", ["scripts/mock_voxelcraft_ai_observer.mjs"], {
      env: { ...process.env, MOCK_HOST: host, MOCK_PORT: String(mockPort) },
    });
    await waitForHttpOk(`http://${host}:${mockPort}/admin/v1/observer/bootstrap`, 8000);

    vite = spawnProc("vite", "npm", ["run", "dev", "--", "--host", host, "--port", String(vitePort)], {
      env: { ...process.env, VOXELCRAFT_AI_URL: `http://${host}:${mockPort}` },
    });
    await waitForHttpOk(`http://${host}:${vitePort}/`, 15000);

    const actions = { steps: [{ buttons: [], frames: 180 }] };
    const pw = spawnProc("playwright-client", "node", [
      "scripts/web_game_playwright_client.js",
      "--url",
      `http://${host}:${vitePort}`,
      "--click-selector",
      "[data-testid=view-3d]",
      "--actions-json",
      JSON.stringify(actions),
      "--iterations",
      "2",
      "--pause-ms",
      "50",
      "--headless",
      "1",
      "--screenshot-dir",
      outDir,
    ]);
    await waitExit(pw, "playwright-client");

    const state0 = path.join(outDir, "state-0.json");
    const state1 = path.join(outDir, "state-1.json");
    const shot0 = path.join(outDir, "shot-0.png");
    const shot1 = path.join(outDir, "shot-1.png");

    if (!fs.existsSync(state1) || !fs.existsSync(shot1)) throw new Error("missing e2e artifacts");

    const s0 = readStateJson(state0);
    const s1 = readStateJson(state1);

    if (!s0.connected || !s1.connected) throw new Error("expected connected=true");
    if (!(s1.tick > s0.tick)) throw new Error(`expected tick to increase (t0=${s0.tick} t1=${s1.tick})`);
    if (s1.agents_count !== 2) throw new Error(`expected agents_count=2 (got ${s1.agents_count})`);
    if (s1.chunks_loaded <= 0) throw new Error(`expected chunks_loaded>0 (got ${s1.chunks_loaded})`);
    if (s1.view_mode !== "3D") throw new Error(`expected view_mode=3D (got ${s1.view_mode})`);
    if (s1.voxels_loaded <= 0) throw new Error(`expected voxels_loaded>0 (got ${s1.voxels_loaded})`);

    for (const p of [shot0, shot1]) {
      const st = fs.statSync(p);
      if (st.size < 4096) throw new Error(`screenshot too small: ${p} (${st.size} bytes)`);
    }

    const errors = fs.readdirSync(outDir).filter((n) => /^errors-\d+\.json$/.test(n));
    if (errors.length) throw new Error(`console errors captured: ${errors.join(", ")}`);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error("[e2e] FAIL:", err);
  process.exit(1);
});
