import * as THREE from "three";

import type { AuditEntry } from "../../net/protocol";

export type RecentAudit = AuditEntry & { born_tick: number };

export class RecentChanges {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private geom: THREE.PlaneGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "recent-changes";
    this.scene.add(this.group);
    this.geom = new THREE.PlaneGeometry(1, 1);
  }

  setAudits(audits: RecentAudit[], nowTick: number, ttlTicks = 50) {
    // Simple rebuild (small N); keep code obvious.
    while (this.group.children.length) {
      const obj = this.group.children.pop();
      if (!obj) break;
      obj.removeFromParent();
      const mesh = obj as THREE.Mesh;
      const mat = mesh.material as THREE.Material;
      mat.dispose();
    }

    for (const a of audits) {
      const age = nowTick - a.born_tick;
      if (age < 0 || age > ttlTicks) continue;
      const t = 1 - age / ttlTicks;
      const opacity = Math.max(0, Math.min(1, 0.9 * t));

      let color = 0xffd166;
      if (a.from === 0 && a.to !== 0) color = 0x2ecc71;
      else if (a.from !== 0 && a.to === 0) color = 0xff6b6b;

      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
      });
      const m = new THREE.Mesh(this.geom, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(a.pos[0] + 0.5, 0.04, a.pos[2] + 0.5);
      this.group.add(m);
    }
  }

  dispose() {
    this.setAudits([], 0);
    this.scene.remove(this.group);
    this.geom.dispose();
  }
}

