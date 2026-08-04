import Phaser from "phaser";
import { jitter, makeRandom, mix, rgb, type Rgb } from "./pixel";

export type GroundTileKey =
  | "stone"
  | "plaza"
  | "concrete"
  | "asphalt"
  | "zebra"
  | "paint"
  | "curb"
  | "bus-floor"
  | "bus-seat"
  | "grass"
  | "bush"
  | "dirt"
  | "wall"
  | "fence";

const TILE = 16;

export const GROUND_TEXTURE: Record<GroundTileKey, { normal: string; warm: string }> = {
  stone: { normal: "ground-stone", warm: "ground-stone-warm" },
  plaza: { normal: "ground-plaza", warm: "ground-plaza-warm" },
  concrete: { normal: "ground-concrete", warm: "ground-concrete-warm" },
  asphalt: { normal: "ground-asphalt", warm: "ground-asphalt-warm" },
  zebra: { normal: "ground-zebra", warm: "ground-zebra-warm" },
  paint: { normal: "ground-paint", warm: "ground-paint-warm" },
  curb: { normal: "ground-curb", warm: "ground-curb-warm" },
  "bus-floor": { normal: "ground-bus-floor", warm: "ground-bus-floor-warm" },
  "bus-seat": { normal: "ground-bus-seat", warm: "ground-bus-seat-warm" },
  grass: { normal: "ground-grass", warm: "ground-grass-warm" },
  bush: { normal: "ground-bush", warm: "ground-bush-warm" },
  dirt: { normal: "ground-dirt", warm: "ground-dirt-warm" },
  wall: { normal: "ground-wall", warm: "ground-wall-warm" },
  fence: { normal: "ground-fence", warm: "ground-fence-warm" },
};

export const TREE_TEXTURE = { normal: "ground-tree", warm: "ground-tree-warm" } as const;

/** muted warm-gray base; cane contact restores the saturated after-rain warmth */
type TonePair = { normal: Rgb; warm: Rgb };

const TONES: Record<GroundTileKey, TonePair> = {
  stone: { normal: [125, 122, 108], warm: [158, 136, 94] },
  plaza: { normal: [112, 109, 97], warm: [146, 124, 86] },
  concrete: { normal: [132, 130, 122], warm: [164, 143, 108] },
  asphalt: { normal: [86, 86, 88], warm: [98, 90, 82] },
  zebra: { normal: [146, 143, 132], warm: [208, 174, 104] },
  paint: { normal: [166, 145, 86], warm: [202, 166, 78] },
  curb: { normal: [140, 137, 126], warm: [170, 148, 108] },
  "bus-floor": { normal: [96, 101, 99], warm: [124, 111, 89] },
  "bus-seat": { normal: [76, 83, 84], warm: [126, 101, 70] },
  grass: { normal: [104, 110, 94], warm: [88, 132, 76] },
  bush: { normal: [88, 100, 78], warm: [66, 122, 66] },
  dirt: { normal: [106, 97, 82], warm: [132, 106, 70] },
  wall: { normal: [130, 124, 112], warm: [172, 142, 102] },
  fence: { normal: [74, 72, 66], warm: [96, 82, 60] },
};

function darken(color: Rgb, amount: number): Rgb {
  return mix(color, [20, 20, 18], amount);
}

function lighten(color: Rgb, amount: number): Rgb {
  return mix(color, [245, 240, 225], amount);
}

function drawStone(ctx: CanvasRenderingContext2D, tone: Rgb, seed: number, gridSeam: boolean): void {
  const rand = makeRandom(seed);
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      ctx.fillStyle = jitter(rand, tone, 8);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = rgb(darken(tone, 0.28));
  ctx.fillRect(0, TILE - 1, TILE, 1);
  ctx.fillRect(TILE - 1, 0, 1, TILE);
  if (gridSeam) {
    ctx.fillRect(0, 0, TILE, 1);
    ctx.fillRect(0, 0, 1, TILE);
  } else {
    ctx.fillStyle = rgb(lighten(tone, 0.18));
    ctx.fillRect(0, 0, TILE, 1);
  }
  // wet speckles
  for (let count = 0; count < 5; count += 1) {
    ctx.fillStyle = jitter(rand, lighten(tone, 0.22), 6);
    ctx.fillRect(Math.floor(rand() * TILE), Math.floor(rand() * TILE), 1, 1);
  }
}

