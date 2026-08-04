import type { GroundTileKey } from "./ground-tiles";
import type { TileMapDefinition } from "./tilemap";

export const RUINS_TILE_LEGEND: Record<string, GroundTileKey> = {
  ".": "stone",
  s: "plaza",
  "-": "curb",
  "#": "wall",
};

const makeRow = (rowIndex: number): string => {
  if (rowIndex < 3) return "#".repeat(40);
  if (rowIndex === 3) return "#" + "s".repeat(38) + "#";
  if (rowIndex === 10 || rowIndex === 14) return "#" + "-".repeat(38) + "#";
  return "#" + ".".repeat(38) + "#";
};

export const RUINS_TILEMAP: TileMapDefinition = {
  offsetY: 4,
  legend: RUINS_TILE_LEGEND,
  rows: Array.from({ length: 22 }, (_, rowIndex) => makeRow(rowIndex)),
};
