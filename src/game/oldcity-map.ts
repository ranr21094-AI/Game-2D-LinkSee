import type { GroundTileKey } from "./ground-tiles";
import { STANDARD_MOVEMENT_LEGEND, tileAt as tileAtFromMap, tileCenter as tileCenterFromMap, type TileMapDefinition } from "./tilemap";

export const MAP_TILE_SIZE = 16;
export const MAP_OFFSET_Y = 4;
export const MAP_COLS = 40;
export const MAP_ROWS = 22;

export const OLD_CITY_TILE_LEGEND: Record<string, GroundTileKey> = {
  B: "building",
  p: "plaza",
  w: "sidewalk",
  c: "curb",
  d: "drain",
  a: "asphalt",
  z: "zebra",
  l: "lane",
  g: "grass",
  b: "bush",
  q: "dirt",
  f: "fence",
  m: "manhole",
};

const B27 = "B".repeat(27);
const B16 = "B".repeat(16);

const roadRow = (west: string, road: string, east: string): string => `${west}cd${road}dc${east}`;
const midRow = (road: string): string => roadRow("www", road, `ppp${B16}ppp${"B".repeat(5)}`);

// 左侧竖向马路（列5-10），斑马线行6-8；中央商铺块列16-31；
// U形盲道走廊：南下列13-15、商铺街行16-18、北上列32-34；死路小巷列22-24。
export const OLD_CITY_MAP: string[] = [
  roadRow("BBB", "aaaaaa", B27),
  roadRow("BBB", "aaaaaa", B27),
  roadRow("BBB", "aallaa", B27),
  roadRow("BBB", "aaaaaa", B27),
  roadRow("www", "aaaaaa", B27),
  roadRow("www", "aaaaaa", `${"B".repeat(19)}ppp${"B".repeat(5)}`),
  midRow("zzzzzz"),
  midRow("zzzzzz"),
  midRow("zzzzzz"),
  midRow("aaaaaa"),
  midRow("aallaa"),
  midRow("aaaaaa"),
  midRow("aamaaa"),
  midRow("aaaaaa"),
  midRow("aallaa"),
  midRow("aaaaaa"),
  roadRow("www", "aaaaaa", `${"p".repeat(22)}${"B".repeat(5)}`),
  roadRow("www", "aaaaaa", `${"p".repeat(22)}${"B".repeat(5)}`),
  roadRow("www", "aaamaa", `${"p".repeat(22)}${"B".repeat(5)}`),
  roadRow("www", "aaaaaa", `ggg${"B".repeat(6)}qqq${"B".repeat(6)}${"B".repeat(9)}`),
  roadRow("www", "aallaa", `gbg${"B".repeat(6)}qqq${"B".repeat(6)}${"B".repeat(9)}`),
  roadRow("www", "aaaaaa", `ggg${"B".repeat(6)}fff${"B".repeat(6)}${"B".repeat(9)}`),
];

const movementRows = OLD_CITY_MAP.map((groundRow) => [...groundRow].map((char, col) => {
  if (char === "B" || char === "g" || char === "b" || char === "f") return "#";
  if (char === "z") return "x";
  if (char === "a" || char === "l") return "r";
  if (char === "m") return col >= 5 && col <= 10 ? "r" : ".";
  return ".";
}).join(""));

/** 小巷深处的记忆回声触发点（col 23, row 20）。 */
export const OLD_CITY_MEMORY_POINT = { x: 376, y: 332 } as const;

export type ShopSign = {
  id: string;
  name: string;
  touch: { x: number; y: number };
  hint: string;
};

