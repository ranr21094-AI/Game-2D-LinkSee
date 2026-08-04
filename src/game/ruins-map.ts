import type { GroundTileKey } from "./ground-tiles";
import { STANDARD_MOVEMENT_LEGEND, type TileMapDefinition } from "./tilemap";

export const RUINS_TILE_LEGEND: Record<string, GroundTileKey> = {
  B: "building",
  t: "steps",
  p: "plaza",
  s: "stone",
  w: "sidewalk",
  c: "curb",
  d: "drain",
  a: "asphalt",
  l: "lane",
};

const fill = (char: string): string => char.repeat(40);
const row = (fillChar: string, patches: Array<[number, string]> = []): string => {
  const chars = Array.from({ length: 40 }, () => fillChar);
  patches.forEach(([start, value]) => [...value].forEach((char, index) => { chars[start + index] = char; }));
  return chars.join("");
};

const grounds = [
  fill("B"), fill("B"), fill("B"), fill("B"), fill("B"), fill("B"),
  row("t", [[0, "BBBBBB"], [34, "BBBBBB"]]),
  row("t", [[0, "BBBBB"], [35, "BBBBB"]]),
  row("t", [[0, "BBBB"], [36, "BBBB"]]),
  fill("t"),
  row("p", [[0, "BBBB"], [36, "BBBB"]]),
  row("p", [[0, "BBBB"], [36, "BBBB"]]),
  row("p", [[0, "BBB"], [37, "BBB"]]),
  fill("p"), fill("p"), fill("s"), fill("s"), fill("w"),
  fill("c"), fill("d"),
  row("a", [[7, "llllll"], [27, "llllll"]]),
  fill("a"),
];

const movement = grounds.map((rowValue, rowIndex) => [...rowValue].map((char) => {
  if (rowIndex >= 20) return "r";
  return char === "B" ? "#" : ".";
}).join(""));

export const RUINS_TILEMAP: TileMapDefinition = {
  id: "ruins",
  offsetY: 4,
  legend: RUINS_TILE_LEGEND,
  movementLegend: STANDARD_MOVEMENT_LEGEND,
  groundRows: grounds,
  movementRows: movement,
  decorations: [
    { kind: "ruins-facade", x: 320, y: 104, width: 286, height: 100, depth: 7 },
    { kind: "low-house", x: 72, y: 190, width: 132, height: 98, depth: 8 },
    { kind: "low-house", x: 568, y: 190, width: 132, height: 98, depth: 8, flipX: true },
    { kind: "stone-gate", x: 92, y: 250, width: 150, height: 70, depth: 9 },
    { kind: "stone-gate", x: 548, y: 250, width: 150, height: 70, depth: 9, flipX: true },
    { kind: "lamp", x: 176, y: 270, width: 20, height: 82, depth: 12 },
    { kind: "lamp", x: 464, y: 270, width: 20, height: 82, depth: 12 },
  ],
};
