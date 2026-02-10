import * as THREE from "three";

import type { ChunkVoxels } from "../../state/observerStore";
import { blockRGBA } from "../../utils/colors";

type ChunkRender = {
  cx: number;
  cz: number;
  blocks: Uint16Array;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
};

function key(cx: number, cz: number) {
  return `${cx},${cz}`;
}

function airIdFromPalette(palette?: string[]) {
  if (!palette || palette.length === 0) return 0;
  const idx = palette.indexOf("AIR");
  return idx >= 0 ? idx : 0;
}

export class ChunkVoxelLayer {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private chunks = new Map<string, ChunkRender>();
  private material: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "chunk-voxel-layer";
    this.scene.add(this.group);

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true,
    });
  }

  setVisible(v: boolean) {
    this.group.visible = v;
  }

  upsert(chunk: ChunkVoxels, palette?: string[], height = 64) {
    const k = key(chunk.cx, chunk.cz);
    let r = this.chunks.get(k);
    if (!r) {
      const geom = new THREE.BufferGeometry();
      const mesh = new THREE.Mesh(geom, this.material);
      mesh.name = `chunk_voxels:${k}`;
      this.group.add(mesh);
      r = { cx: chunk.cx, cz: chunk.cz, blocks: chunk.blocks, mesh };
      this.chunks.set(k, r);
    } else {
      r.blocks = chunk.blocks;
      r.cx = chunk.cx;
      r.cz = chunk.cz;
    }

    this.rebuild(r, palette, height);
    // Boundary faces depend on neighbors; rebuild them too if loaded.
    this.rebuildNeighbor(chunk.cx - 1, chunk.cz, palette, height);
    this.rebuildNeighbor(chunk.cx + 1, chunk.cz, palette, height);
    this.rebuildNeighbor(chunk.cx, chunk.cz - 1, palette, height);
    this.rebuildNeighbor(chunk.cx, chunk.cz + 1, palette, height);
  }

  evict(cx: number, cz: number) {
    const k = key(cx, cz);
    const r = this.chunks.get(k);
    if (!r) return;
    this.group.remove(r.mesh);
    r.mesh.geometry.dispose();
    this.chunks.delete(k);
  }

  dispose() {
    for (const k of this.chunks.keys()) {
      const [cx, cz] = k.split(",").map((n) => Number(n));
      this.evict(cx, cz);
    }
    this.scene.remove(this.group);
    this.material.dispose();
  }

  private rebuildNeighbor(cx: number, cz: number, palette?: string[], height = 64) {
    const r = this.chunks.get(key(cx, cz));
    if (!r) return;
    this.rebuild(r, palette, height);
  }

  private rebuild(r: ChunkRender, palette?: string[], height = 64) {
    const airId = airIdFromPalette(palette);
    const blocks = r.blocks;
    const h = Math.max(1, Math.floor(height));

    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const getBlock = (cx: number, cz: number, x: number, y: number, z: number): number => {
      if (y < 0 || y >= h) return airId;
      if (x >= 0 && x < 16 && z >= 0 && z < 16) {
        const idx = x + z * 16 + y * 16 * 16;
        return blocks[idx] ?? airId;
      }
      let ncx = cx;
      let ncz = cz;
      let lx = x;
      let lz = z;
      if (lx < 0) {
        ncx -= 1;
        lx += 16;
      } else if (lx >= 16) {
        ncx += 1;
        lx -= 16;
      }
      if (lz < 0) {
        ncz -= 1;
        lz += 16;
      } else if (lz >= 16) {
        ncz += 1;
        lz -= 16;
      }
      const nb = this.chunks.get(key(ncx, ncz))?.blocks;
      if (!nb) return airId;
      const idx = lx + lz * 16 + y * 16 * 16;
      return nb[idx] ?? airId;
    };

    const addFace = (
      v0: [number, number, number],
      v1: [number, number, number],
      v2: [number, number, number],
      v3: [number, number, number],
      n: [number, number, number],
      c: [number, number, number],
    ) => {
      // Two triangles: 0-1-2, 0-2-3
      const vs = [v0, v1, v2, v0, v2, v3];
      for (const v of vs) {
        positions.push(v[0], v[1], v[2]);
        normals.push(n[0], n[1], n[2]);
        colors.push(c[0], c[1], c[2]);
      }
    };

    for (let y = 0; y < h; y++) {
      for (let z = 0; z < 16; z++) {
        for (let x = 0; x < 16; x++) {
          const idx = x + z * 16 + y * 16 * 16;
          const b = blocks[idx] ?? airId;
          if (b === airId) continue;

          const [rr, gg, bb] = blockRGBA(b, palette, y, h);
          const col: [number, number, number] = [rr / 255, gg / 255, bb / 255];

          const wx = r.cx * 16 + x;
          const wz = r.cz * 16 + z;

          // +Y
          if (getBlock(r.cx, r.cz, x, y + 1, z) === airId) {
            addFace(
              [wx, y + 1, wz],
              [wx + 1, y + 1, wz],
              [wx + 1, y + 1, wz + 1],
              [wx, y + 1, wz + 1],
              [0, 1, 0],
              col,
            );
          }
          // -Y
          if (getBlock(r.cx, r.cz, x, y - 1, z) === airId) {
            addFace(
              [wx, y, wz],
              [wx, y, wz + 1],
              [wx + 1, y, wz + 1],
              [wx + 1, y, wz],
              [0, -1, 0],
              col,
            );
          }
          // +X
          if (getBlock(r.cx, r.cz, x + 1, y, z) === airId) {
            addFace(
              [wx + 1, y, wz],
              [wx + 1, y + 1, wz],
              [wx + 1, y + 1, wz + 1],
              [wx + 1, y, wz + 1],
              [1, 0, 0],
              col,
            );
          }
          // -X
          if (getBlock(r.cx, r.cz, x - 1, y, z) === airId) {
            addFace(
              [wx, y, wz],
              [wx, y + 1, wz],
              [wx, y + 1, wz + 1],
              [wx, y, wz + 1],
              [-1, 0, 0],
              col,
            );
          }
          // +Z
          if (getBlock(r.cx, r.cz, x, y, z + 1) === airId) {
            addFace(
              [wx, y, wz + 1],
              [wx + 1, y, wz + 1],
              [wx + 1, y + 1, wz + 1],
              [wx, y + 1, wz + 1],
              [0, 0, 1],
              col,
            );
          }
          // -Z
          if (getBlock(r.cx, r.cz, x, y, z - 1) === airId) {
            addFace(
              [wx, y, wz],
              [wx, y + 1, wz],
              [wx + 1, y + 1, wz],
              [wx + 1, y, wz],
              [0, 0, -1],
              col,
            );
          }
        }
      }
    }

    const geom = new THREE.BufferGeometry();
    if (positions.length) {
      geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geom.computeBoundingSphere();
    }

    // Swap geometry to avoid re-creating the mesh/material.
    const old = r.mesh.geometry;
    r.mesh.geometry = geom;
    old.dispose();
  }
}

