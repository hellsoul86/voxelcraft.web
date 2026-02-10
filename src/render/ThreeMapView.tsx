import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { useObserverStore } from "../state/observerStore";
import { ChunkSurfaceLayer } from "./chunks/ChunkSurfaceLayer";
import { AgentMarkers } from "./agents/AgentMarkers";
import { RecentChanges } from "./overlays/RecentChanges";

function resizeOrtho(cam: THREE.OrthographicCamera, w: number, h: number, frustumSize: number) {
  const aspect = w / Math.max(1, h);
  cam.left = (-frustumSize * aspect) / 2;
  cam.right = (frustumSize * aspect) / 2;
  cam.top = frustumSize / 2;
  cam.bottom = -frustumSize / 2;
  cam.updateProjectionMatrix();
}

export function ThreeMapView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const tick = useObserverStore((s) => s.tick);
  const connected = useObserverStore((s) => s.connected);

  const hint = useMemo(() => {
    if (!connected) return "未连接: 请确认 voxelcraft.ai 在本机 :8080 运行";
    if (!tick) return "连接中: 等待首个 TICK";
    return "鼠标: 滚轮缩放 | 拖拽平移 | 点击左侧 Agent 跟随";
  }, [connected, tick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const wrapEl: HTMLDivElement = wrap;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();

    const camera = new THREE.OrthographicCamera(-40, 40, 40, -40, 0.1, 1000);
    camera.up.set(0, 0, -1);
    camera.position.set(0, 200, 0.001);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.zoomSpeed = 0.9;

    const chunkLayer = new ChunkSurfaceLayer(scene);
    const agentMarkers = new AgentMarkers(scene);
    const recentChanges = new RecentChanges(scene);

    let palette: string[] | undefined;
    let height = 64;

    const unsubBootstrap = useObserverStore.subscribe(
      (s) => s.bootstrap,
      (b) => {
        palette = b?.block_palette;
        height = b?.world_params?.height ?? 64;
      },
    );

    const unsubChunks = useObserverStore.subscribe(
      (s) => s.chunks,
      (next, prev) => {
        for (const k of prev.keys()) {
          if (!next.has(k)) {
            const [cx, cz] = k.split(",").map((n: string) => Number(n));
            chunkLayer.evict(cx, cz);
          }
        }
        for (const [k, v] of next) {
          if (prev.get(k) === v) continue;
          chunkLayer.upsert(v, palette, height);
        }
      },
    );

    const unsubAgents = useObserverStore.subscribe(
      (s) => [s.agents_by_id, s.selected_agent_id] as const,
      ([agentsById, selectedId]) => {
        agentMarkers.setAgents([...agentsById.values()], selectedId);
      },
    );

    const unsubAudits = useObserverStore.subscribe(
      (s) => [s.recent_audits, s.tick] as const,
      ([audits, nowTick]) => {
        recentChanges.setAudits(audits, nowTick, 50);
      },
    );

    const unsubFollow = useObserverStore.subscribe(
      (s) => [s.follow_agent_id, s.agents_by_id, s.tick] as const,
      ([followId, agentsById]) => {
        if (!followId) return;
        const a = agentsById.get(followId);
        if (!a) return;
        const [x, _y, z] = a.pos;
        controls.target.set(x + 0.5, 0, z + 0.5);
        camera.position.set(x + 0.5, 200, z + 0.501);
        camera.lookAt(controls.target);
        controls.update();
      },
    );

    function onResize() {
      const rect = wrapEl.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      resizeOrtho(camera, rect.width, rect.height, 80);
    }

    const ro = new ResizeObserver(() => onResize());
    ro.observe(wrapEl);
    onResize();

    let running = true;
    const renderLoop = () => {
      if (!running) return;
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      running = false;
      ro.disconnect();
      unsubBootstrap();
      unsubChunks();
      unsubAgents();
      unsubAudits();
      unsubFollow();
      recentChanges.dispose();
      agentMarkers.dispose();
      chunkLayer.dispose();
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} />
      <div className="hint">{hint}</div>
    </div>
  );
}
