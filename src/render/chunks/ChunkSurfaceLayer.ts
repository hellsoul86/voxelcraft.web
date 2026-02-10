import * as THREE from "three";

import type { ChunkSurface } from "../../state/observerStore";
import { blockRGBA } from "../../utils/colors";

type ChunkRender = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  img: ImageData;
};

function key(cx: number, cz: number) {
  return `${cx},${cz}`;
}

export class ChunkSurfaceLayer {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private geom: THREE.PlaneGeometry;
  private chunks = new Map<string, ChunkRender>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "chunk-surface-layer";
    this.scene.add(this.group);
    this.geom = new THREE.PlaneGeometry(16, 16);
  }

  setVisible(v: boolean) {
    this.group.visible = v;
  }

  upsert(surface: ChunkSurface, palette?: string[], height = 64) {
    const k = key(surface.cx, surface.cz);
    let r = this.chunks.get(k);
    if (!r) {
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      const img = ctx.createImageData(16, 16);

      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;

      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.geom, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(surface.cx * 16 + 8, 0, surface.cz * 16 + 8);
      mesh.name = `chunk:${k}`;
      this.group.add(mesh);

      r = { mesh, canvas, ctx, texture, img };
      this.chunks.set(k, r);
    }

    this.renderFull(r, surface, palette, height);
  }

  evict(cx: number, cz: number) {
    const k = key(cx, cz);
    const r = this.chunks.get(k);
    if (!r) return;
    this.group.remove(r.mesh);
    r.mesh.material.map?.dispose();
    r.mesh.material.dispose();
    this.chunks.delete(k);
  }

  listKeys() {
    return [...this.chunks.keys()];
  }

  dispose() {
    for (const k of this.chunks.keys()) {
      const [cx, cz] = k.split(",").map((n) => Number(n));
      this.evict(cx, cz);
    }
    this.scene.remove(this.group);
    this.geom.dispose();
  }

  private renderFull(r: ChunkRender, surface: ChunkSurface, palette?: string[], height = 64) {
    const data = r.img.data;
    for (let i = 0; i < 16 * 16; i++) {
      const [rr, gg, bb, aa] = blockRGBA(surface.blocks[i], palette, surface.ys[i], height);
      const off = i * 4;
      data[off] = rr;
      data[off + 1] = gg;
      data[off + 2] = bb;
      data[off + 3] = aa;
    }
    r.ctx.putImageData(r.img, 0, 0);
    r.texture.needsUpdate = true;
  }
}
