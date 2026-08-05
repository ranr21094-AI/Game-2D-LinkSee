import Phaser from "phaser";
import architectureBaseUrl from "../assets/macau-architecture-base.png";
import architectureMemoryUrl from "../assets/macau-architecture-memory.png";
import architectureWarmUrl from "../assets/macau-architecture-warm.png";
import ruinsFacadeBaseUrl from "../assets/ruins-facade-base.png";
import ruinsFacadeMemoryUrl from "../assets/ruins-facade-memory.png";
import ruinsFacadeWarmUrl from "../assets/ruins-facade-warm.png";
import { TREE_TEXTURE, type GroundVisualState } from "./ground-tiles";
import type { DecorationKind, MapDecoration } from "./tilemap";

export const ARCHITECTURE_TEXTURE: Record<GroundVisualState, string> = {
  base: "architecture-base",
  memory: "architecture-memory",
  warm: "architecture-warm",
};

export const RUINS_FACADE_TEXTURE: Record<GroundVisualState, string> = {
  base: "ruins-facade-base",
  memory: "ruins-facade-memory",
  warm: "ruins-facade-warm",
};

type Crop = { x: number; y: number; width: number; height: number };
const ARCHITECTURE_CROPS: Partial<Record<DecorationKind, Crop>> = {
  "arcade-house": { x: 20, y: 10, width: 180, height: 235 },
  "corner-house": { x: 15, y: 250, width: 220, height: 210 },
  arcade: { x: 500, y: 85, width: 300, height: 165 },
  "low-house": { x: 250, y: 295, width: 230, height: 165 },
  "stone-gate": { x: 495, y: 280, width: 305, height: 180 },
};

const PROGRAMMATIC_KINDS = ["shelter", "bus", "bench", "lamp", "signal", "bus-window", "bus-pole", "stop-sign-17", "stop-sign-25"] as const;
type ProgrammaticKind = (typeof PROGRAMMATIC_KINDS)[number];

type Palette = { stone: string; dark: string; light: string; metal: string; glow: string; red: string };
const PALETTES: Record<GroundVisualState, Palette> = {
  base: { stone: "#777777", dark: "#383838", light: "#a4a4a4", metal: "#646464", glow: "#b2b2b2", red: "#686868" },
  memory: { stone: "#817b70", dark: "#3e3b37", light: "#aaa293", metal: "#6d6961", glow: "#c4ac7b", red: "#806a61" },
  warm: { stone: "#96816d", dark: "#3e3731", light: "#c2aa88", metal: "#77756d", glow: "#e4b45f", red: "#a85149" },
};

