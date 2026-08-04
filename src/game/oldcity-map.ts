import type { GroundTileKey } from "./ground-tiles";
import { STANDARD_MOVEMENT_LEGEND, tileAt as tileAtFromMap, tileCenter as tileCenterFromMap, type TileMapDefinition } from "./tilemap";

export const MAP_TILE_SIZE = 16;
export const MAP_OFFSET_Y = 4;
export const MAP_COLS = 40;
export const MAP_ROWS = 22;

export const OLD_CITY_TILE_LEGEND: Record<string, GroundTileKey> = {
  B: "building",
  s: "stone",
  p: "plaza",
  w: "sidewalk",
  c: "curb",
  d: "drain",
  a: "asphalt",
  g: "grass",
  b: "bush",
  q: "dirt",
  f: "fence",
  m: "manhole",
};

const fill = (char: string): string => char.repeat(40);
const row = (fillChar: string, patches: Array<[number, string]> = []): string => {
  const chars = Array.from({ length: 40 }, () => fillChar);
  patches.forEach(([start, value]) => [...value].forEach((char, index) => { chars[start + index] = char; }));
  return chars.join("");
};

export const OLD_CITY_MAP: string[] = [
  fill("B"), fill("B"), fill("B"), fill("B"),
  row("B", [[16, "ssssssssssss"]]),
  row("B", [[14, "ssssssssssssssss"]]),
  row("B", [[12, "ssssssssssssssssssss"]]),
  row("g", [[9, "pppppppppppppppppppppp"]]),
  row("g", [[8, "pppppppppppppppppppppppp"]]),
  row("g", [[7, "pppppppppppppppppppppppppp"]]),
  row("g", [[6, "pppppppppppppppppppppppppppp"]]),
  row("g", [[6, "pppppppppppppppppppppppppqqqqqf"]]),
  row("b", [[6, "pppppppppppppppppppppppppqqqqqf"]]),
  row("g", [[6, "pppppppppppppppppppppppppqqqqqf"]]),
  row("g", [[6, "pppppppppppppppppppppppppqqqqqf"]]),
  row("b", [[6, "pppppppppppppppppppppppppqqqqqf"]]),
  row("g", [[6, "pppppppppppppppppppppppppqqqqqf"]]),
  row("w", [[30, "fffffff"]]),
  fill("w"),
  row("c", [[8, "m"], [31, "m"]]),
  fill("d"),
  row("a", [[5, "mmmm"], [24, "mmmm"]]),
];

const movementRows = OLD_CITY_MAP.map((groundRow, rowIndex) => [...groundRow].map((char) => {
  if (rowIndex >= 20) return "r";
  if (char === "B" || char === "g" || char === "b" || char === "f") return "#";
  return ".";
}).join(""));

export const OLD_CITY_TILEMAP: TileMapDefinition = {
  id: "old-city",
  offsetY: MAP_OFFSET_Y,
  legend: OLD_CITY_TILE_LEGEND,
  movementLegend: STANDARD_MOVEMENT_LEGEND,
  groundRows: OLD_CITY_MAP,
  movementRows,
  decorations: [
    { kind: "arcade-house", x: 105, y: 112, width: 184, height: 106, depth: 7 },
    { kind: "corner-house", x: 530, y: 120, width: 188, height: 114, depth: 7, flipX: true },
    { kind: "arcade", x: 328, y: 114, width: 208, height: 86, depth: 8 },
    { kind: "tree", x: 72, y: 258, width: 28, height: 40, depth: 14 },
    { kind: "tree", x: 568, y: 250, width: 28, height: 40, depth: 14 },
    { kind: "lamp", x: 176, y: 268, width: 20, height: 82, depth: 12 },
  ],
};

export const OLD_CITY_TREES = OLD_CITY_TILEMAP.decorations.filter((decoration) => decoration.kind === "tree");

export function tileAt(col: number, rowIndex: number): GroundTileKey | null {
  return tileAtFromMap(OLD_CITY_TILEMAP, col, rowIndex);
}

export function tileCenter(col: number, rowIndex: number): { x: number; y: number } {
  return tileCenterFromMap(col, rowIndex, MAP_OFFSET_Y);
}
