import type { GroundTileKey } from "./ground-tiles";
import { STANDARD_MOVEMENT_LEGEND, type TileMapDefinition } from "./tilemap";

export const BUS_STOP_TILE_LEGEND: Record<string, GroundTileKey> = {
  B: "building",
  s: "sidewalk",
  p: "plaza",
  c: "curb",
  d: "drain",
  a: "asphalt",
  l: "lane",
  m: "manhole",
};

const fill = (char: string): string => char.repeat(40);
const row = (fillChar: string, patches: Array<[number, string]> = []): string => {
  const chars = Array.from({ length: 40 }, () => fillChar);
  patches.forEach(([start, value]) => [...value].forEach((char, index) => { chars[start + index] = char; }));
  return chars.join("");
};

export const BUS_STOP_TILEMAP: TileMapDefinition = {
  id: "bus-stop",
  offsetY: 4,
  legend: BUS_STOP_TILE_LEGEND,
  movementLegend: STANDARD_MOVEMENT_LEGEND,
  groundRows: [
    fill("B"), fill("B"), fill("B"), fill("B"), fill("B"),
    row("s", [[3, "pppppp"], [17, "pppppp"], [31, "pppppp"]]),
    fill("s"), fill("s"), fill("s"),
    row("s", [[4, "p"], [14, "p"], [24, "p"], [34, "p"]]),
    fill("s"), fill("s"),
    row("s", [[7, "p"], [16, "p"], [28, "p"]]),
    fill("s"), fill("s"), fill("s"),
    row("s", [[5, "p"], [21, "p"], [36, "p"]]),
    fill("s"),
    fill("c"),
    row("d", [[8, "m"], [30, "m"]]),
    row("a", [[2, "llllll"], [20, "llllll"], [34, "llll"]]),
    row("a", [[12, "m"], [31, "lllllll"]]),
  ],
  movementRows: [
    fill("#"), fill("#"), fill("#"), fill("#"), fill("#"),
    fill("."), fill("."), fill("."), fill("."), fill("."), fill("."), fill("."), fill("."), fill("."), fill("."), fill("."), fill("."), fill("."),
    fill("."), fill("r"), fill("r"), fill("r"),
  ],
  decorations: [
    { kind: "gate-building", x: 320, y: 100, width: 640, height: 96, depth: 3, solid: true },
    { kind: "shelter", x: 352, y: 190, width: 260, height: 86, depth: 8 },
    { kind: "bench", x: 112, y: 224, width: 72, height: 28, depth: 9, solid: true },
    { kind: "bench", x: 424, y: 168, width: 72, height: 28, depth: 9, solid: true },
    { kind: "stop-sign-17", x: 520, y: 282, width: 26, height: 62, solid: true, solidWidth: 12, solidHeight: 24 },
    { kind: "stop-sign-25", x: 272, y: 282, width: 26, height: 62, solid: true, solidWidth: 12, solidHeight: 24 },
    { kind: "lamp", x: 48, y: 252, width: 22, height: 86, depth: 12 },
    { kind: "lamp", x: 592, y: 252, width: 22, height: 86, depth: 12 },
    { kind: "bus", x: 520, y: 356, width: 208, height: 72, depth: 7 },
  ],
};

export const BUS_STOP_SIGN = { x: 520, y: 241 } as const;
export const BUS_STOP_DECOY_SIGNS = [{ x: 272, y: 241, route: "25" }] as const;
export const BUS_STOP_SIGN_PROBE_RADIUS = 42;
export const BUS_STOP_DOOR = { x: 488, y: 284 } as const;
export const BUS_STOP_GATE_ENTRY = { x: 320, y: 124 } as const;
export const BUS_STOP_PATH_START = { x: 88, y: 268 } as const;