function drawAsphalt(ctx: CanvasRenderingContext2D, tone: Rgb, seed: number): void {
  const rand = makeRandom(seed);
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      ctx.fillStyle = jitter(rand, tone, 5);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  for (let count = 0; count < 7; count += 1) {
    ctx.fillStyle = jitter(rand, lighten(tone, 0.25), 4);
    ctx.fillRect(Math.floor(rand() * TILE), Math.floor(rand() * TILE), 1, 1);
  }
}

function drawCurb(ctx: CanvasRenderingContext2D, tone: Rgb, seed: number): void {
  const rand = makeRandom(seed);
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      ctx.fillStyle = jitter(rand, tone, 6);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = rgb(lighten(tone, 0.3));
  ctx.fillRect(0, 0, TILE, 4);
  ctx.fillStyle = rgb(darken(tone, 0.32));
  ctx.fillRect(0, TILE - 4, TILE, 4);
  ctx.fillStyle = rgb(darken(tone, 0.18));
  ctx.fillRect(0, 4, TILE, 1);
}

function drawGrass(ctx: CanvasRenderingContext2D, tone: Rgb, seed: number): void {
  const rand = makeRandom(seed);
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      ctx.fillStyle = jitter(rand, tone, 7);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  for (let count = 0; count < 12; count += 1) {
    const light = rand() > 0.5;
    ctx.fillStyle = jitter(rand, light ? lighten(tone, 0.2) : darken(tone, 0.2), 5);
    ctx.fillRect(Math.floor(rand() * TILE), Math.floor(rand() * TILE), 1, 2);
  }
}

