import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import type {
  AuditEntry,
  BootstrapResponse,
  ChunkEvictMsg,
  ChunkPatchMsg,
  ChunkSurfaceMsg,
  TickMsg,
} from "../net/protocol";
import { decodePAL16Y8 } from "../net/pal16y8";

export type ChunkSurface = {
  cx: number;
  cz: number;
  blocks: Uint16Array;
  ys: Uint8Array;
};

export type ActivityItem = {
  tick: number;
  text: string;
  agent_id?: string;
};

type RecentAudit = AuditEntry & { born_tick: number };

type ObserverStore = {
  connected: boolean;
  connecting: boolean;
  error?: string;

  bootstrap?: BootstrapResponse;

  tick: number;
  time_of_day: number;
  weather: string;
  active_event_id?: string;
  active_event_ends_tick?: number;

  chunk_radius: number;
  max_chunks: number;

  chunks: Map<string, ChunkSurface>;
  agents_by_id: Map<string, TickMsg["agents"][number]>;

  selected_agent_id?: string;
  follow_agent_id?: string;

  activity: ActivityItem[];
  recent_audits: RecentAudit[];

  set_connection: (connected: boolean, error?: string) => void;
  set_bootstrap: (b: BootstrapResponse) => void;
  select_agent: (id?: string) => void;
  set_follow: (id?: string) => void;
  set_chunk_radius: (r: number) => void;

  ingest_tick: (m: TickMsg) => void;
  ingest_chunk_surface: (m: ChunkSurfaceMsg) => void;
  ingest_chunk_patch: (m: ChunkPatchMsg) => void;
  ingest_chunk_evict: (m: ChunkEvictMsg) => void;
};

function chunkKey(cx: number, cz: number) {
  return `${cx},${cz}`;
}

function formatAudit(a: AuditEntry) {
  const [x, y, z] = a.pos;
  const what = a.reason ? ` ${a.reason}` : "";
  return `[t${a.tick}] AUDIT ${a.actor} ${a.action}${what} @ ${x},${y},${z} (${a.from}->${a.to})`;
}

function formatAct(agentId: string, act: any, tick: number): string[] {
  const lines: string[] = [];
  const instants = Array.isArray(act?.instants) ? act.instants : [];
  const tasks = Array.isArray(act?.tasks) ? act.tasks : [];
  const cancel = Array.isArray(act?.cancel) ? act.cancel : [];

  for (const i of instants) {
    const typ = String(i?.type ?? "INSTANT");
    if (typ === "SAY") {
      lines.push(
        `[t${tick}] ACT ${agentId} SAY(${String(i?.channel ?? "")}) ${String(i?.text ?? "")}`,
      );
    } else if (typ === "WHISPER") {
      lines.push(
        `[t${tick}] ACT ${agentId} WHISPER(${String(i?.to ?? "")}) ${String(i?.text ?? "")}`,
      );
    } else {
      lines.push(`[t${tick}] ACT ${agentId} ${typ}`);
    }
  }

  for (const t of tasks) {
    const typ = String(t?.type ?? "TASK");
    if (typ === "MOVE_TO") {
      const target = Array.isArray(t?.target) ? t.target.join(",") : "";
      lines.push(`[t${tick}] ACT ${agentId} MOVE_TO ${target}`);
    } else if (typ === "FOLLOW") {
      lines.push(`[t${tick}] ACT ${agentId} FOLLOW ${String(t?.target_id ?? "")}`);
    } else if (typ === "MINE") {
      const pos = Array.isArray(t?.block_pos) ? t.block_pos.join(",") : "";
      lines.push(`[t${tick}] ACT ${agentId} MINE ${pos}`);
    } else if (typ === "PLACE") {
      const pos = Array.isArray(t?.block_pos) ? t.block_pos.join(",") : "";
      lines.push(`[t${tick}] ACT ${agentId} PLACE ${pos} ${String(t?.item_id ?? "")}`);
    } else {
      lines.push(`[t${tick}] ACT ${agentId} ${typ}`);
    }
  }

  for (const id of cancel) {
    lines.push(`[t${tick}] ACT ${agentId} CANCEL ${String(id)}`);
  }

  return lines;
}

function pushActivity(prev: ActivityItem[], next: ActivityItem, max = 200) {
  const out = [next, ...prev];
  if (out.length > max) out.length = max;
  return out;
}

