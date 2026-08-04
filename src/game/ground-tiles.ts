import Phaser from "phaser";
import { jitter, makeRandom, mix, rgb, type Rgb } from "./pixel";

export type GroundTileKey =
  | "stone"
  | "plaza"
  | "sidewalk"
  | "concrete"
  | "asphalt"
  | "zebra"
  | "lane"
  | "paint"
  | "curb"
  | "drain"
  | "manhole"
  | "steps"
  | "building"
  | "bus-floor"
  | "metal-floor"
  | "bus-seat"
  | "grass"
  | "bush"
  | "dirt"
  | "wall"
  | "fence";

export type GroundVisualState = "base" | "memory" | "warm";
export type GroundTextureSet = Record<GroundVisualState, readonly [string, string, string]>;

const TILE = 16;
const STATES: GroundVisualState[] = ["base", "memory", "warm"];

const KEYS: GroundTileKey[] = [
  "stone", "plaza", "sidewalk", "concrete", "asphalt", "zebra", "lane", "paint", "curb", "drain", "manhole", "steps", "building",
  "bus-floor", "metal-floor", "bus-seat", "grass", "bush", "dirt", "wall", "fence",
];

function textureSet(key: GroundTileKey): GroundTextureSet {
  const state = (name: GroundVisualState): readonly [string, string, string] => [0, 1, 2].map((variant) => `ground-${key}-${name}-${variant}`) as unknown as readonly [string, string, string];
  return { base: state("base"), memory: state("memory"), warm: state("warm") };
}

export const GROUND_TEXTURE = Object.fromEntries(KEYS.map((key) => [key, textureSet(key)])) as Record<GroundTileKey, GroundTextureSet>;
export const TREE_TEXTURE: Record<GroundVisualState, string> = { base: "ground-tree-base", memory: "ground-tree-memory", warm: "ground-tree-warm" };

type ToneSet = Record<GroundVisualState, Rgb>;

const WARM_TONES: Record<GroundTileKey, Rgb> = {
  stone: [158, 136, 94], plaza: [146, 124, 86], sidewalk: [178, 163, 132], concrete: [164, 143, 108], asphalt: [93, 87, 82],
  zebra: [211, 190, 143], lane: [202, 165, 76], paint: [202, 166, 78], curb: [174, 151, 111], drain: [93, 88, 78], manhole: [104, 94, 80],
  steps: [167, 144, 106], building: [146, 126, 103], "bus-floor": [124, 111, 89], "metal-floor": [129, 126, 115], "bus-seat": [126, 101, 70],
  grass: [88, 132, 76], bush: [66, 122, 66], dirt: [132, 106, 70], wall: [172, 142, 102], fence: [96, 82, 60],
};

function grayscale(color: Rgb): Rgb {
  const value = Math.round(color[0] * 0.24 + color[1] * 0.68 + color[2] * 0.08);
  return [value, value, value];
}

const TONES = Object.fromEntries(KEYS.map((key) => {
  const warm = WARM_TONES[key];
  const base = grayscale(warm);
  return [key, { base, memory: mix(base, warm, 0.34), warm } satisfies ToneSet];
})) as Record<GroundTileKey, ToneSet>;

function darken(color: Rgb, amount: number): Rgb { return mix(color, [20, 20, 20], amount); }
function lighten(color: Rgb, amount: number): Rgb { return mix(color, [242, 239, 227], amount); }

function noisyFill(ctx: CanvasRenderingContext2D, tone: Rgb, seed: number, variance = 6): void {
  const rand = makeRandom(seed);
  for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) {
    ctx.fillStyle = jitter(rand, tone, variance);
    ctx.fillRect(x, y, 1, 1);
  }
}

function seam(ctx: CanvasRenderingContext2D, tone: Rgb, horizontal = true, vertical = true): void {
  ctx.fillStyle = rgb(darken(tone, 0.27));
  if (horizontal) ctx.fillRect(0, 15, 16, 1);
  if (vertical) ctx.fillRect(15, 0, 1, 16);
  ctx.fillStyle = rgb(lighten(tone, 0.14));
  ctx.fillRect(0, 0, 16, 1);
}

