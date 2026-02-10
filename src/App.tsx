import React, { useEffect } from "react";

import { startObserverClient } from "./net/observerClient";
import { useObserverStore } from "./state/observerStore";
import { ThreeMapView } from "./render/ThreeMapView";
import { TopStatusBar } from "./ui/TopStatusBar";
import { AgentListPanel } from "./ui/AgentListPanel";
import { ActivityFeed } from "./ui/ActivityFeed";

export function App() {
  const connected = useObserverStore((s) => s.connected);
  const err = useObserverStore((s) => s.error);
  const bootstrap = useObserverStore((s) => s.bootstrap);
  const tick = useObserverStore((s) => s.tick);
  const weather = useObserverStore((s) => s.weather);
  const timeOfDay = useObserverStore((s) => s.time_of_day);
  const activeEventId = useObserverStore((s) => s.active_event_id);
  const activeEventEnds = useObserverStore((s) => s.active_event_ends_tick);

  useEffect(() => {
    const stop = startObserverClient();
    return () => stop();
  }, []);

  useEffect(() => {
    // Playwright client reads this.
    (window as any).render_game_to_text = () => {
      const s = useObserverStore.getState();
      return JSON.stringify({
        connected: s.connected,
        tick: s.tick,
        agents_count: s.agents_by_id.size,
        chunks_loaded: s.chunks.size,
        selected_agent_id: s.selected_agent_id ?? null,
      });
    };

    // For manual runs (Playwright injects its own shim).
    if (typeof (window as any).advanceTime !== "function") {
      (window as any).advanceTime = (ms: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, ms));
    }
  }, []);

  return (
    <div className="app">
      <TopStatusBar
        connected={connected}
        world_id={bootstrap?.world_id}
        tick={tick}
        weather={weather}
        time_of_day={timeOfDay}
        active_event_id={activeEventId}
        active_event_ends_tick={activeEventEnds}
      />

      <div className="layout">
        <div className="sidebar">
          <AgentListPanel />
          <ActivityFeed />
        </div>

        <div className="main">
          <ThreeMapView />
          {err ? (
            <div
              style={{
                position: "absolute",
                right: 12,
                bottom: 12,
                maxWidth: 520,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.5)",
                fontFamily: "var(--mono)",
                fontSize: 12,
                color: "var(--danger)",
              }}
            >
              {err}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

