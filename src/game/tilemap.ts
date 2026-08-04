import type { GroundTileKey } from "./ground-tiles";

export type TileMapDefinition = {
  rows: string[];
  legend: Record<string, GroundTileKey>;
  offsetY: number;
};

export function tileAt(map: TileMapDefinition, col: number, row: number): GroundTileKey | null {
  if (row < 0 || row >= map.rows.length || col < 0) return null;
  const char = map.rows[row]?.[col];
  return char ? map.legend[char] ?? null : null;
}

export function tileCenter(col: number, row: number, offsetY: number): { x: number; y: number } {
  return { x: col * 16 + 8, y: row * 16 + offsetY + 8 };
}

export function tileUnderPoint(map: TileMapDefinition, point: { x: number; y: number }): GroundTileKey | null {
  return tileAt(map, Math.floor(point.x / 16), Math.floor((point.y - map.offsetY) / 16));
}

export function isWalkable(map: TileMapDefinition, point: { x: number; y: number }, walkable: ReadonlySet<GroundTileKey>): boolean {
  const tile = tileUnderPoint(map, point);
  return tile !== null && walkable.has(tile);
}