function rect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function drawProgrammatic(ctx: CanvasRenderingContext2D, kind: DecorationKind, width: number, height: number, state: GroundVisualState): void {
  const p = PALETTES[state];
  ctx.clearRect(0, 0, width, height);
  if (kind === "shelter") {
    // roof slab with front lip and drip edge
    rect(ctx, p.dark, 0, 6, width, 10);
    rect(ctx, p.light, 3, 2, width - 6, 5);
    rect(ctx, p.metal, 0, 15, width, 2);
    // translucent glass back panel with metal frame
    rect(ctx, p.metal, 14, 30, width - 28, 34);
    rect(ctx, p.glow, 17, 33, width - 34, 28);
    // welcome board mounted on the back panel, text centered
    rect(ctx, p.dark, width / 2 - 44, 34, 88, 26);
    rect(ctx, p.light, width / 2 - 41, 37, 82, 20);
    ctx.fillStyle = p.dark;
    ctx.font = `700 12px "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("澳门欢迎您", width / 2, 48);
    // end posts with base plates (no middle post)
    [12, width - 12].forEach((x) => {
      rect(ctx, p.metal, x - 3, 16, 6, height - 22);
      rect(ctx, p.light, x - 2, 17, 2, height - 24);
      rect(ctx, p.dark, x - 6, height - 6, 12, 5);
    });
  } else if (kind === "bus") {
    rect(ctx, p.dark, 2, 8, width - 4, height - 12); rect(ctx, p.stone, 5, 12, width - 10, height - 22); rect(ctx, p.red, 5, height - 24, width - 10, 5);
    for (let x = 14; x < width - 54; x += 35) { rect(ctx, p.dark, x, 18, 28, 19); rect(ctx, p.glow, x + 3, 21, 22, 9); }
    rect(ctx, p.dark, width - 49, 14, 40, height - 22); rect(ctx, p.metal, width - 45, 18, 16, height - 30); rect(ctx, p.metal, width - 27, 18, 14, height - 30);
    [34, width - 38].forEach((x) => { ctx.fillStyle = p.dark; ctx.beginPath(); ctx.arc(x, height - 8, 9, 0, Math.PI * 2); ctx.fill(); });
  } else if (kind === "bench") {
    // backrest slats and side posts
    rect(ctx, p.dark, 3, 0, 3, 22);
    rect(ctx, p.dark, width - 6, 0, 3, 22);
    rect(ctx, p.dark, 4, 1, width - 8, 3);
    rect(ctx, p.light, 4, 5, width - 8, 3);
    // seat slats with gaps
    rect(ctx, p.stone, 2, 11, width - 4, 3);
    rect(ctx, p.light, 2, 15, width - 4, 3);
    rect(ctx, p.stone, 2, 19, width - 4, 3);
    // legs
    rect(ctx, p.dark, 6, 22, 5, 6);
    rect(ctx, p.dark, width - 11, 22, 5, 6);
  } else if (kind === "stop-sign-17" || kind === "stop-sign-25") {
    const route = kind === "stop-sign-17" ? "17" : "25";
    // framed plate with a route color band
    rect(ctx, p.dark, 0, 0, width, 42);
    rect(ctx, p.metal, 2, 2, width - 4, 38);
    rect(ctx, p.light, 4, 4, width - 8, 34);
    rect(ctx, p.red, 4, 4, width - 8, 6);
    // pole with collar and base flange
    rect(ctx, p.dark, width / 2 - 3, 42, 6, 5);
    rect(ctx, p.metal, width / 2 - 2, 47, 4, height - 51);
    rect(ctx, p.dark, width / 2 - 6, height - 4, 12, 4);
    // raised route number
    ctx.fillStyle = "#242321";
    ctx.font = `bold ${Math.max(13, Math.round(width * 0.58))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(route, width / 2, 25);
  } else if (kind === "lamp" || kind === "signal") {
    rect(ctx, p.dark, width / 2 - 3, kind === "lamp" ? 20 : 17, 6, height - (kind === "lamp" ? 20 : 17));
    rect(ctx, p.metal, width / 2 - 2, kind === "lamp" ? 21 : 18, 2, height - 24);
    rect(ctx, p.dark, 2, 0, width - 4, kind === "lamp" ? 24 : 31);
    ctx.fillStyle = kind === "signal" ? p.red : p.glow; ctx.beginPath(); ctx.arc(width / 2, kind === "signal" ? 12 : 10, kind === "signal" ? 5 : 7, 0, Math.PI * 2); ctx.fill();
  } else if (kind === "bus-window") {
    rect(ctx, p.dark, 0, 0, width, height); rect(ctx, p.stone, 4, 4, width - 8, height - 8);
    for (let x = 10; x < width - 10; x += 52) { rect(ctx, p.dark, x, 10, 42, 34); rect(ctx, p.glow, x + 3, 13, 36, 12); }
    rect(ctx, p.metal, 0, height - 13, width, 5);
  } else if (kind === "bus-pole") {
    rect(ctx, p.dark, 3, 0, 6, height); rect(ctx, p.light, 4, 0, 2, height); rect(ctx, p.dark, 0, 8, 12, 5); rect(ctx, p.dark, 0, height - 13, 12, 5);
  }
}

export function preloadEnvironmentAssets(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ARCHITECTURE_TEXTURE.base)) scene.load.image(ARCHITECTURE_TEXTURE.base, architectureBaseUrl);
  if (!scene.textures.exists(ARCHITECTURE_TEXTURE.memory)) scene.load.image(ARCHITECTURE_TEXTURE.memory, architectureMemoryUrl);
  if (!scene.textures.exists(ARCHITECTURE_TEXTURE.warm)) scene.load.image(ARCHITECTURE_TEXTURE.warm, architectureWarmUrl);
  if (!scene.textures.exists(RUINS_FACADE_TEXTURE.base)) scene.load.image(RUINS_FACADE_TEXTURE.base, ruinsFacadeBaseUrl);
  if (!scene.textures.exists(RUINS_FACADE_TEXTURE.memory)) scene.load.image(RUINS_FACADE_TEXTURE.memory, ruinsFacadeMemoryUrl);
  if (!scene.textures.exists(RUINS_FACADE_TEXTURE.warm)) scene.load.image(RUINS_FACADE_TEXTURE.warm, ruinsFacadeWarmUrl);
}

const STATES: GroundVisualState[] = ["base", "memory", "warm"];

/** Contain-fit a source rect inside a max box, preserving aspect ratio. */
function fitSize(sourceWidth: number, sourceHeight: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

/** Programmatic sprites are drawn at their exact display size so nothing is stretched. */
function ensureProgrammaticTextures(scene: Phaser.Scene, kind: ProgrammaticKind, width: number, height: number): Record<GroundVisualState, string> {
  const textures = {} as Record<GroundVisualState, string>;
  STATES.forEach((state) => {
    const key = `environment-${kind}-${state}-${width}x${height}`;
    textures[state] = key;
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, width, height);
    if (!texture) return;
    drawProgrammatic(texture.getContext(), kind, width, height, state);
    texture.refresh();
  });
  return textures;
}

