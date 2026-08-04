import Phaser from "phaser";
import architectureBaseUrl from "../assets/macau-architecture-base.png";
import architectureMemoryUrl from "../assets/macau-architecture-memory.png";
import architectureWarmUrl from "../assets/macau-architecture-warm.png";
import { TREE_TEXTURE, type GroundVisualState } from "./ground-tiles";
import type { DecorationKind, MapDecoration } from "./tilemap";

export const ARCHITECTURE_TEXTURE: Record<GroundVisualState, string> = {
  base: "architecture-base",
  memory: "architecture-memory",
  warm: "architecture-warm",
};

type Crop = { x: number; y: number; width: number; height: number };
const ARCHITECTURE_CROPS: Partial<Record<DecorationKind, Crop>> = {
  "arcade-house": { x: 20, y: 10, width: 180, height: 235 },
  "corner-house": { x: 15, y: 250, width: 220, height: 210 },
  arcade: { x: 500, y: 85, width: 300, height: 165 },
  "low-house": { x: 250, y: 295, width: 230, height: 165 },
  "stone-gate": { x: 495, y: 280, width: 305, height: 180 },
};

const PROGRAMMATIC_KINDS = ["gate-building", "shelter", "bus", "bench", "lamp", "signal", "bus-window", "bus-pole", "ruins-facade"] as const;
type ProgrammaticKind = (typeof PROGRAMMATIC_KINDS)[number];

const PROGRAMMATIC_SIZE: Record<ProgrammaticKind, { width: number; height: number }> = {
  "gate-building": { width: 320, height: 96 }, shelter: { width: 260, height: 86 }, bus: { width: 208, height: 72 }, bench: { width: 72, height: 28 },
  lamp: { width: 22, height: 86 }, signal: { width: 22, height: 70 }, "bus-window": { width: 320, height: 64 }, "bus-pole": { width: 12, height: 174 },
  "ruins-facade": { width: 286, height: 100 },
};

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
  if (kind === "gate-building") {
    rect(ctx, p.dark, 0, 12, width, height - 12); rect(ctx, p.stone, 4, 16, width - 8, height - 20); rect(ctx, p.light, 0, 10, width, 6);
    for (let x = 16; x < width - 16; x += 42) { rect(ctx, p.dark, x, 34, 24, 34); rect(ctx, p.glow, x + 4, 38, 16, 11); rect(ctx, p.dark, x + 11, 38, 2, 26); }
    rect(ctx, p.dark, width / 2 - 28, 48, 56, 44); rect(ctx, p.metal, width / 2 - 23, 54, 46, 38);
  } else if (kind === "shelter") {
    rect(ctx, p.dark, 0, 7, width, 9); rect(ctx, p.light, 4, 3, width - 8, 5);
    [12, width / 2, width - 12].forEach((x) => { rect(ctx, p.metal, x - 3, 14, 6, height - 14); rect(ctx, p.light, x - 2, 15, 2, height - 16); });
    rect(ctx, p.dark, 24, 56, width - 48, 5);
  } else if (kind === "bus") {
    rect(ctx, p.dark, 2, 8, width - 4, height - 12); rect(ctx, p.stone, 5, 12, width - 10, height - 22); rect(ctx, p.red, 5, height - 24, width - 10, 5);
    for (let x = 14; x < width - 54; x += 35) { rect(ctx, p.dark, x, 18, 28, 19); rect(ctx, p.glow, x + 3, 21, 22, 9); }
    rect(ctx, p.dark, width - 49, 14, 40, height - 22); rect(ctx, p.metal, width - 45, 18, 16, height - 30); rect(ctx, p.metal, width - 27, 18, 14, height - 30);
    [34, width - 38].forEach((x) => { ctx.fillStyle = p.dark; ctx.beginPath(); ctx.arc(x, height - 8, 9, 0, Math.PI * 2); ctx.fill(); });
  } else if (kind === "bench") {
    rect(ctx, p.light, 2, 3, width - 4, 6); rect(ctx, p.stone, 2, 12, width - 4, 8); rect(ctx, p.dark, 8, 20, 6, 8); rect(ctx, p.dark, width - 14, 20, 6, 8);
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
  } else if (kind === "ruins-facade") {
    rect(ctx, p.dark, 0, 16, width, height - 16); rect(ctx, p.stone, 5, 19, width - 10, height - 23); rect(ctx, p.light, 0, 13, width, 6);
    rect(ctx, p.stone, 34, 4, width - 68, 20); rect(ctx, p.light, 68, 0, width - 136, 7);
    const openings = [48, width / 2 - 18, width - 82];
    openings.forEach((x, index) => { rect(ctx, p.dark, x, index === 1 ? 36 : 46, index === 1 ? 36 : 28, index === 1 ? 58 : 38); rect(ctx, p.glow, x + 5, index === 1 ? 43 : 52, index === 1 ? 26 : 18, 9); });
    for (let x = 12; x < width; x += 28) rect(ctx, p.dark, x, 28, 2, height - 32);
  }
}

