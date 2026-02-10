import type {
  BootstrapResponse,
  ChunkEvictMsg,
  ChunkPatchMsg,
  ChunkSurfaceMsg,
  ChunkVoxelPatchMsg,
  ChunkVoxelsEvictMsg,
  ChunkVoxelsMsg,
  ObserverMsg,
  TickMsg,
} from "./protocol";
import { useObserverStore } from "../state/observerStore";

const PROTOCOL_VERSION = "0.1";

let ws: WebSocket | null = null;
let stopped = false;
let reconnectDelayMs = 250;
let reconnectTimer: number | undefined;
let unsubscribeCfg: (() => void) | undefined;

function wsURL() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/admin/v1/observer/ws`;
}

async function fetchBootstrap() {
  try {
    const r = await fetch("/admin/v1/observer/bootstrap");
    if (!r.ok) throw new Error(`bootstrap ${r.status}`);
    const b = (await r.json()) as BootstrapResponse;
    useObserverStore.getState().set_bootstrap(b);
  } catch (e) {
    useObserverStore.setState({
      error: `bootstrap: ${String(e)}`,
    });
  }
}

function sendSubscribe() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const {
    chunk_radius,
    max_chunks,
    view_mode,
    voxel_radius,
    voxel_max_chunks,
    follow_agent_id,
    selected_agent_id,
  } = useObserverStore.getState();

  const focus_agent_id =
    view_mode === "3D" ? (follow_agent_id ?? selected_agent_id ?? "") : "";
  const vr = view_mode === "3D" && focus_agent_id ? voxel_radius : 0;
  ws.send(
    JSON.stringify({
      type: "SUBSCRIBE",
      protocol_version: PROTOCOL_VERSION,
      chunk_radius,
      max_chunks,
      focus_agent_id,
      voxel_radius: vr,
      voxel_max_chunks,
    }),
  );
}

function handleMsg(msg: ObserverMsg) {
  const st = useObserverStore.getState();
  switch (msg.type) {
    case "TICK":
      st.ingest_tick(msg as TickMsg);
      return;
    case "CHUNK_SURFACE":
      st.ingest_chunk_surface(msg as ChunkSurfaceMsg);
      return;
    case "CHUNK_PATCH":
      st.ingest_chunk_patch(msg as ChunkPatchMsg);
      return;
    case "CHUNK_EVICT":
      st.ingest_chunk_evict(msg as ChunkEvictMsg);
      return;
    case "CHUNK_VOXELS":
      st.ingest_chunk_voxels(msg as ChunkVoxelsMsg);
      return;
    case "CHUNK_VOXEL_PATCH":
      st.ingest_chunk_voxel_patch(msg as ChunkVoxelPatchMsg);
      return;
    case "CHUNK_VOXELS_EVICT":
      st.ingest_chunk_voxels_evict(msg as ChunkVoxelsEvictMsg);
      return;
  }
}

function scheduleReconnect(reason?: string) {
  if (stopped) return;
  if (reconnectTimer) window.clearTimeout(reconnectTimer);
  useObserverStore.getState().set_connection(false, reason);
  reconnectTimer = window.setTimeout(() => {
    connect();
  }, reconnectDelayMs);
  reconnectDelayMs = Math.min(5000, Math.round(reconnectDelayMs * 1.7));
}

function connect() {
  if (stopped) return;

  useObserverStore.setState({ connecting: true, error: undefined });
  void fetchBootstrap();

  try {
    ws = new WebSocket(wsURL());
  } catch (e) {
    scheduleReconnect(`ws: ${String(e)}`);
    return;
  }

  ws.onopen = () => {
    reconnectDelayMs = 250;
    useObserverStore.getState().set_connection(true);
    sendSubscribe();
  };
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(String(ev.data)) as ObserverMsg;
      if (!msg || typeof msg !== "object" || typeof (msg as any).type !== "string") return;
      handleMsg(msg);
    } catch {
      // ignore
    }
  };
  ws.onerror = () => {
    // onclose will handle reconnect.
  };
  ws.onclose = (ev) => {
    ws = null;
    scheduleReconnect(`ws closed: ${ev.code}`);
  };
}

export function startObserverClient() {
  stopped = false;
  if (unsubscribeCfg) unsubscribeCfg();
  unsubscribeCfg = useObserverStore.subscribe(
    (s) =>
      [
        s.chunk_radius,
        s.max_chunks,
        s.view_mode,
        s.voxel_radius,
        s.voxel_max_chunks,
        s.follow_agent_id ?? "",
        s.selected_agent_id ?? "",
      ].join("|"),
    () => {
      sendSubscribe();
    },
  );
  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    if (unsubscribeCfg) unsubscribeCfg();
    unsubscribeCfg = undefined;
    ws?.close();
    ws = null;
  };
}
