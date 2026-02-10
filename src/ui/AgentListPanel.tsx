import React, { useMemo, useState } from "react";

import { useObserverStore } from "../state/observerStore";

export function AgentListPanel() {
  const agentsById = useObserverStore((s) => s.agents_by_id);
  const selected = useObserverStore((s) => s.selected_agent_id);
  const follow = useObserverStore((s) => s.follow_agent_id);
  const chunkRadius = useObserverStore((s) => s.chunk_radius);
  const chunksLoaded = useObserverStore((s) => s.chunks.size);
  const setChunkRadius = useObserverStore((s) => s.set_chunk_radius);
  const selectAgent = useObserverStore((s) => s.select_agent);
  const setFollow = useObserverStore((s) => s.set_follow);

  const [q, setQ] = useState("");

  const agents = useMemo(() => {
    const all = [...agentsById.values()];
    all.sort((a, b) => {
      if (a.connected !== b.connected) return a.connected ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
    const qq = q.trim().toLowerCase();
    if (!qq) return all;
    return all.filter((a) => (a.name || "").toLowerCase().includes(qq) || a.id.toLowerCase().includes(qq));
  }, [agentsById, q]);

  const selectedAgent = selected ? agentsById.get(selected) : undefined;
  const isFollowing = selected && follow === selected;

  return (
    <>
      <div className="section">
        <h3>Agent 列表</h3>
        <input
          type="search"
          placeholder="搜索 name / id"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="row">
          <label>观测半径 (chunk)</label>
          <output>{chunkRadius}</output>
        </div>
        <input
          type="range"
          min={1}
          max={16}
          value={chunkRadius}
          onChange={(e) => setChunkRadius(Number(e.target.value))}
        />
        <div className="row">
          <label>已加载 chunks</label>
          <output>{chunksLoaded}</output>
        </div>
      </div>

      {selectedAgent ? (
        <div className="section">
          <h3>已选中</h3>
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>
            {selectedAgent.name} ({selectedAgent.id})
          </div>
          <div style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 12 }}>
            坐标: {selectedAgent.pos[0]},{selectedAgent.pos[1]},{selectedAgent.pos[2]}
          </div>
          <div style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>
            任务: move={selectedAgent.move_task?.kind ?? "-"} | work={selectedAgent.work_task?.kind ?? "-"}
          </div>
          <div style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>
            状态: hp={selectedAgent.hp} hunger={selectedAgent.hunger} stamina={selectedAgent.stamina_milli}
          </div>
          <div className="row">
            <button
              onClick={() => setFollow(isFollowing ? undefined : selectedAgent.id)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.14)",
                background: isFollowing ? "rgba(77,208,225,0.2)" : "rgba(0,0,0,0.2)",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              {isFollowing ? "取消跟随" : "跟随此 Agent"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="list">
        {agents.map((a) => {
          const sel = a.id === selected;
          return (
            <div
              key={a.id}
              className={`agent${sel ? " selected" : ""}`}
              onClick={() => {
                selectAgent(a.id);
                // Plan: click agent => focus + follow.
                setFollow(a.id);
              }}
            >
              <div className="meta">
                <div className="name">
                  {a.name}
                  {!a.connected ? <span style={{ color: "var(--muted)" }}>（离线）</span> : null}
                </div>
                <div className="id">{a.id}</div>
              </div>
              <div className="sub">
                <span>
                  xz={a.pos[0]},{a.pos[2]}
                </span>
                <span>move={a.move_task?.kind ?? "-"}</span>
                <span>work={a.work_task?.kind ?? "-"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