function drawTile(ctx: CanvasRenderingContext2D, key: GroundTileKey, tone: Rgb, seed: number, variant: number): void {
  const rand = makeRandom(seed);
  noisyFill(ctx, tone, seed, key === "asphalt" ? 4 : 7);
  if (["stone", "plaza", "sidewalk", "concrete", "bus-floor", "metal-floor"].includes(key)) {
    seam(ctx, tone, true, key !== "stone" || variant !== 1);
    if (key === "plaza" || key === "sidewalk") {
      ctx.fillStyle = rgb(darken(tone, 0.17));
      ctx.fillRect(variant === 2 ? 5 : 7, 0, 1, 16);
      ctx.fillRect(0, variant === 1 ? 6 : 8, 16, 1);
    }
    if (key === "bus-floor" || key === "metal-floor") {
      ctx.fillStyle = rgb(lighten(tone, 0.15));
      ctx.fillRect(2, 7, 12, key === "metal-floor" ? 2 : 1);
    }
  }
  if (key === "asphalt" || key === "lane" || key === "zebra") {
    for (let index = 0; index < 6; index += 1) {
      ctx.fillStyle = rgb(lighten(tone, 0.17));
      ctx.fillRect(Math.floor(rand() * 16), Math.floor(rand() * 16), 1, 1);
    }
    if (key === "lane") {
      ctx.fillStyle = rgb(lighten(tone, 0.5));
      ctx.fillRect(0, 6, 16, 4);
    }
    if (key === "zebra") {
      ctx.fillStyle = rgb(lighten(tone, 0.38));
      [0, 8].forEach((x) => ctx.fillRect(x, 0, 6, 16));
    }
  }
  if (key === "paint") {
    ctx.fillStyle = rgb(lighten(tone, 0.3));
    ctx.fillRect(0, 3, 16, 4);
  }
  if (key === "curb") {
    ctx.fillStyle = rgb(lighten(tone, 0.3)); ctx.fillRect(0, 0, 16, 4);
    ctx.fillStyle = rgb(darken(tone, 0.36)); ctx.fillRect(0, 12, 16, 4);
  }
  if (key === "drain") {
    ctx.fillStyle = rgb(darken(tone, 0.45)); ctx.fillRect(0, 2, 16, 12);
    ctx.fillStyle = rgb(lighten(tone, 0.18));
    for (let x = variant; x < 16; x += 4) ctx.fillRect(x, 3, 1, 10);
  }
  if (key === "manhole") {
    ctx.fillStyle = rgb(darken(tone, 0.42)); ctx.beginPath(); ctx.arc(8, 8, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rgb(lighten(tone, 0.2)); ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = rgb(lighten(tone, 0.12)); ctx.fillRect(4, 7, 8, 1); ctx.fillRect(7, 4, 1, 8);
  }
  if (key === "steps") {
    for (let y = 3; y < 16; y += 4) { ctx.fillStyle = rgb(darken(tone, 0.28)); ctx.fillRect(0, y, 16, 1); }
  }
  if (key === "building" || key === "wall") {
    for (let y = 3; y < 16; y += 4) { ctx.fillStyle = rgb(darken(tone, 0.25)); ctx.fillRect(0, y, 16, 1); }
    for (let y = 0; y < 16; y += 8) for (let x = y === 0 ? 7 : 3; x < 16; x += 8) { ctx.fillStyle = rgb(darken(tone, 0.2)); ctx.fillRect(x, y, 1, 3); }
    if (key === "building") { ctx.fillStyle = rgb(darken(tone, 0.55)); ctx.fillRect(5, 5, 6, 8); ctx.fillStyle = rgb(lighten(tone, 0.32)); ctx.fillRect(6, 6, 4, 2); }
  }
  if (key === "bus-seat") {
    ctx.fillStyle = rgb(lighten(tone, 0.17)); ctx.fillRect(2, 2, 12, 4);
    ctx.fillStyle = rgb(darken(tone, 0.36)); ctx.fillRect(3, 6, 10, 7);
  }
  if (key === "grass" || key === "bush") {
    for (let index = 0; index < (key === "bush" ? 22 : 12); index += 1) {
      ctx.fillStyle = rgb(index % 2 ? lighten(tone, 0.2) : darken(tone, 0.2));
      ctx.fillRect(Math.floor(rand() * 16), Math.floor(rand() * 15), 1, key === "bush" ? 2 : 1);
    }
  }
  if (key === "dirt") for (let index = 0; index < 7; index += 1) { ctx.fillStyle = rgb(darken(tone, 0.24)); ctx.fillRect(Math.floor(rand() * 15), Math.floor(rand() * 16), 2, 1); }
  if (key === "fence") {
    ctx.fillStyle = rgb(darken(tone, 0.5)); ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = rgb(lighten(tone, 0.2)); for (let x = 1; x < 16; x += 4) ctx.fillRect(x, 0, 2, 16);
  }
}

export function deterministicTileVariant(sceneId: string, col: number, row: number, key: GroundTileKey): 0 | 1 | 2 {
  let hash = 2166136261;
  for (const char of `${sceneId}:${key}:${col}:${row}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return Math.abs(hash) % 3 as 0 | 1 | 2;
}

function drawTree(ctx: CanvasRenderingContext2D, state: GroundVisualState): void {
  const warm: Rgb = [71, 122, 66];
  const tone = state === "base" ? grayscale(warm) : state === "memory" ? mix(grayscale(warm), warm, 0.34) : warm;
  ctx.clearRect(0, 0, 24, 40);
  ctx.fillStyle = "rgba(20,20,20,0.22)"; ctx.fillRect(5, 36, 14, 3);
  ctx.fillStyle = rgb(darken(tone, 0.36)); ctx.fillRect(10, 22, 4, 16);
  const rand = makeRandom(state === "warm" ? 702 : state === "memory" ? 701 : 700);
  for (let y = 1; y < 27; y += 1) for (let x = 1; x < 23; x += 1) {
    const distance = Math.hypot(x - 12, y - 13);
    if (distance > 11 + Math.sin(x * 1.7) * 1.2) continue;
    ctx.fillStyle = jitter(rand, y < 12 ? lighten(tone, 0.16) : tone, 7); ctx.fillRect(x, y, 1, 1);
  }
}

export function ensureGroundTextures(scene: Phaser.Scene): void {
  KEYS.forEach((key, keyIndex) => STATES.forEach((state, stateIndex) => GROUND_TEXTURE[key][state].forEach((textureKey, variant) => {
    if (scene.textures.exists(textureKey)) return;
    const texture = scene.textures.createCanvas(textureKey, TILE, TILE);
    if (!texture) return;
    drawTile(texture.getContext(), key, TONES[key][state], 9100 + keyIndex * 97 + stateIndex * 17 + variant * 7, variant);
    texture.refresh();
  })));
  STATES.forEach((state) => {
    const textureKey = TREE_TEXTURE[state];
    if (scene.textures.exists(textureKey)) return;
    const texture = scene.textures.createCanvas(textureKey, 24, 40);
    if (!texture) return;
    drawTree(texture.getContext(), state);
    texture.refresh();
  });
}
