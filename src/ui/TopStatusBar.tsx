import React from "react";

type Props = {
  connected: boolean;
  world_id?: string;
  tick: number;
  weather: string;
  time_of_day: number;
  active_event_id?: string;
  active_event_ends_tick?: number;
};

export function TopStatusBar(p: Props) {
  const dotClass = p.connected ? "status-dot ok" : "status-dot bad";
  const tod = Math.round(p.time_of_day * 100);

  return (
    <div className="topbar">
      <div className="left">
        <div className="brand">VoxelCraft 观测台</div>
        <div className={dotClass} title={p.connected ? "connected" : "disconnected"} />
        <div className="badge">{p.world_id ?? "world"}</div>
        <div className="badge">tick={p.tick}</div>
        <div className="badge">tod={tod}%</div>
        <div className="badge">weather={p.weather}</div>
        {p.active_event_id ? (
          <div className="badge">
            event={p.active_event_id} (ends t{p.active_event_ends_tick ?? 0})
          </div>
        ) : null}
      </div>
      <div className="badge">/admin/v1/observer</div>
    </div>
  );
}