export function preloadEnvironmentAssets(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ARCHITECTURE_TEXTURE.base)) scene.load.image(ARCHITECTURE_TEXTURE.base, architectureBaseUrl);
  if (!scene.textures.exists(ARCHITECTURE_TEXTURE.memory)) scene.load.image(ARCHITECTURE_TEXTURE.memory, architectureMemoryUrl);
  if (!scene.textures.exists(ARCHITECTURE_TEXTURE.warm)) scene.load.image(ARCHITECTURE_TEXTURE.warm, architectureWarmUrl);
}

export function ensureEnvironmentTextures(scene: Phaser.Scene): void {
  PROGRAMMATIC_KINDS.forEach((kind) => STATES.forEach((state) => {
    const key = `environment-${kind}-${state}`;
    if (scene.textures.exists(key)) return;
    const size = PROGRAMMATIC_SIZE[kind];
    const texture = scene.textures.createCanvas(key, size.width, size.height);
    if (!texture) return;
    drawProgrammatic(texture.getContext(), kind, size.width, size.height, state);
    texture.refresh();
  }));
}

const STATES: GroundVisualState[] = ["base", "memory", "warm"];

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

export function renderMapDecoration(scene: Phaser.Scene, decoration: MapDecoration): EnvironmentSprite | null {
  if (decoration.kind === "tree") {
    const sprite = scene.add.image(decoration.x, decoration.y, TREE_TEXTURE.base).setOrigin(0.5, 1).setDisplaySize(decoration.width, decoration.height).setDepth(decoration.y);
    if (decoration.flipX) sprite.setFlipX(true);
    return { sprite, textures: TREE_TEXTURE, x: decoration.x, y: decoration.y - decoration.height / 2 };
  }
  const frames = ensureArchitectureFrames(scene, decoration.kind);
  if (frames) {
    const sprite = scene.add.image(decoration.x, decoration.y, ARCHITECTURE_TEXTURE.base, frames.base).setOrigin(0.5, 1).setDisplaySize(decoration.width, decoration.height).setDepth(decoration.y);
    if (decoration.flipX) sprite.setFlipX(true);
    return { sprite, textures: ARCHITECTURE_TEXTURE, frames, x: decoration.x, y: decoration.y - decoration.height / 2 };
  }
  if (!(PROGRAMMATIC_KINDS as readonly DecorationKind[]).includes(decoration.kind)) return null;
  const textures = Object.fromEntries(STATES.map((state) => [state, `environment-${decoration.kind}-${state}`])) as Record<GroundVisualState, string>;
  const sprite = scene.add.image(decoration.x, decoration.y, textures.base).setOrigin(0.5, 1).setDisplaySize(decoration.width, decoration.height).setDepth(decoration.y);
  if (decoration.flipX) sprite.setFlipX(true);
  return { sprite, textures, x: decoration.x, y: decoration.y - decoration.height / 2 };
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