export const useObserverStore = create<ObserverStore>()(
  subscribeWithSelector((set, get) => ({
  connected: false,
  connecting: false,
  error: undefined,

  bootstrap: undefined,

  tick: 0,
  time_of_day: 0,
  weather: "UNKNOWN",
  active_event_id: undefined,
  active_event_ends_tick: undefined,

  chunk_radius: 6,
  max_chunks: 1024,

  chunks: new Map(),
  agents_by_id: new Map(),

  selected_agent_id: undefined,
  follow_agent_id: undefined,

  activity: [],
  recent_audits: [],

  set_connection: (connected, error) => {
    set({ connected, connecting: false, error });
  },

  set_bootstrap: (b) => {
    set({ bootstrap: b });
  },

  select_agent: (id) => {
    set({ selected_agent_id: id });
  },

  set_follow: (id) => {
    set({ follow_agent_id: id });
  },

  set_chunk_radius: (r) => {
    const rr = Math.max(1, Math.min(32, Math.floor(r)));
    set({ chunk_radius: rr });
  },

  ingest_tick: (m) => {
    const prevActivity = get().activity;
    let activity = prevActivity;

    if (Array.isArray(m.joins)) {
      for (const j of m.joins) {
        activity = pushActivity(activity, {
          tick: m.tick,
          text: `[t${m.tick}] JOIN ${j.agent_id} ${j.name}`,
          agent_id: j.agent_id,
        });
      }
    }
    if (Array.isArray(m.leaves)) {
      for (const id of m.leaves) {
        activity = pushActivity(activity, { tick: m.tick, text: `[t${m.tick}] LEAVE ${id}`, agent_id: id });
      }
    }
    if (Array.isArray(m.actions)) {
      for (const a of m.actions) {
        const lines = formatAct(a.agent_id, a.act, m.tick);
        for (const line of lines) {
          activity = pushActivity(activity, { tick: m.tick, text: line, agent_id: a.agent_id });
        }
      }
    }
    if (Array.isArray(m.audits)) {
      for (const a of m.audits) {
        activity = pushActivity(activity, { tick: m.tick, text: formatAudit(a), agent_id: a.actor });
      }
    }

    const agents = new Map<string, TickMsg["agents"][number]>();
    for (const a of m.agents ?? []) {
      agents.set(a.id, a);
    }

    // Keep recent audits for overlay (tick-based TTL).
    const ttl = 50;
    const bornTick = m.tick;
    const nextRecent = (get().recent_audits ?? [])
      .filter((x) => bornTick-x.born_tick <= ttl)
      .slice(0, 400);
    if (Array.isArray(m.audits)) {
      for (const a of m.audits) {
        nextRecent.unshift({ ...a, born_tick: bornTick });
      }
    }

    set({
      tick: m.tick,
      time_of_day: m.time_of_day,
      weather: m.weather,
      active_event_id: m.active_event_id,
      active_event_ends_tick: m.active_event_ends_tick,
      agents_by_id: agents,
      activity,
      recent_audits: nextRecent,
    });
  },

  ingest_chunk_surface: (m) => {
    if (m.encoding !== "PAL16_Y8") return;
    const decoded = decodePAL16Y8(m.data);
    if (!decoded) return;

    const key = chunkKey(m.cx, m.cz);
    const next = new Map(get().chunks);
    next.set(key, { cx: m.cx, cz: m.cz, blocks: decoded.blocks, ys: decoded.ys });
    set({ chunks: next });
  },

  ingest_chunk_patch: (m) => {
    const key = chunkKey(m.cx, m.cz);
    const prev = get().chunks.get(key);
    if (!prev) return;
    if (!Array.isArray(m.cells) || m.cells.length === 0) return;

    // Copy-on-write typed arrays to keep store updates immutable.
    const blocks = new Uint16Array(prev.blocks);
    const ys = new Uint8Array(prev.ys);
    for (const c of m.cells) {
      const x = c.x | 0;
      const z = c.z | 0;
      if (x < 0 || x >= 16 || z < 0 || z >= 16) continue;
      const idx = z * 16 + x;
      blocks[idx] = c.block;
      ys[idx] = c.y;
    }
    const next = new Map(get().chunks);
    next.set(key, { cx: prev.cx, cz: prev.cz, blocks, ys });
    set({ chunks: next });
  },

  ingest_chunk_evict: (m) => {
    const key = chunkKey(m.cx, m.cz);
    const next = new Map(get().chunks);
    next.delete(key);
    set({ chunks: next });
  },
  })),
);
