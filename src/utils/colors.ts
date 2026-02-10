function clamp01(x: number) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function hash32(s: string) {
  // FNV-1a-ish
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hh >= 0 && hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function blockRGBA(
  blockId: number,
  palette?: string[],
  y = 0,
  height = 64,
): [number, number, number, number] {
  const name = palette?.[blockId] ?? "";
  // Prefer the palette name when available; only fall back to "0 == AIR" when palette is missing.
  if (palette) {
    if (name === "AIR") return [0, 0, 0, 0];
  } else {
    if (blockId === 0) return [0, 0, 0, 0];
  }

  let rgb: [number, number, number] | null = null;
  let a = 255;

  switch (name) {
    case "GRASS":
      rgb = [70, 160, 90];
      break;
    case "DIRT":
      rgb = [110, 80, 55];
      break;
    case "SAND":
      rgb = [194, 178, 128];
      break;
    case "STONE":
      rgb = [125, 130, 138];
      break;
    case "WATER":
      rgb = [60, 120, 200];
      a = 220;
      break;
    case "ICE":
      rgb = [150, 200, 235];
      a = 230;
      break;
    case "LOG":
      rgb = [122, 92, 58];
      break;
    case "PLANK":
      rgb = [168, 130, 80];
      break;
    case "BRICK":
      rgb = [152, 74, 64];
      break;
    case "GLASS":
      rgb = [210, 235, 255];
      a = 120;
      break;
    case "METAL_PLATE":
      rgb = [170, 180, 195];
      break;
    case "TORCH":
      rgb = [255, 190, 80];
      a = 245;
      break;
    default: {
      const h = hash32(name || String(blockId)) % 360;
      rgb = hslToRgb(h, 0.55, 0.52);
    }
  }

  const shade = 0.72 + clamp01(y / Math.max(1, height - 1)) * 0.28;
  const r = Math.round(rgb[0] * shade);
  const g = Math.round(rgb[1] * shade);
  const b = Math.round(rgb[2] * shade);
  return [r, g, b, a];
}
