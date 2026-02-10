import * as THREE from "three";

import type { AgentState } from "../../net/protocol";

type AgentRender = {
  group: THREE.Group;
  disc: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  dir: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  baseColor: THREE.Color;
};

function hash32(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function colorForId(id: string) {
  const h = (hash32(id) % 360) / 360;
  const c = new THREE.Color();
  c.setHSL(h, 0.6, 0.55);
  return c;
}

export class AgentMarkers {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private renders = new Map<string, AgentRender>();

  private discGeom = new THREE.CircleGeometry(0.45, 20);
  private ringGeom = new THREE.RingGeometry(0.55, 0.7, 24);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "agent-markers";
    this.scene.add(this.group);
  }

  setAgents(agents: AgentState[], selectedId?: string, yMode: "flat" | "world" = "flat") {
    const next = new Set<string>();
    for (const a of agents) {
      next.add(a.id);
      let r = this.renders.get(a.id);
      if (!r) {
        r = this.create(a.id);
        this.renders.set(a.id, r);
        this.group.add(r.group);
      }
      this.update(r, a, selectedId, yMode);
    }

    for (const [id, r] of this.renders) {
      if (next.has(id)) continue;
      this.group.remove(r.group);
      r.disc.material.dispose();
      r.ring.material.dispose();
      r.dir.material.dispose();
      r.dir.geometry.dispose();
      this.renders.delete(id);
    }
  }

  dispose() {
    this.setAgents([]);
    this.scene.remove(this.group);
    this.discGeom.dispose();
    this.ringGeom.dispose();
  }

  private create(agentId: string): AgentRender {
    const baseColor = colorForId(agentId);
    const discMat = new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0.95, depthWrite: false });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
    const disc = new THREE.Mesh(this.discGeom, discMat);
    const ring = new THREE.Mesh(this.ringGeom, ringMat);

    // XZ plane.
    disc.rotation.x = -Math.PI / 2;
    ring.rotation.x = -Math.PI / 2;
    disc.position.y = 0.02;
    ring.position.y = 0.021;

    const pts = [new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, 0.05, 0.9)];
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.9 });
    const dir = new THREE.Line(geom, lineMat);

    const group = new THREE.Group();
    group.name = `agent:${agentId}`;
    group.add(disc);
    group.add(ring);
    group.add(dir);

    return { group, disc, ring, dir, baseColor };
  }

  private update(r: AgentRender, a: AgentState, selectedId?: string, yMode: "flat" | "world" = "flat") {
    const [x, y, z] = a.pos;
    const yy = yMode === "world" ? y : 0;
    r.group.position.set(x + 0.5, yy, z + 0.5);

    const selected = selectedId === a.id;
    r.ring.visible = selected;

    const dim = a.connected ? 1.0 : 0.35;
    r.disc.material.opacity = 0.95 * dim;
    r.dir.material.opacity = 0.9 * dim;

    const yawRad = (a.yaw * Math.PI) / 180;
    r.dir.rotation.y = yawRad;
  }
}