/** 八家商铺的杖触点与触觉反馈文案（无品牌虚构名）。 */
export const SHOP_SIGNS: readonly ShopSign[] = [
  { id: "store", name: "祐记士多", touch: { x: 304, y: 260 }, hint: "招牌「祐记士多」：便利店门口" },
  { id: "coffee", name: "海风咖啡", touch: { x: 408, y: 260 }, hint: "招牌「海风咖啡」：咖啡室门口" },
  { id: "tea", name: "德兴茶楼", touch: { x: 508, y: 180 }, hint: "竖招牌「德兴茶楼」：茶楼沿墙北上" },
  { id: "bank", name: "濠江银号", touch: { x: 576, y: 88 }, hint: "招牌「濠江银号」：终点就在门前" },
  { id: "pet", name: "猫记宠物", touch: { x: 562, y: 140 }, hint: "竖招牌「猫记宠物」：宠物店外墙" },
  { id: "pawn", name: "同德按", touch: { x: 562, y: 236 }, hint: "圆形押店招牌「同德按」" },
  { id: "tart", name: "灯塔葡挞", touch: { x: 304, y: 308 }, hint: "招牌「灯塔葡挞」：蘭挞店在南侧" },
  { id: "bakery", name: "安记饼家", touch: { x: 448, y: 308 }, hint: "招牌「安记饼家」：饼香从南侧传来" },
] as const;

export const OLD_CITY_TILEMAP: TileMapDefinition = {
  id: "old-city",
  offsetY: MAP_OFFSET_Y,
  legend: OLD_CITY_TILE_LEGEND,
  movementLegend: STANDARD_MOVEMENT_LEGEND,
  groundRows: OLD_CITY_MAP,
  movementRows,
  decorations: [
    // 中央商铺块（列16-31）：前排骑楼拱廊贴街面，后排两栋楼错落在拱廊屋脊之后。
    { kind: "arcade-house", x: 310, y: 124, width: 90, height: 118 },
    { kind: "corner-house", x: 458, y: 124, width: 100, height: 96, flipX: true },
    { kind: "arcade", x: 384, y: 260, width: 250, height: 138 },
    { kind: "shop-sign", x: 304, y: 210, width: 68, height: 20, depth: 261, label: "祐记士多" },
    { kind: "shop-sign", x: 408, y: 210, width: 68, height: 20, depth: 261, label: "海风咖啡" },
    { kind: "shop-sign", x: 506, y: 196, width: 20, height: 64, depth: 261, label: "德兴茶楼", signVertical: true },
    // 东北角银行（终点后方）。
    { kind: "corner-house", x: 580, y: 84, width: 110, height: 78 },
    { kind: "shop-sign", x: 576, y: 36, width: 68, height: 20, depth: 86, label: "濠江银号" },
    // 东侧宠物店与押店：临北上走廊，各叠两栋矮楼。
    { kind: "low-house", x: 600, y: 144, width: 76, height: 60, flipX: true },
    { kind: "low-house", x: 600, y: 196, width: 78, height: 60 },
    { kind: "shop-sign", x: 566, y: 196, width: 20, height: 64, depth: 197, label: "猫记宠物", signVertical: true },
    { kind: "low-house", x: 598, y: 240, width: 78, height: 60, flipX: true },
    { kind: "low-house", x: 600, y: 292, width: 78, height: 60 },
    { kind: "shop-sign", x: 566, y: 290, width: 20, height: 50, depth: 293, label: "同德按", signVertical: true },
    // 南侧蘭挞店 / 饼家 / 东南角石门楼（小巷两侧留空）。
    { kind: "low-house", x: 304, y: 356, width: 92, height: 62 },
    { kind: "shop-sign", x: 304, y: 320, width: 68, height: 18, depth: 357, label: "灯塔葡挞" },
    { kind: "low-house", x: 448, y: 356, width: 92, height: 62, flipX: true },
    { kind: "shop-sign", x: 448, y: 320, width: 68, height: 18, depth: 357, label: "安记饼家" },
    { kind: "stone-gate", x: 580, y: 356, width: 118, height: 62 },
    { kind: "lamp", x: 358, y: 264, width: 20, height: 82, depth: 12 },
    { kind: "tree", x: 224, y: 344, width: 28, height: 40, depth: 14 },
    { kind: "tree", x: 24, y: 220, width: 28, height: 40, depth: 14 },
  ],
};

export const OLD_CITY_TREES = OLD_CITY_TILEMAP.decorations.filter((decoration) => decoration.kind === "tree");

export function tileAt(col: number, rowIndex: number): GroundTileKey | null {
  return tileAtFromMap(OLD_CITY_TILEMAP, col, rowIndex);
}

export function tileCenter(col: number, rowIndex: number): { x: number; y: number } {
  return tileCenterFromMap(col, rowIndex, MAP_OFFSET_Y);
}