type GateTileKind = "parapet" | "window" | "wall" | "canopy" | "pillar" | "entrance";

function drawGateTile(ctx: CanvasRenderingContext2D, kind: GateTileKind, state: GroundVisualState): void {
  const p = PALETTES[state];
  ctx.clearRect(0, 0, 16, 16);
  rect(ctx, p.stone, 0, 0, 16, 16);
  if (kind === "parapet") {
    rect(ctx, p.light, 0, 0, 16, 3); rect(ctx, p.dark, 0, 12, 16, 4); rect(ctx, p.metal, 2, 5, 12, 2);
  } else if (kind === "window") {
    rect(ctx, p.dark, 2, 1, 12, 14); rect(ctx, p.glow, 4, 3, 8, 5); rect(ctx, p.metal, 7, 2, 2, 13); rect(ctx, p.metal, 3, 9, 10, 2);
  } else if (kind === "wall") {
    rect(ctx, p.light, 1, 1, 14, 3); rect(ctx, p.dark, 0, 8, 16, 1); rect(ctx, p.metal, 7, 0, 1, 16);
  } else if (kind === "canopy") {
    rect(ctx, p.dark, 0, 2, 16, 7); rect(ctx, p.light, 0, 1, 16, 2); rect(ctx, p.metal, 0, 9, 16, 3); rect(ctx, p.dark, 0, 14, 16, 2);
  } else if (kind === "pillar") {
    rect(ctx, p.dark, 3, 0, 10, 16); rect(ctx, p.light, 5, 0, 3, 16); rect(ctx, p.metal, 2, 13, 12, 3);
  } else {
    rect(ctx, p.dark, 0, 0, 16, 16); rect(ctx, p.metal, 2, 1, 12, 15); rect(ctx, p.glow, 4, 3, 8, 5); rect(ctx, p.dark, 7, 1, 2, 15);
  }
}

function gateTileKind(row: number, col: number, columns: number): GateTileKind {
  const center = Math.floor(columns / 2);
  if (row === 0) return "parapet";
  if (row === 1 || row === 2) return Math.abs(col - center) <= 3 ? "wall" : "window";
  if (row === 3) return "canopy";
  if (Math.abs(col - center) <= 2) return "entrance";
  return col % 4 === 0 ? "pillar" : "wall";
}

function ensureGateTileTextures(scene: Phaser.Scene, kind: GateTileKind): Record<GroundVisualState, string> {
  const keys = {} as Record<GroundVisualState, string>;
  STATES.forEach((state) => {
    const key = `gate-tile-${kind}-${state}`;
    keys[state] = key;
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, 16, 16);
    if (!texture) return;
    drawGateTile(texture.getContext(), kind, state);
    texture.refresh();
  });
  return keys;
}

function ensureGateSignTextures(scene: Phaser.Scene): Record<GroundVisualState, string> {
  const keys = {} as Record<GroundVisualState, string>;
  STATES.forEach((state) => {
    const key = `gate-sign-${state}`;
    keys[state] = key;
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, 112, 26);
    if (!texture) return;
    const ctx = texture.getContext();
    const p = PALETTES[state];
    rect(ctx, p.dark, 0, 0, 112, 26); rect(ctx, p.glow, 2, 2, 108, 22); rect(ctx, p.dark, 4, 4, 104, 18);
    ctx.font = '700 14px "Noto Serif CJK SC", "SimSun", serif';
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = p.glow;
    ctx.fillText("拱北口岸", 56, 13);
    texture.refresh();
  });
  return keys;
}

export type EnvironmentSprite = {
  sprite: Phaser.GameObjects.Image;
  textures: Record<GroundVisualState, string>;
  frames?: Record<GroundVisualState, string>;
  x: number;
  y: number;
};

function ensureArchitectureFrames(scene: Phaser.Scene, kind: DecorationKind): Record<GroundVisualState, string> | undefined {
  const crop = ARCHITECTURE_CROPS[kind];
  if (!crop) return undefined;
  const frames = {} as Record<GroundVisualState, string>;
  STATES.forEach((state) => {
    const frameName = `${kind}-${state}`;
    const texture = scene.textures.get(ARCHITECTURE_TEXTURE[state]);
    if (!texture.has(frameName)) texture.add(frameName, 0, crop.x, crop.y, crop.width, crop.height);
    frames[state] = frameName;
  });
  return frames;
}

