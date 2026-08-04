import type { GroundTileKey } from "./ground-tiles";
import { STANDARD_MOVEMENT_LEGEND, type TileMapDefinition } from "./tilemap";

export const CROSSING_TILE_LEGEND: Record<string, GroundTileKey> = {
  B: "building",
  s: "sidewalk",
  c: "curb",
  d: "drain",
  a: "asphalt",
  z: "zebra",
  l: "lane",
  m: "manhole",
};

const fill = (char: string): string => char.repeat(40);
const roadRow = (rowIndex: number): string => {
  const chars = Array.from({ length: 40 }, () => "a");
  for (let col = 16; col <= 18; col += 1) chars[col] = "z";
  if (rowIndex === 10 || rowIndex === 13) for (let col = 1; col < 39; col += 4) if (col < 16 || col > 18) chars[col] = "l";
  if (rowIndex === 8) chars[31] = "m";
  return chars.join("");
};

const grounds = [
  fill("B"), fill("B"), fill("B"), fill("B"), fill("B"),
  fill("s"), fill("c"),
  ...Array.from({ length: 10 }, (_, index) => roadRow(index + 7)),
  fill("c"), fill("d"), fill("s"), fill("s"), fill("s"),
];

const movement = grounds.map((row, rowIndex) => [...row].map((_char, colIndex) => {
  if (rowIndex <= 4) return "#";
  if (rowIndex >= 7 && rowIndex <= 16) return colIndex >= 16 && colIndex <= 18 ? "x" : "r";
  return ".";
}).join(""));

export const CROSSING_TILEMAP: TileMapDefinition = {
  id: "old-city-crossing",
  offsetY: 4,
  legend: CROSSING_TILE_LEGEND,
  movementLegend: STANDARD_MOVEMENT_LEGEND,
  groundRows: grounds,
  movementRows: movement,
  decorations: [
    { kind: "corner-house", x: 92, y: 88, width: 176, height: 84, depth: 7 },
    { kind: "corner-house", x: 548, y: 88, width: 176, height: 84, depth: 7, flipX: true },
    { kind: "lamp", x: 48, y: 316, width: 20, height: 82, depth: 12 },
    { kind: "lamp", x: 592, y: 132, width: 20, height: 82, depth: 12 },
  ],
};
