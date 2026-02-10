import React, { useMemo } from "react";

import { useObserverStore } from "../state/observerStore";

export function ActivityFeed() {
  const activity = useObserverStore((s) => s.activity);
  const selected = useObserverStore((s) => s.selected_agent_id);

  const items = useMemo(() => {
    if (!selected) return activity;
    return activity.filter((x) => x.agent_id === selected || !x.agent_id);
  }, [activity, selected]);

  return (
    <div className="feed">
      <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
        动态 {selected ? `(仅 ${selected})` : ""}
      </div>
      <div style={{ height: 10 }} />
      {items.map((it, idx) => (
        <div key={`${it.tick}-${idx}`} className="feed-item">
          {it.text}
        </div>
      ))}
      {items.length === 0 ? <div className="feed-item">暂无动态</div> : null}
    </div>
  );
}
