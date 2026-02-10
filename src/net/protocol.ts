export type WorldParams = {
  tick_rate_hz: number;
  chunk_size: [number, number, number];
  height: number;
  seed: number;
  boundary_r: number;
};

export type BootstrapResponse = {
  protocol_version: string;
  world_id: string;
  tick: number;
  world_params: WorldParams;
  block_palette: string[];
};

export type AgentTask = {
  kind: string;
  target_id?: string;
  target?: [number, number, number];
  progress: number;
  eta_ticks?: number;
};

export type AgentState = {
  id: string;
  name: string;
  connected: boolean;
  org_id?: string;
  pos: [number, number, number];
  yaw: number;
  hp: number;
  hunger: number;
  stamina_milli: number;
  move_task?: AgentTask;
  work_task?: AgentTask;
};

export type JoinInfo = { agent_id: string; name: string };

export type RecordedAction = { agent_id: string; act: unknown };

export type AuditEntry = {
  tick: number;
  actor: string;
  action: string;
  pos: [number, number, number];
  from: number;
  to: number;
  reason?: string;
};

export type TickMsg = {
  type: "TICK";
  protocol_version: string;
  tick: number;
  time_of_day: number;
  weather: string;
  active_event_id?: string;
  active_event_ends_tick?: number;
  agents: AgentState[];
  joins?: JoinInfo[];
  leaves?: string[];
  actions?: RecordedAction[];
  audits?: AuditEntry[];
};

export type ChunkSurfaceMsg = {
  type: "CHUNK_SURFACE";
  protocol_version: string;
  cx: number;
  cz: number;
  encoding: "PAL16_Y8";
  data: string;
};

export type ChunkPatchCell = { x: number; z: number; block: number; y: number };

export type ChunkPatchMsg = {
  type: "CHUNK_PATCH";
  protocol_version: string;
  cx: number;
  cz: number;
  cells: ChunkPatchCell[];
};

export type ChunkEvictMsg = {
  type: "CHUNK_EVICT";
  protocol_version: string;
  cx: number;
  cz: number;
};

export type ObserverMsg = TickMsg | ChunkSurfaceMsg | ChunkPatchMsg | ChunkEvictMsg;

