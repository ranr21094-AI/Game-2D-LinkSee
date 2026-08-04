import type { GroundTileKey } from "./ground-tiles";
import type { TileMapDefinition } from "./tilemap";

export const CROSSING_TILE_LEGEND: Record<string, GroundTileKey> = {
  "=": "asphalt",
  s: "plaza",
  "-": "curb",
  z: "zebra",
  "#": "wall",
};

const makeRow = (rowIndex: number): string => {
  const y = rowIndex * 16 + 12;
  const chars = Array.from({ length: 40 }, () => "=");
  for (let col = 0; col < 7; col += 1) chars[col] = "s";
  for (let col = 33; col < 40; col += 1) chars[col] = "s";
  if (rowIndex === 0 || rowIndex === 21) {
    for (let col = 0; col < 40; col += 1) chars[col] = "#";
    return chars.join("");
  }
  if (rowIndex === 17 || rowIndex === 5) {
    for (let col = 7; col < 33; col += 1) chars[col] = "-";
  }
  // A straight north/south zebra crossing sits at x≈278. At the far curb it
  // turns east into a short horizontal tactile landing.
  if (rowIndex >= 4 && rowIndex <= 17) {
    for (let col = 16; col <= 18; col += 1) chars[col] = "z";
  }
  if (rowIndex === 4) {
    for (let col = 17; col <= 32; col += 1) chars[col] = "z";
  }
  return chars.join("");
};

/** 旧城直行路口：垂直斑马线抵达对岸后，接一段横向落脚区。 */
export const CROSSING_TILEMAP: TileMapDefinition = {
  offsetY: 4,
  legend: CROSSING_TILE_LEGEND,
  rows: Array.from({ length: 22 }, (_, rowIndex) => makeRow(rowIndex)),
};
