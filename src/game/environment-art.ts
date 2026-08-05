import Phaser from "phaser";
import architectureBaseUrl from "../assets/macau-architecture-base.png";
import architectureMemoryUrl from "../assets/macau-architecture-memory.png";
import architectureWarmUrl from "../assets/macau-architecture-warm.png";
import ruinsFacadeBaseUrl from "../assets/ruins-facade-base.png";
import ruinsFacadeMemoryUrl from "../assets/ruins-facade-memory.png";
import busInteriorModulesUrl from "../assets/bus-interior-modules-pixel.png";
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

const BUS_MODULE_CROPS = {
  window: { x: 80, y: 72, width: 530, height: 432 },
  rail: { x: 1206, y: 47, width: 86, height: 510 },
  cardReader: { x: 167, y: 610, width: 192, height: 342 },
  bell: { x: 535, y: 677, width: 141, height: 240 },
  light: { x: 800, y: 709, width: 632, height: 147 },
} satisfies Record<string, Crop>;

type BusModuleKey = keyof typeof BUS_MODULE_CROPS;
const BUS_MODULE_KINDS: Partial<Record<DecorationKind, BusModuleKey>> = {
  "bus-window": "window",
  "bus-rail": "rail",
  "bus-card-reader": "cardReader",
  "bus-bell": "bell",
  "bus-light": "light",
};

const PROGRAMMATIC_KINDS = ["shelter", "bus", "bench", "lamp", "signal", "bus-window", "bus-pole", "bus-seat-row", "bus-driver-seat", "stop-sign-17", "stop-sign-25"] as const;
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

type BusSeatOrientation = "upper" | "lower" | "driver";

function drawBusSeat(ctx: CanvasRenderingContext2D, width: number, height: number, state: GroundVisualState, orientation: BusSeatOrientation): void {
  const p = PALETTES[state];
  ctx.clearRect(0, 0, width, height);
  if (orientation === "driver") {
    rect(ctx, p.dark, 3, 3, width - 6, height - 6);
    rect(ctx, p.metal, 7, 7, width - 17, height - 14);
    rect(ctx, p.stone, 11, 11, width - 25, height - 22);
    rect(ctx, p.light, 13, 14, width - 29, 3);
    rect(ctx, p.glow, width - 12, 11, 5, height - 22);
    rect(ctx, p.dark, 8, height - 8, width - 16, 4);
    return;
  }

  const backY = orientation === "upper" ? 3 : height - 22;
  const cushionY = orientation === "upper" ? height - 27 : 10;
  const cushionHeight = 18;
  // The backrest sits against the window wall; the cushion opens toward the aisle.
  rect(ctx, p.dark, 3, 2, width - 6, height - 4);
  rect(ctx, p.metal, 6, backY, width - 12, 20);
  rect(ctx, p.stone, 9, backY + 4, width - 18, 12);
  rect(ctx, p.light, 11, backY + 5, width - 22, 2);
  rect(ctx, p.dark, 7, cushionY, width - 14, cushionHeight);
  rect(ctx, p.stone, 10, cushionY + 3, width - 20, cushionHeight - 7);
  rect(ctx, p.glow, 11, orientation === "upper" ? cushionY + cushionHeight - 4 : cushionY + 2, width - 22, 2);
  rect(ctx, p.metal, 5, 8, 3, height - 16);
  rect(ctx, p.metal, width - 8, 8, 3, height - 16);
  rect(ctx, p.light, 5, orientation === "upper" ? height - 7 : 4, 3, 3);
  rect(ctx, p.light, width - 8, orientation === "upper" ? height - 7 : 4, 3, 3);
}

function drawBusDriver(ctx: CanvasRenderingContext2D, state: GroundVisualState): void {
  const p = PALETTES[state];
  ctx.clearRect(0, 0, 64, 64);
  // A compact seated side profile facing the right-hand-drive console.
  rect(ctx, p.dark, 20, 20, 22, 30);
  rect(ctx, p.metal, 23, 24, 16, 24);
  rect(ctx, p.stone, 25, 27, 12, 16);
  rect(ctx, p.dark, 33, 11, 15, 15);
  rect(ctx, p.glow, 36, 15, 10, 8);
  rect(ctx, p.dark, 38, 11, 10, 4);
  rect(ctx, p.light, 45, 17, 3, 3);
  rect(ctx, p.light, 41, 22, 6, 2);
  rect(ctx, p.dark, 39, 28, 16, 5);
  rect(ctx, p.light, 49, 29, 8, 2);
  rect(ctx, p.dark, 21, 45, 17, 8);
  rect(ctx, p.metal, 26, 50, 15, 5);
  rect(ctx, p.dark, 39, 44, 9, 10);
  rect(ctx, p.metal, 45, 51, 12, 5);
  rect(ctx, p.glow, 54, 29, 5, 3);
}

function drawProgrammatic(ctx: CanvasRenderingContext2D, kind: DecorationKind, width: number, height: number, state: GroundVisualState, orientation?: BusSeatOrientation): void {
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
  } else if (kind === "bus-seat-row" || kind === "bus-driver-seat") {
    drawBusSeat(ctx, width, height, state, kind === "bus-driver-seat" ? "driver" : (orientation ?? "upper"));
  }
}

