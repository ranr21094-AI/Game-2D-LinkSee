import type { GroundTileKey } from "./ground-tiles";
import { STANDARD_MOVEMENT_LEGEND, type TileMapDefinition } from "./tilemap";
import type { TilePoint } from "./types";

export const RUINS_TILE_LEGEND: Record<string, GroundTileKey> = {
  B: "building",
  t: "steps",
  r: "ramp",
  p: "plaza",
  s: "stone",
  w: "sidewalk",
  c: "curb",
  d: "drain",
  a: "asphalt",
  l: "lane",
};

const fill = (char: string): string => char.repeat(40);
const row = (fillChar: string, patches: Array<[number, string]> = []): string => {
  const chars = Array.from({ length: 40 }, () => fillChar);
  patches.forEach(([start, value]) => [...value].forEach((char, index) => { chars[start + index] = char; }));
  return chars.join("");
};

const grounds = [
  fill("B"), fill("B"), fill("B"), fill("B"), fill("B"), fill("B"),
  row("t", [[0, "BBBBBB"], [18, "rrrr"], [34, "BBBBBB"]]),
  row("t", [[0, "BBBBB"], [18, "rrrr"], [35, "BBBBB"]]),
  row("t", [[0, "BBBB"], [18, "rrrr"], [36, "BBBB"]]),
  row("t", [[18, "rrrr"]]),
  row("p", [[0, "BBBB"], [18, "rrrr"], [36, "BBBB"]]),
  row("p", [[0, "BBBB"], [18, "rrrr"], [36, "BBBB"]]),
  row("p", [[0, "BBB"], [18, "rrrr"], [37, "BBB"]]),
  row("p", [[18, "rrrr"]]), row("p", [[18, "rrrr"]]), row("s", [[18, "rrrr"]]), row("s", [[18, "rrrr"]]), row("w", [[18, "rrrr"]]),
  row("c", [[18, "rrrr"]]), row("d", [[18, "rrrr"]]),
  row("a", [[7, "llllll"], [27, "llllll"]]),
  fill("a"),
];

const movement = grounds.map((rowValue, rowIndex) => [...rowValue].map((char) => {
  if (rowIndex >= 20) return "r";
  return char === "B" ? "#" : ".";
}).join(""));

export const RUINS_TILEMAP: TileMapDefinition = {
  id: "ruins",
  offsetY: 4,
  legend: RUINS_TILE_LEGEND,
  movementLegend: STANDARD_MOVEMENT_LEGEND,
  groundRows: grounds,
  movementRows: movement,
  decorations: [
    { kind: "ruins-facade", x: 320, y: 104, width: 286, height: 100, depth: 7 },
    { kind: "low-house", x: 72, y: 190, width: 132, height: 98, depth: 8 },
    { kind: "low-house", x: 568, y: 190, width: 132, height: 98, depth: 8, flipX: true },
    { kind: "stone-gate", x: 92, y: 250, width: 150, height: 70, depth: 9 },
    { kind: "stone-gate", x: 548, y: 250, width: 150, height: 70, depth: 9, flipX: true },
    { kind: "lamp", x: 176, y: 270, width: 20, height: 82, depth: 12 },
    { kind: "lamp", x: 464, y: 270, width: 20, height: 82, depth: 12 },
    { kind: "ramp-rail", x: 288, y: 324, width: 8, height: 224, depth: 13, solid: true, solidWidth: 8, solidHeight: 224 },
    { kind: "ramp-rail", x: 352, y: 324, width: 8, height: 224, depth: 13, solid: true, solidWidth: 8, solidHeight: 224 },
  ],
};

export const RUINS_PROCESSION_DURATION_MS = 3800;
export const RUINS_PLAYER_START: TilePoint = { x: 328, y: 316 };
export const RUINS_LAM_START: TilePoint = { x: 328, y: 268 };
export const RUINS_DAUGHTER_START: TilePoint = { x: 328, y: 292 };
export const RUINS_LAM_END: TilePoint = { x: 328, y: 108 };
export const RUINS_DAUGHTER_END: TilePoint = { x: 328, y: 132 };
export const RUINS_PLAYER_END: TilePoint = { x: 328, y: 156 };

export type RuinsProcessionPositions = { lam: TilePoint; daughter: TilePoint; player: TilePoint };

export function ruinsProcessionPositions(progress: number): RuinsProcessionPositions {
  const amount = Math.max(0, Math.min(1, progress));
  const interpolate = (start: TilePoint, end: TilePoint): TilePoint => ({
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
  });
  return {
    lam: interpolate(RUINS_LAM_START, RUINS_LAM_END),
    daughter: interpolate(RUINS_DAUGHTER_START, RUINS_DAUGHTER_END),
    player: interpolate(RUINS_PLAYER_START, RUINS_PLAYER_END),
  };
}