function drawBush(ctx: CanvasRenderingContext2D, tone: Rgb, seed: number): void {
  const rand = makeRandom(seed);
  drawGrass(ctx, darken(tone, 0.08), seed + 1);
  for (let blob = 0; blob < 5; blob += 1) {
    const cx = 3 + rand() * 10;
    const cy = 3 + rand() * 10;
    const radius = 2.5 + rand() * 2;
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        const distance = Math.hypot(x - cx, y - cy);
        if (distance > radius) continue;
        const shade = y < cy ? lighten(tone, 0.16) : darken(tone, 0.16);
        ctx.fillStyle = jitter(rand, shade, 7);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function drawDirt(ctx: CanvasRenderingContext2D, tone: Rgb, seed: number): void {
  const rand = makeRandom(seed);
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      ctx.fillStyle = jitter(rand, tone, 9);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  for (let count = 0; count < 6; count += 1) {
    ctx.fillStyle = jitter(rand, rand() > 0.5 ? lighten(tone, 0.18) : darken(tone, 0.2), 6);
    ctx.fillRect(Math.floor(rand() * TILE), Math.floor(rand() * TILE), 2, 1);
  }
}

function drawPaint(ctx: CanvasRenderingContext2D, tone: Rgb, seed: number): void {
  drawStone(ctx, tone, seed, false);
  ctx.fillStyle = rgb(lighten(tone, 0.24));
  ctx.fillRect(0, 2, TILE, 3);
  ctx.fillStyle = rgb(darken(tone, 0.2));
  ctx.fillRect(0, 5, TILE, 1);
}

function drawZebra(ctx: CanvasRenderingContext2D, tone: Rgb, seed: number): void {
  drawStone(ctx, tone, seed, false);
  ctx.fillStyle = rgb(darken(tone, 0.32));
  ctx.fillRect(0, 0, TILE, 3);
  ctx.fillRect(0, 7, TILE, 3);
  ctx.fillRect(0, 14, TILE, 2);
}

function drawBusFloor(ctx: CanvasRenderingContext2D, tone: Rgb, seed: number): void {
  drawStone(ctx, tone, seed, true);
  ctx.fillStyle = rgb(lighten(tone, 0.12));
  ctx.fillRect(2, 7, 12, 1);
  ctx.fillRect(2, 8, 12, 1);
}

function drawBusSeat(ctx: CanvasRenderingContext2D, tone: Rgb, seed: number): void {
  drawStone(ctx, tone, seed, false);
  ctx.fillStyle = rgb(lighten(tone, 0.18));
  ctx.fillRect(2, 2, 12, 3);
  ctx.fillRect(3, 5, 10, 7);
  ctx.fillStyle = rgb(darken(tone, 0.42));
  ctx.fillRect(3, 11, 10, 2);
  ctx.fillRect(1, 14, 14, 1);
}

function drawWall(ctx: CanvasRenderingContext2D, tone: Rgb, seed: number): void {
  const rand = makeRandom(seed);
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      ctx.fillStyle = jitter(rand, tone, 6);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // masonry courses
  ctx.fillStyle = rgb(darken(tone, 0.3));
  [3, 7, 11, 15].forEach((y) => ctx.fillRect(0, y, TILE, 1));
  [1, 5, 9, 13].forEach((y, row) => {
    for (let x = row % 2 === 0 ? 4 : 0; x < TILE; x += 8) ctx.fillRect(x, y, 1, 3);
  });
  // small shuttered window
  ctx.fillStyle = rgb(darken(tone, 0.5));
  ctx.fillRect(10, 4, 5, 7);
  ctx.fillStyle = rgb(lighten(tone, 0.25));
  ctx.fillRect(10, 4, 5, 1);
  ctx.fillStyle = rgb(darken(tone, 0.2));
  ctx.fillRect(9, 11, 7, 1);
}

function drawFence(ctx: CanvasRenderingContext2D, tone: Rgb, seed: number): void {
  const rand = makeRandom(seed);
  ctx.fillStyle = rgb(darken(tone, 0.35));
  ctx.fillRect(0, 0, TILE, TILE);
  for (let x = 1; x < TILE; x += 4) {
    for (let y = 1; y < TILE - 1; y += 1) {
      ctx.fillStyle = jitter(rand, tone, 5);
      ctx.fillRect(x, y, 2, 1);
      ctx.fillStyle = jitter(rand, lighten(tone, 0.25), 4);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = rgb(lighten(tone, 0.15));
  ctx.fillRect(0, 0, TILE, 1);
  ctx.fillStyle = rgb(darken(tone, 0.5));
  ctx.fillRect(0, TILE - 1, TILE, 1);
}

function drawTree(ctx: CanvasRenderingContext2D, warm: boolean, seed: number): void {
  const rand = makeRandom(seed);
  const size = 24;
  const canopy: Rgb = warm ? [70, 124, 66] : [92, 102, 82];
  const trunk: Rgb = warm ? [110, 84, 58] : [96, 88, 76];
  ctx.clearRect(0, 0, size, size);
  // ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(12, 21, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgb(trunk);
  ctx.fillRect(10, 14, 4, 7);
  ctx.fillStyle = rgb(darken(trunk, 0.25));
  ctx.fillRect(13, 14, 1, 7);
  // ragged canopy blob
  for (let y = 0; y < 18; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - 12, y - 8);
      const ragged = 8.4 + Math.sin(x * 2.1 + seed) * 0.9 + Math.cos(y * 1.7) * 0.7;
      if (distance > ragged) continue;
      const shade = distance > ragged - 1.2 ? darken(canopy, 0.3) : y < 8 ? lighten(canopy, 0.16) : canopy;
      ctx.fillStyle = jitter(rand, shade, 8);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

const DRAWERS: Record<GroundTileKey, (ctx: CanvasRenderingContext2D, tone: Rgb, seed: number) => void> = {
  stone: (ctx, tone, seed) => drawStone(ctx, tone, seed, false),
  plaza: (ctx, tone, seed) => drawStone(ctx, tone, seed, true),
  concrete: (ctx, tone, seed) => drawStone(ctx, tone, seed, false),
  asphalt: drawAsphalt,
  zebra: drawZebra,
  paint: drawPaint,
  curb: drawCurb,
  "bus-floor": drawBusFloor,
  "bus-seat": drawBusSeat,
  grass: drawGrass,
  bush: drawBush,
  dirt: drawDirt,
  wall: drawWall,
  fence: drawFence,
};

/** Generate all ground tile textures (normal + warm variants) once per game. */
export function ensureGroundTextures(scene: Phaser.Scene): void {
  (Object.keys(GROUND_TEXTURE) as GroundTileKey[]).forEach((key, index) => {
    const pair = GROUND_TEXTURE[key];
    const tones = TONES[key];
    const make = (textureKey: string, tone: Rgb, seed: number): void => {
      if (scene.textures.exists(textureKey)) return;
      const texture = scene.textures.createCanvas(textureKey, TILE, TILE);
      if (!texture) return;
      DRAWERS[key](texture.getContext(), tone, seed);
      texture.refresh();
    };
    make(pair.normal, tones.normal, 9100 + index * 17);
    make(pair.warm, tones.warm, 9200 + index * 17);
  });
  if (!scene.textures.exists(TREE_TEXTURE.normal)) {
    const normal = scene.textures.createCanvas(TREE_TEXTURE.normal, 24, 24);
    if (normal) {
      drawTree(normal.getContext(), false, 777);
      normal.refresh();
    }
  }
  if (!scene.textures.exists(TREE_TEXTURE.warm)) {
    const warm = scene.textures.createCanvas(TREE_TEXTURE.warm, 24, 24);
    if (warm) {
      drawTree(warm.getContext(), true, 778);
      warm.refresh();
    }
  }
}
