import type { GroundTileKey } from "./ground-tiles";
import { STANDARD_MOVEMENT_LEGEND, type TileMapDefinition } from "./tilemap";

export const BUS_INTERIOR_TILE_LEGEND: Record<string, GroundTileKey> = {
  B: "building",
  f: "bus-floor",
  s: "bus-seat",
  m: "metal-floor",
};

const fill = (char: string): string => char.repeat(40);
const SEAT_COLUMNS = [6, 12, 18, 24];
const markSeatCells = (chars: string[], rowIndex: number, marker: string): void => {
  const inUpperSeatRow = rowIndex >= 4 && rowIndex <= 8;
  const inLowerSeatRow = rowIndex >= 14 && rowIndex <= 17;
  if (!inUpperSeatRow && !inLowerSeatRow) return;
  SEAT_COLUMNS.forEach((column) => {
    [column - 1, column, column + 1].forEach((seatColumn) => { chars[seatColumn] = marker; });
  });
};

const cabinRow = (rowIndex: number): string => {
  if (rowIndex < 3 || rowIndex === 21) return fill("B");
  const chars = Array.from({ length: 40 }, () => "f");
  markSeatCells(chars, rowIndex, "s");
  if (rowIndex >= 17 && rowIndex <= 20) for (let col = 32; col <= 36; col += 1) chars[col] = "m";
  return chars.join("");
};

const movementRow = (rowIndex: number): string => {
  if (rowIndex < 3 || rowIndex === 21) return fill("#");
  const chars = Array.from({ length: 40 }, () => ".");
  markSeatCells(chars, rowIndex, "#");
  if (rowIndex >= 17 && rowIndex <= 20) for (let col = 32; col <= 36; col += 1) chars[col] = "#";
  return chars.join("");
};

export const BUS_INTERIOR_TILEMAP: TileMapDefinition = {
  id: "bus-interior",
  offsetY: 4,
  legend: BUS_INTERIOR_TILE_LEGEND,
  movementLegend: STANDARD_MOVEMENT_LEGEND,
  groundRows: Array.from({ length: 22 }, (_, index) => cabinRow(index)),
  movementRows: Array.from({ length: 22 }, (_, index) => movementRow(index)),
  requiresBrightGround: true,
  decorations: [
    // Right-hand-drive layout: the front is on the right, and only the upper
    // passenger row gets individual window modules.
    ...[104, 200, 296, 392].map((x) => ({ kind: "bus-window" as const, x, y: 72, width: 72, height: 40, depth: 4 })),
    { kind: "bus-light", x: 320, y: 28, width: 520, height: 24, depth: 6 },
    ...[104, 200, 296, 392].flatMap((x) => [
      { kind: "bus-seat-row" as const, x, y: 132, width: 48, height: 56, depth: 133, orientation: "upper" as const, solid: true, solidWidth: 42, solidHeight: 48 },
      { kind: "bus-seat-row" as const, x, y: 288, width: 48, height: 56, depth: 289, orientation: "lower" as const, solid: true, solidWidth: 42, solidHeight: 48 },
    ]),
    { kind: "bus-driver-seat", x: 552, y: 328, width: 56, height: 52, depth: 329, orientation: "driver" as const, solid: true, solidWidth: 48, solidHeight: 44 },
    { kind: "bus-card-reader", x: 488, y: 284, width: 26, height: 46, depth: 20 },
  ],
};

/** Walkable approach point directly in front of the first upper-row seat. */
export type BusSeatSpot = {
  id: string;
  row: "upper" | "lower";
  surface: { x: number; y: number };
  approach: { x: number; y: number };
  sit: { x: number; y: number };
};

export const BUS_SEAT_SPOTS: readonly BusSeatSpot[] = [
  ...[104, 200, 296, 392].map((x, index) => ({ id: `upper-${index + 1}`, row: "upper" as const, surface: { x, y: 132 }, approach: { x, y: 148 }, sit: { x, y: 140 } })),
  ...[104, 200, 296, 392].map((x, index) => ({ id: `lower-${index + 1}`, row: "lower" as const, surface: { x, y: 248 }, approach: { x, y: 224 }, sit: { x, y: 232 } })),
];

/** Compatibility target used by the default objective and legacy saves. */
export const BUS_SEAT_EDGE = BUS_SEAT_SPOTS[3].approach;
/** Compatibility surface used by the default objective and legacy saves. */
export const BUS_SEAT_SURFACE = BUS_SEAT_SPOTS[3].surface;
export const BUS_CARD_READER = { x: 488, y: 284 } as const;
export const BUS_INTERIOR_DOOR = { x: 536, y: 76 } as const;
export const BUS_DRIVER_SEAT = { x: 552, y: 328 } as const;

export type BusBellSpot = {
  id: "front-left" | "rear-left" | "front-right" | "rear-right";
  x: number;
  y: number;
};

/** Reachable empty-seat-side positions used only after the destination is announced. */
export const BUS_BELL_SPOTS: readonly BusBellSpot[] = [
  { id: "front-left", x: 152, y: 188 },
  { id: "rear-left", x: 248, y: 188 },
  { id: "front-right", x: 344, y: 188 },
  { id: "rear-right", x: 440, y: 188 },
];

/** The bell can be found by touch from any direction within the same reach as a cane tap. */
export const BUS_BELL_DETECTION_RADIUS = 42;

export function isBusBellInRange(
  player: { x: number; y: number },
  bell: { x: number; y: number },
  radius = BUS_BELL_DETECTION_RADIUS,
): boolean {
  return Math.hypot(player.x - bell.x, player.y - bell.y) <= radius;
}

/** Phaser texture keys for the two passenger seat orientations. */
export const BUS_SEATED_SPRITE_KEYS = {
  upper: "traveler-sit",
  lower: "traveler-sit-up",
} as const;

/** Kept as a content fallback; live gameplay uses BUS_BELL_SPOTS after the announcement. */
export const BUS_BELL = { x: BUS_BELL_SPOTS[0].x, y: BUS_BELL_SPOTS[0].y } as const;

export function pickBusBellSpot(random = Math.random()): BusBellSpot {
  const index = Math.min(BUS_BELL_SPOTS.length - 1, Math.max(0, Math.floor(random * BUS_BELL_SPOTS.length)));
  return BUS_BELL_SPOTS[index];
}
