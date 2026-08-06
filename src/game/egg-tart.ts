import type { TilePoint } from "./types";

export const EGG_TART_STALL = { x: 344, y: 260 } as const;
export const EGG_TART_BOOST_MS = 60_000;
export const EGG_TART_BOOST_MULTIPLIER = 1.6;

// Six columns by three rows in front of the stall service edge. These are
// explicit walkable tile centers so aroma never leaks through buildings.
export const EGG_TART_SCENT_TILES: readonly TilePoint[] = Array.from({ length: 6 }, (_, column) =>
  Array.from({ length: 3 }, (_, row) => ({ x: 312 + column * 16, y: 268 + row * 16 })),
).flat();

export function isInsideEggTartScentZone(point: TilePoint): boolean {
  return EGG_TART_SCENT_TILES.some((tile) => Math.abs(point.x - tile.x) <= 8 && Math.abs(point.y - tile.y) <= 8);
}

export function eggTartBoostFactor(remainingMs: number): number {
  return remainingMs > 0 ? EGG_TART_BOOST_MULTIPLIER : 1;
}
