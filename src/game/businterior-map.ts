import type { GroundTileKey } from "./ground-tiles";
import { STANDARD_MOVEMENT_LEGEND, type TileMapDefinition } from "./tilemap";

export const BUS_INTERIOR_TILE_LEGEND: Record<string, GroundTileKey> = {
  B: "building",
  f: "bus-floor",
  s: "bus-seat",
  m: "metal-floor",
};

const fill = (char: string): string => char.repeat(40);
const cabinRow = (rowIndex: number): string => {
  if (rowIndex < 3 || rowIndex === 21) return fill("B");
  const chars = Array.from({ length: 40 }, () => "f");
  if (rowIndex >= 4 && rowIndex <= 17) {
    for (let col = 1; col <= 9; col += 1) chars[col] = "s";
    for (let col = 31; col <= 38; col += 1) chars[col] = "s";
  }
  if (rowIndex === 8 || rowIndex === 14) for (let col = 11; col <= 29; col += 3) chars[col] = "m";
  if (rowIndex >= 18) for (let col = 32; col <= 34; col += 1) chars[col] = "m";
  return chars.join("");
};

const movementRow = (rowIndex: number): string => {
  if (rowIndex < 3 || rowIndex === 21) return fill("#");
  const chars = Array.from({ length: 40 }, () => ".");
  if (rowIndex >= 4 && rowIndex <= 17) {
    for (let col = 1; col <= 9; col += 1) chars[col] = "#";
    for (let col = 31; col <= 38; col += 1) chars[col] = "#";
  }
  return chars.join("");
};

export const BUS_INTERIOR_TILEMAP: TileMapDefinition = {
  id: "bus-interior",
  offsetY: 4,
  legend: BUS_INTERIOR_TILE_LEGEND,
  movementLegend: STANDARD_MOVEMENT_LEGEND,
  groundRows: Array.from({ length: 22 }, (_, index) => cabinRow(index)),
  movementRows: Array.from({ length: 22 }, (_, index) => movementRow(index)),
  decorations: [
    { kind: "bus-window", x: 320, y: 72, width: 608, height: 64, depth: 4 },
    { kind: "bus-pole", x: 176, y: 252, width: 12, height: 174, depth: 12 },
    { kind: "bus-pole", x: 304, y: 252, width: 12, height: 174, depth: 12 },
    { kind: "bus-pole", x: 448, y: 252, width: 12, height: 174, depth: 12 },
  ],
};

export const BUS_SEAT_EDGE = { x: 344, y: 172 } as const;
export const BUS_INTERIOR_DOOR = { x: 536, y: 316 } as const;
