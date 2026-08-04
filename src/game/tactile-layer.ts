import Phaser from "phaser";

const GUIDANCE = "tactile-guidance";
const GUIDANCE_LIT = "tactile-guidance-lit";
const DECISION = "tactile-decision";
const DECISION_LIT = "tactile-decision-lit";

export const TACTILE_TEXTURE = {
  guidance: GUIDANCE,
  guidanceLit: GUIDANCE_LIT,
  decision: DECISION,
  decisionLit: DECISION_LIT,
} as const;

/** 16px brick body inside a 20px canvas; the margin carries grout and contact shadow */
const CANVAS = 20;
const MARGIN = 2;

type Rgb = [number, number, number];

interface BrickPalette {
  base: Rgb;
  grout: Rgb;
  seamLight: Rgb;
  ridge: Rgb;
  ridgeLight: Rgb;
  ridgeDark: Rgb;
}

/** weathered warm-gray tactile brick, close to pavement stone so it reads as embedded */
const NORMAL: BrickPalette = {
  base: [125, 122, 108],
  grout: [74, 71, 60],
  seamLight: [150, 146, 128],
  ridge: [168, 162, 138],
  ridgeLight: [196, 190, 164],
  ridgeDark: [88, 84, 68],
};

/** cane-contact enhanced brick, restored warm Macau-after-rain color */
const LIT: BrickPalette = {
  base: [164, 134, 74],
  grout: [104, 84, 44],
  seamLight: [200, 172, 110],
  ridge: [226, 198, 128],
  ridgeLight: [246, 230, 176],
  ridgeDark: [128, 102, 52],
};

/** deterministic LCG so textures are stable frame to frame */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function jitter(rand: () => number, color: Rgb, amount: number): string {
  const delta = Math.floor(rand() * (amount * 2 + 1)) - amount;
  const clamp = (value: number) => Math.max(0, Math.min(255, value + delta));
  return `rgb(${clamp(color[0])},${clamp(color[1])},${clamp(color[2])})`;
}

function rgb(color: Rgb): string {
  return `rgb(${color[0]},${color[1]},${color[2]})`;
}

function drawBrick(ctx: CanvasRenderingContext2D, palette: BrickPalette, kind: "guidance" | "decision", seed: number): void {
  const rand = makeRandom(seed);
  const x0 = MARGIN;
  const y0 = MARGIN;
  ctx.clearRect(0, 0, CANVAS, CANVAS);

  // soft contact shadow bleeding into the margin, grounding the brick in the pavement
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(x0 - 1, y0 + 1, 18, 18);
  // grout bed between bricks
  ctx.fillStyle = rgb(palette.grout);
  ctx.fillRect(x0, y0, 16, 16);
  // brick body with per-pixel stone noise
  for (let y = 1; y < 15; y += 1) {
    for (let x = 1; x < 15; x += 1) {
      ctx.fillStyle = jitter(rand, palette.base, 7);
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
  }
  // wet top highlight and settled bottom shadow
  for (let x = 1; x < 15; x += 1) {
    ctx.fillStyle = jitter(rand, palette.seamLight, 5);
    ctx.fillRect(x0 + x, y0 + 1, 1, 1);
    ctx.fillStyle = jitter(rand, palette.grout, 4);
    ctx.fillRect(x0 + x, y0 + 14, 1, 1);
  }
  // worn corners
  const corners: Array<[number, number]> = [[1, 1], [2, 1], [1, 2], [14, 1], [13, 1], [14, 2], [1, 14], [2, 14], [1, 13], [14, 14], [13, 14], [14, 13]];
  for (let count = 0; count < 2; count += 1) {
    const [cx, cy] = corners[Math.floor(rand() * corners.length)];
    ctx.fillStyle = rgb(palette.grout);
    ctx.fillRect(x0 + cx, y0 + cy, 1, 1);
  }

  if (kind === "guidance") {
    // four chunky ridges along the travel direction (texture is vertical; sprites rotate)
    for (let index = 0; index < 4; index += 1) {
      const rx = x0 + 2 + index * 3;
      for (let y = 3; y < 14; y += 1) {
        ctx.fillStyle = jitter(rand, palette.ridgeDark, 5);
        ctx.fillRect(rx + 1, y0 + y + 1, 1, 1);
      }
      for (let y = 2; y < 14; y += 1) {
        const rounded = y === 2 || y === 13;
        ctx.fillStyle = jitter(rand, palette.ridge, 6);
        ctx.fillRect(rx, y0 + y, 1, 1);
        if (!rounded) {
          ctx.fillStyle = jitter(rand, palette.ridge, 6);
          ctx.fillRect(rx + 1, y0 + y, 1, 1);
        }
        ctx.fillStyle = jitter(rand, palette.ridgeLight, 5);
        ctx.fillRect(rx, y0 + y, 1, 1);
      }
    }
    return;
  }

  // decision brick: 4x4 raised dots with offset shadow and pinpoint highlight
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const cx = x0 + 3 + col * 3;
      const cy = y0 + 3 + row * 3;
      ctx.fillStyle = rgb(palette.ridgeDark);
      ctx.fillRect(cx + 1, cy + 1, 1, 1);
      ctx.fillStyle = jitter(rand, palette.ridge, 6);
      ctx.fillRect(cx, cy, 1, 1);
      ctx.fillRect(cx - 1, cy, 1, 1);
      ctx.fillStyle = jitter(rand, palette.ridgeLight, 5);
      ctx.fillRect(cx, cy - 1, 1, 1);
    }
  }
}

/** Generate the four procedural tactile-brick textures once per game. */
export function ensureTactileTextures(scene: Phaser.Scene): void {
  const make = (key: string, kind: "guidance" | "decision", palette: BrickPalette, seed: number): void => {
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, CANVAS, CANVAS);
    if (!texture) return;
    drawBrick(texture.getContext(), palette, kind, seed);
    texture.refresh();
  };
  make(GUIDANCE, "guidance", NORMAL, 20260804);
  make(GUIDANCE_LIT, "guidance", LIT, 20260805);
  make(DECISION, "decision", NORMAL, 20260806);
  make(DECISION_LIT, "decision", LIT, 20260807);
}
