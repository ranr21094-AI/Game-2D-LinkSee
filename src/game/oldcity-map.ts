import type { GroundTileKey } from "./ground-tiles";
import { tileAt as tileAtFromMap, tileCenter as tileCenterFromMap, type TileMapDefinition } from "./tilemap";

export const MAP_TILE_SIZE = 16;
/** map is 40 x 22 tiles = 640 x 352, nudged down 4px to center in the 640x360 canvas */
export const MAP_OFFSET_Y = 4;
export const MAP_COLS = 40;
export const MAP_ROWS = 22;

export const OLD_CITY_TILE_LEGEND: Record<string, GroundTileKey> = {
  ".": "stone",
  s: "plaza",
  "=": "asphalt",
  "-": "curb",
  g: "grass",
  b: "bush",
  ":": "dirt",
  "#": "wall",
  f: "fence",
};

/**
 * Camoes Garden validation map: modern bus stop at the bottom, garden plaza in the
 * middle, a fenced dead-end branch on the right, denser old-town walls on top.
 * The tactile route runs: platform (20,20) -> plaza (20,16) -> (20,12) -> rail
 * decision (24,10) -> rail end (28,7).
 */
export const OLD_CITY_MAP: string[] = [
  "##############..##############..########",
  "##############..##############..########",
  "ggggggggggggggg...........gggggggggggggg",
  "ggggggggggggggg...........gggggggggggggg",
  "ggggbgggggggggg...........ggggggbggggggg",
  "ggggggggggggggg................ggggggggg",
  "gggbggggggggggg................gggbggggg",
  "ggggggggggggggg................ggggggggg",
  "ggggggggggbgggg................ggggggggg",
  "ggggggggggssssssssssssssssssssssgggggggg",
  "ggggggggggssssssssssssssssssssssgggggggg",
  "ggggggggggssssssssssssssssssssssgggggggg",
  "ggggbgggggssssssssssssssssssssss::::fggg",
  "ggggggggggssssssssssssssssssssss::::fggg",
  "ggggggggggssssssssssssssssssssss::::fggg",
  "gggbggggggssssssssssssssssssssss::::fggg",
  "ggggggggggssssssssssssssssssssss::::fggg",
  "ggggggggggssssssssssssssssssssssfffffggg",
  "ggggggggggssssssssssssssssssssssgggggggg",
  "----------------------------------------",
  "ssssssssssssssssssssssssssssssssssssssss",
  "========================================",
];

export const OLD_CITY_TILEMAP: TileMapDefinition = {
  rows: OLD_CITY_MAP,
  legend: OLD_CITY_TILE_LEGEND,
  offsetY: MAP_OFFSET_Y,
};

/** tree overlays (pixel coordinates of the 24x24 canopy image, top-left origin) */
export const OLD_CITY_TREES: Array<{ x: number; y: number }> = [
  { x: 76, y: 44 },
  { x: 572, y: 44 },
  { x: 60, y: 252 },
  { x: 552, y: 236 },
];

export function tileAt(col: number, row: number): GroundTileKey | null {
  return tileAtFromMap(OLD_CITY_TILEMAP, col, row);
}

export function tileCenter(col: number, row: number): { x: number; y: number } {
  return tileCenterFromMap(col, row, MAP_OFFSET_Y);
}