export function renderMapDecoration(scene: Phaser.Scene, decoration: MapDecoration): EnvironmentSprite | EnvironmentSprite[] | null {
  if (decoration.kind === "gate-building") {
    const columns = Math.max(1, Math.round(decoration.width / 16));
    const rows = Math.max(1, Math.round(decoration.height / 16));
    const left = decoration.x - columns * 8;
    const top = decoration.y - rows * 16;
    const tiles: EnvironmentSprite[] = [];
    for (let row = 0; row < rows; row += 1) for (let col = 0; col < columns; col += 1) {
      const kind = gateTileKind(row, col, columns);
      const textures = ensureGateTileTextures(scene, kind);
      const x = left + col * 16 + 8;
      const y = top + row * 16 + 8;
      const sprite = scene.add.image(x, y, textures.base).setDepth(decoration.depth ?? 3);
      tiles.push({ sprite, textures, x, y });
    }
    const signTextures = ensureGateSignTextures(scene);
    const signY = top + 42;
    const sign = scene.add.image(decoration.x, signY, signTextures.base).setDepth((decoration.depth ?? 3) + 0.2);
    tiles.push({ sprite: sign, textures: signTextures, x: decoration.x, y: signY });
    return tiles;
  }
  if (decoration.kind === "tree") {
    const sprite = scene.add.image(decoration.x, decoration.y, TREE_TEXTURE.base).setOrigin(0.5, 1).setDisplaySize(decoration.width, decoration.height).setDepth(decoration.y);
    if (decoration.flipX) sprite.setFlipX(true);
    return { sprite, textures: TREE_TEXTURE, x: decoration.x, y: decoration.y - decoration.height / 2 };
  }
  if (decoration.kind === "ruins-facade") {
    const source = scene.textures.get(RUINS_FACADE_TEXTURE.base).getSourceImage();
    const fit = fitSize(source.width, source.height, decoration.width, decoration.height);
    const sprite = scene.add.image(decoration.x, decoration.y, RUINS_FACADE_TEXTURE.base).setOrigin(0.5, 1).setDisplaySize(fit.width, fit.height).setDepth(decoration.y);
    if (decoration.flipX) sprite.setFlipX(true);
    return { sprite, textures: RUINS_FACADE_TEXTURE, x: decoration.x, y: decoration.y - fit.height / 2 };
  }
  const frames = ensureArchitectureFrames(scene, decoration.kind);
  if (frames) {
    const crop = ARCHITECTURE_CROPS[decoration.kind];
    const fit = crop
      ? fitSize(crop.width, crop.height, decoration.width, decoration.height)
      : { width: decoration.width, height: decoration.height };
    const sprite = scene.add.image(decoration.x, decoration.y, ARCHITECTURE_TEXTURE.base, frames.base).setOrigin(0.5, 1).setDisplaySize(fit.width, fit.height).setDepth(decoration.y);
    if (decoration.flipX) sprite.setFlipX(true);
    return { sprite, textures: ARCHITECTURE_TEXTURE, frames, x: decoration.x, y: decoration.y - fit.height / 2 };
  }
  if (!(PROGRAMMATIC_KINDS as readonly DecorationKind[]).includes(decoration.kind)) return null;
  const width = Math.max(1, Math.round(decoration.width));
  const height = Math.max(1, Math.round(decoration.height));
  const textures = ensureProgrammaticTextures(scene, decoration.kind as ProgrammaticKind, width, height);
  const sprite = scene.add.image(decoration.x, decoration.y, textures.base).setOrigin(0.5, 1).setDisplaySize(width, height).setDepth(decoration.y);
  if (decoration.flipX) sprite.setFlipX(true);
  return { sprite, textures, x: decoration.x, y: decoration.y - height / 2 };
}

export function ensureCaneTextures(scene: Phaser.Scene): void {
  const directions = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;
  (Object.keys(directions) as Array<keyof typeof directions>).forEach((facing) => [false, true].forEach((extended) => {
    const key = `cane-${facing}-${extended ? "tap" : "idle"}`;
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, 112, 112);
    if (!texture) return;
    const ctx = texture.getContext();
    const [dx, dy] = directions[facing];
    const startX = 56;
    const startY = 56;
    const length = extended ? 48 : 38;
    for (let step = 0; step <= length; step += 1) {
      const x = startX + dx * step;
      const y = startY + dy * step;
      const color = step < 11 ? "#262626" : step > length * 0.68 && step < length * 0.8 ? "#b84f48" : "#dedbd3";
      rect(ctx, color, x - (dy !== 0 ? 1 : 0), y - (dx !== 0 ? 1 : 0), dy !== 0 ? 3 : 1, dx !== 0 ? 3 : 1);
    }
    rect(ctx, "#626666", startX + dx * length - 2, startY + dy * length - 2, 4, 4);
    texture.refresh();
  }));
}
