import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { shallow } from "zustand/shallow";

import { useObserverStore } from "../state/observerStore";
import { ChunkSurfaceLayer } from "./chunks/ChunkSurfaceLayer";
import { ChunkVoxelLayer } from "./voxels/ChunkVoxelLayer";
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
  const viewMode = useObserverStore((s) => s.view_mode);

  const hint = useMemo(() => {
    if (!connected) return "未连接: 请确认 voxelcraft.ai 在本机 :8080 运行";
    if (!tick) return "连接中: 等待首个 TICK";
    if (viewMode === "3D") return "3D: 左键旋转 | 右键平移 | 滚轮缩放 | 点击左侧 Agent 跟随";
    return "2D: 拖拽平移 | 滚轮缩放 | 点击左侧 Agent 跟随";
  }, [connected, tick, viewMode]);

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

    // Lights for 3D voxel mode (2D uses MeshBasicMaterial so lighting doesn't matter there).
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(120, 200, 80);
    scene.add(sun);

    const camera2D = new THREE.OrthographicCamera(-40, 40, 40, -40, 0.1, 2000);
    camera2D.up.set(0, 0, -1);
    camera2D.position.set(0, 200, 0.001);
    camera2D.lookAt(0, 0, 0);

    const camera3D = new THREE.PerspectiveCamera(55, 1, 0.1, 4000);
    camera3D.position.set(30, 45, 30);
    camera3D.lookAt(0, 0, 0);

    const controls2D = new OrbitControls(camera2D, renderer.domElement);
    controls2D.enableRotate = false;
    controls2D.enableDamping = true;
    controls2D.dampingFactor = 0.08;
    controls2D.screenSpacePanning = true;
    controls2D.zoomSpeed = 0.9;

    const controls3D = new OrbitControls(camera3D, renderer.domElement);
    controls3D.enableRotate = true;
    controls3D.enablePan = true;
    controls3D.enableDamping = true;
    controls3D.dampingFactor = 0.08;
    controls3D.screenSpacePanning = true;
    controls3D.zoomSpeed = 0.9;
    controls3D.enabled = false; // default 2D

    const chunkLayer = new ChunkSurfaceLayer(scene);
    const voxelLayer = new ChunkVoxelLayer(scene);
    const agentMarkers = new AgentMarkers(scene);
    const recentChanges = new RecentChanges(scene);

    let palette: string[] | undefined;
    let height = 64;

    let mode: "2D" | "3D" = useObserverStore.getState().view_mode;
    const lastFollowTarget3D = new THREE.Vector3();
    let hasLastFollowTarget3D = false;

    const applyMode = (m: "2D" | "3D") => {
      mode = m;
      const is3D = m === "3D";
      controls2D.enabled = !is3D;
      controls3D.enabled = is3D;
      chunkLayer.setVisible(!is3D);
      recentChanges.setVisible(!is3D);
      voxelLayer.setVisible(is3D);
      hasLastFollowTarget3D = false;
    };
    applyMode(mode);

    const unsubMode = useObserverStore.subscribe(
      (s) => s.view_mode,
      (m) => applyMode(m),
    );

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

    const unsubVoxels = useObserverStore.subscribe(
      (s) => s.voxels,
      (next, prev) => {
        for (const k of prev.keys()) {
          if (!next.has(k)) {
            const [cx, cz] = k.split(",").map((n: string) => Number(n));
            voxelLayer.evict(cx, cz);
          }
        }
        for (const [k, v] of next) {
          if (prev.get(k) === v) continue;
          voxelLayer.upsert(v, palette, height);
        }
      },
    );

    const unsubAgents = useObserverStore.subscribe(
      (s) => ({ agentsById: s.agents_by_id, selectedId: s.selected_agent_id, viewMode: s.view_mode }),
      ({ agentsById, selectedId, viewMode }) => {
        agentMarkers.setAgents([...agentsById.values()], selectedId, viewMode === "3D" ? "world" : "flat");
      },
      { equalityFn: shallow },
    );

    const unsubAudits = useObserverStore.subscribe(
      (s) => [s.recent_audits, s.tick] as const,
      ([audits, nowTick]) => {
        recentChanges.setAudits(audits, nowTick, 50);
      },
    );

    const unsubFollow = useObserverStore.subscribe(
      (s) => ({ followId: s.follow_agent_id, agentsById: s.agents_by_id, viewMode: s.view_mode, tick: s.tick }),
      ({ followId, agentsById, viewMode }) => {
        if (!followId) return;
        const a = agentsById.get(followId);
        if (!a) return;
        const [x, y, z] = a.pos;

        if (viewMode === "3D") {
          const target = new THREE.Vector3(x + 0.5, y + 1.5, z + 0.5);
          if (!hasLastFollowTarget3D) {
            controls3D.target.copy(target);
            camera3D.position.set(target.x + 24, target.y + 22, target.z + 24);
            hasLastFollowTarget3D = true;
          } else {
            const dx = target.x - lastFollowTarget3D.x;
            const dy = target.y - lastFollowTarget3D.y;
            const dz = target.z - lastFollowTarget3D.z;
            camera3D.position.x += dx;
            camera3D.position.y += dy;
            camera3D.position.z += dz;
            controls3D.target.copy(target);
          }
          lastFollowTarget3D.copy(target);
          camera3D.lookAt(target);
          controls3D.update();
          return;
        }

        controls2D.target.set(x + 0.5, 0, z + 0.5);
        camera2D.position.set(x + 0.5, 200, z + 0.501);
        camera2D.lookAt(controls2D.target);
        controls2D.update();
      },
      { equalityFn: shallow },
    );

    function onResize() {
      const rect = wrapEl.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      resizeOrtho(camera2D, rect.width, rect.height, 80);
      camera3D.aspect = rect.width / Math.max(1, rect.height);
      camera3D.updateProjectionMatrix();
    }

    const ro = new ResizeObserver(() => onResize());
    ro.observe(wrapEl);
    onResize();

    let running = true;
    const renderLoop = () => {
      if (!running) return;
      if (mode === "3D") {
        controls3D.update();
        renderer.render(scene, camera3D);
      } else {
        controls2D.update();
        renderer.render(scene, camera2D);
      }
      requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      running = false;
      ro.disconnect();
      unsubMode();
      unsubBootstrap();
      unsubChunks();
      unsubVoxels();
      unsubAgents();
      unsubAudits();
      unsubFollow();
      recentChanges.dispose();
      agentMarkers.dispose();
      voxelLayer.dispose();
      chunkLayer.dispose();
      controls2D.dispose();
      controls3D.dispose();
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