export function preloadEnvironmentAssets(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ARCHITECTURE_TEXTURE.base)) scene.load.image(ARCHITECTURE_TEXTURE.base, architectureBaseUrl);
  if (!scene.textures.exists(ARCHITECTURE_TEXTURE.memory)) scene.load.image(ARCHITECTURE_TEXTURE.memory, architectureMemoryUrl);
  if (!scene.textures.exists(ARCHITECTURE_TEXTURE.warm)) scene.load.image(ARCHITECTURE_TEXTURE.warm, architectureWarmUrl);
  if (!scene.textures.exists(RUINS_FACADE_TEXTURE.base)) scene.load.image(RUINS_FACADE_TEXTURE.base, ruinsFacadeBaseUrl);
  if (!scene.textures.exists(RUINS_FACADE_TEXTURE.memory)) scene.load.image(RUINS_FACADE_TEXTURE.memory, ruinsFacadeMemoryUrl);
  if (!scene.textures.exists(RUINS_FACADE_TEXTURE.warm)) scene.load.image(RUINS_FACADE_TEXTURE.warm, ruinsFacadeWarmUrl);
  if (!scene.textures.exists("bus-interior-modules")) scene.load.image("bus-interior-modules", busInteriorModulesUrl);
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
function ensureProgrammaticTextures(scene: Phaser.Scene, kind: ProgrammaticKind, width: number, height: number, orientation?: BusSeatOrientation): Record<GroundVisualState, string> {
  const textures = {} as Record<GroundVisualState, string>;
  STATES.forEach((state) => {
    const orientationKey = orientation ?? "none";
    const key = `environment-${kind}-${orientationKey}-${state}-${width}x${height}`;
    textures[state] = key;
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, width, height);
    if (!texture) return;
    drawProgrammatic(texture.getContext(), kind, width, height, state, orientation);
    texture.refresh();
  });
  return textures;
}

function ensureBusDriverTextures(scene: Phaser.Scene): Record<GroundVisualState, string> {
  const textures = {} as Record<GroundVisualState, string>;
  STATES.forEach((state) => {
    const key = `bus-driver-${state}`;
    textures[state] = key;
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, 64, 64);
    if (!texture) return;
    drawBusDriver(texture.getContext(), state);
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

function ensureBusModuleTextures(scene: Phaser.Scene, kind: BusModuleKey, width: number, height: number): Record<GroundVisualState, string> | undefined {
  const sourceTexture = scene.textures.get("bus-interior-modules");
  if (!sourceTexture || !sourceTexture.key || sourceTexture.key === "__MISSING") return undefined;
  const source = sourceTexture.getSourceImage() as CanvasImageSource;
  const crop = BUS_MODULE_CROPS[kind];
  const textures = {} as Record<GroundVisualState, string>;
  STATES.forEach((state) => {
    const key = `bus-module-${kind}-${state}-${width}x${height}`;
    textures[state] = key;
    if (scene.textures.exists(key)) return;
    const canvasTexture = scene.textures.createCanvas(key, width, height);
    if (!canvasTexture) return;
    const ctx = canvasTexture.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    if (state !== "warm") {
      const image = ctx.getImageData(0, 0, width, height);
      for (let index = 0; index < image.data.length; index += 4) {
        const r = image.data[index];
        const g = image.data[index + 1];
        const b = image.data[index + 2];
        const gray = Math.round(r * 0.24 + g * 0.68 + b * 0.08);
        const mix = state === "memory" ? 0.34 : 0;
        image.data[index] = Math.round(gray * (1 - mix) + r * mix);
        image.data[index + 1] = Math.round(gray * (1 - mix) + g * mix);
        image.data[index + 2] = Math.round(gray * (1 - mix) + b * mix);
      }
      ctx.putImageData(image, 0, 0);
    }
    canvasTexture.refresh();
  });
  return textures;
}

export function renderMapDecoration(scene: Phaser.Scene, decoration: MapDecoration): EnvironmentSprite | EnvironmentSprite[] | null {
  // The driver seat keeps its collision footprint in the map, while the
  // seated driver sprite is rendered by BusInteriorScene on top of it.
  if (decoration.kind === "bus-driver-seat") return null;
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
  const busModule = BUS_MODULE_KINDS[decoration.kind];
  if (busModule) {
    const width = Math.max(1, Math.round(decoration.width));
    const height = Math.max(1, Math.round(decoration.height));
    const textures = ensureBusModuleTextures(scene, busModule, width, height);
    if (!textures) return null;
    const sprite = scene.add.image(decoration.x, decoration.y, textures.base)
      .setOrigin(0.5, 1)
      .setDisplaySize(width, height)
      .setDepth(decoration.depth ?? decoration.y);
    if (decoration.flipX) sprite.setFlipX(true);
    return { sprite, textures, x: decoration.x, y: decoration.y - height / 2 };
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
  const textures = ensureProgrammaticTextures(scene, decoration.kind as ProgrammaticKind, width, height, decoration.orientation);
  const sprite = scene.add.image(decoration.x, decoration.y, textures.base).setOrigin(0.5, 1).setDisplaySize(width, height).setDepth(decoration.y);
  if (decoration.flipX) sprite.setFlipX(true);
  return { sprite, textures, x: decoration.x, y: decoration.y - height / 2 };
}

/** Render the bell only when the bus scene has announced its destination. */
export function renderBusBellDecoration(scene: Phaser.Scene, point: { x: number; y: number }): EnvironmentSprite | null {
  const textures = ensureBusModuleTextures(scene, "bell", 20, 34);
  if (!textures) return null;
  const sprite = scene.add.image(point.x, point.y + 34, textures.base)
    .setOrigin(0.5, 1)
    .setDisplaySize(20, 34)
    .setDepth(point.y + 22);
  return { sprite, textures, x: point.x, y: point.y };
}

export function renderBusDriverDecoration(scene: Phaser.Scene, point: { x: number; y: number }): EnvironmentSprite {
  const textures = ensureBusDriverTextures(scene);
  const sprite = scene.add.image(point.x, point.y, textures.base)
    .setOrigin(0.5, 1)
    .setDisplaySize(48, 48)
    .setDepth(point.y + 2);
  return { sprite, textures, x: point.x, y: point.y };
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
