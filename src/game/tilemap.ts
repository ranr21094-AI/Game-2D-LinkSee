import type { GroundTileKey } from "./ground-tiles";

export type MovementTileKind = "walkable" | "blocked" | "road" | "crossing";

export type DecorationKind =
  | "gate-building"
  | "shelter"
  | "bus"
  | "bench"
  | "lamp"
  | "signal"
  | "tree"
  | "arcade-house"
  | "corner-house"
  | "arcade"
  | "low-house"
  | "stone-gate"
  | "ruins-facade"
  | "ramp-rail"
  | "bus-window"
  | "bus-pole"
  | "bus-seat-row"
  | "bus-driver-seat"
  | "bus-rail"
  | "bus-card-reader"
  | "bus-bell"
  | "bus-light"
  | "stop-sign-17"
  | "stop-sign-25"
  | "shop-sign"
  | "shop-front";

export type MapDecoration = {
  kind: DecorationKind;
  x: number;
  y: number;
  width: number;
  height: number;
  depth?: number;
  flipX?: boolean;
  /** Orientation for programmatic bus seat rendering. */
  orientation?: "upper" | "lower" | "driver";
  /** Solid decorations block movement; the player cannot step onto their footprint. */
  solid?: boolean;
  /** Blocked strip width measured from the sprite center; defaults to width. */
  solidWidth?: number;
  /** Blocked strip height measured up from the sprite base; defaults to height. */
  solidHeight?: number;
  /** Chinese signboard text for "shop-sign" decorations. */
  label?: string;
  /** Render "shop-sign" text vertically (one character per line). */
  signVertical?: boolean;
};

export type TileMapDefinition = {
  id: string;
  groundRows: string[];
  movementRows: string[];
  legend: Record<string, GroundTileKey>;
  movementLegend: Record<string, MovementTileKind>;
  decorations: MapDecoration[];
  offsetY: number;
  /** When enabled, only temporarily illuminated ground may be entered. */
  requiresBrightGround?: boolean;
};

export const STANDARD_MOVEMENT_LEGEND: Record<string, MovementTileKind> = {
  ".": "walkable",
  "#": "blocked",
  r: "road",
  x: "crossing",
};

export function tileAt(map: TileMapDefinition, col: number, row: number): GroundTileKey | null {
  if (row < 0 || row >= map.groundRows.length || col < 0) return null;
  const char = map.groundRows[row]?.[col];
  return char ? map.legend[char] ?? null : null;
}

export function movementAt(map: TileMapDefinition, col: number, row: number): MovementTileKind | null {
  if (row < 0 || row >= map.movementRows.length || col < 0) return null;
  const char = map.movementRows[row]?.[col];
  return char ? map.movementLegend[char] ?? null : null;
}

export function tileCenter(col: number, row: number, offsetY: number): { x: number; y: number } {
  return { x: col * 16 + 8, y: row * 16 + offsetY + 8 };
}

export function tileUnderPoint(map: TileMapDefinition, point: { x: number; y: number }): GroundTileKey | null {
  return tileAt(map, Math.floor(point.x / 16), Math.floor((point.y - map.offsetY) / 16));
}

export function movementUnderPoint(map: TileMapDefinition, point: { x: number; y: number }): MovementTileKind | null {
  return movementAt(map, Math.floor(point.x / 16), Math.floor((point.y - map.offsetY) / 16));
}

export function solidDecorationAt(map: TileMapDefinition, point: { x: number; y: number }): MapDecoration | null {
  return map.decorations.find((decoration) => {
    if (!decoration.solid) return false;
    const halfWidth = (decoration.solidWidth ?? decoration.width) / 2;
    const solidHeight = decoration.solidHeight ?? decoration.height;
    return point.x >= decoration.x - halfWidth
      && point.x <= decoration.x + halfWidth
      && point.y > decoration.y - solidHeight
      && point.y <= decoration.y;
  }) ?? null;
}

export function isWalkable(map: TileMapDefinition, point: { x: number; y: number }): boolean {
  if (solidDecorationAt(map, point)) return false;
  const movement = movementUnderPoint(map, point);
  return movement === "walkable" || movement === "road" || movement === "crossing";
}

export function nearestSafeWalkablePoint(map: TileMapDefinition, point: { x: number; y: number }): { x: number; y: number } | null {
  let best: { x: number; y: number; distance: number } | null = null;
  for (let rowIndex = 0; rowIndex < map.movementRows.length; rowIndex += 1) {
    for (let colIndex = 0; colIndex < map.movementRows[rowIndex].length; colIndex += 1) {
      if (movementAt(map, colIndex, rowIndex) !== "walkable") continue;
      const center = tileCenter(colIndex, rowIndex, map.offsetY);
      if (solidDecorationAt(map, center)) continue;
      const distance = Math.hypot(center.x - point.x, center.y - point.y);
      if (!best || distance < best.distance) best = { ...center, distance };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

export function validateTileMap(map: TileMapDefinition): string[] {
  const errors: string[] = [];
  if (map.groundRows.length !== 22) errors.push(`${map.id}: groundRows must contain 22 rows`);
  if (map.movementRows.length !== 22) errors.push(`${map.id}: movementRows must contain 22 rows`);
  map.groundRows.forEach((row, index) => {
    if (row.length !== 40) errors.push(`${map.id}: ground row ${index} must contain 40 cells`);
    [...row].forEach((char) => { if (!map.legend[char]) errors.push(`${map.id}: unknown ground symbol ${char}`); });
  });
  map.movementRows.forEach((row, index) => {
    if (row.length !== 40) errors.push(`${map.id}: movement row ${index} must contain 40 cells`);
    [...row].forEach((char) => { if (!map.movementLegend[char]) errors.push(`${map.id}: unknown movement symbol ${char}`); });
  });
  map.decorations.forEach((decoration) => {
    if (decoration.x - decoration.width / 2 < 0 || decoration.x + decoration.width / 2 > 640 || decoration.y - decoration.height < 4 || decoration.y > 356) {
      errors.push(`${map.id}: decoration ${decoration.kind} is outside the map`);
    }
  });
  return [...new Set(errors)];
}
