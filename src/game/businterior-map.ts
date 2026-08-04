import type { GroundTileKey } from "./ground-tiles";
import type { TileMapDefinition } from "./tilemap";

export const BUS_INTERIOR_TILE_LEGEND: Record<string, GroundTileKey> = {
  ".": "bus-floor",
  b: "bus-seat",
  "#": "wall",
};

const makeRow = (rowIndex: number): string => {
  if (rowIndex < 2 || rowIndex > 20) return "#".repeat(40);
  if (rowIndex === 2) return "#" + "b".repeat(14) + ".".repeat(10) + "b".repeat(14) + "#";
  if (rowIndex % 4 === 0) return "#" + "b".repeat(8) + ".".repeat(24) + "b".repeat(6) + "#";
  return "#" + ".".repeat(38) + "#";
};

export const BUS_INTERIOR_TILEMAP: TileMapDefinition = {
  offsetY: 4,
  legend: BUS_INTERIOR_TILE_LEGEND,
  rows: Array.from({ length: 22 }, (_, index) => makeRow(index)),
};

export const BUS_SEAT_EDGE = { x: 350, y: 164 } as const;
export const BUS_INTERIOR_DOOR = { x: 530, y: 314 } as const;
