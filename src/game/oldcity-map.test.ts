import { describe, expect, it } from "vitest";
import { PATHS } from "./content";
import { MAP_COLS, MAP_ROWS, OLD_CITY_MAP, OLD_CITY_MEMORY_POINT, OLD_CITY_TILEMAP, SHOP_SIGNS, tileAt } from "./oldcity-map";
import { isWalkable, movementAt, tileUnderPoint, validateTileMap } from "./tilemap";

describe("old-city merged tilemap", () => {
  it("fills the complete 40x22 scene and passes validation", () => {
    expect(OLD_CITY_MAP).toHaveLength(MAP_ROWS);
    expect(OLD_CITY_TILEMAP.movementRows).toHaveLength(MAP_ROWS);
    OLD_CITY_MAP.forEach((row) => expect(row).toHaveLength(MAP_COLS));
    expect(validateTileMap(OLD_CITY_TILEMAP)).toEqual([]);
  });

  it("runs the vertical road on the west side with a zebra band on rows 6-8", () => {
    for (let row = 0; row < MAP_ROWS; row += 1) {
      for (let col = 5; col <= 10; col += 1) {
        expect(movementAt(OLD_CITY_TILEMAP, col, row), `(${col},${row})`).toBe(row >= 6 && row <= 8 ? "crossing" : "road");
      }
    }
  });

  it("keeps the request point on the sidewalk and the far curb across the zebra", () => {
    expect(tileUnderPoint(OLD_CITY_TILEMAP, { x: 40, y: 124 })).toBe("sidewalk");
    expect(tileUnderPoint(OLD_CITY_TILEMAP, { x: 56, y: 124 })).toBe("curb");
    expect(tileUnderPoint(OLD_CITY_TILEMAP, { x: 120, y: 124 })).toBe("zebra");
    expect(tileUnderPoint(OLD_CITY_TILEMAP, { x: 200, y: 124 })).toBe("curb");
  });

  it("keeps every tactile path node on walkable ground", () => {
    PATHS["old-city"].nodes.forEach((node) => expect(isWalkable(OLD_CITY_TILEMAP, node), `node (${node.x},${node.y})`).toBe(true));
  });

  it("blocks the shop blocks that flank the U-shaped corridor", () => {
    [[20, 10], [30, 10], [36, 2], [37, 8], [37, 14], [18, 20], [27, 20]].forEach(([col, row]) => {
      expect(movementAt(OLD_CITY_TILEMAP, col, row), `(${col},${row})`).toBe("blocked");
    });
  });

  it("keeps the U-shaped corridor walkable end to end", () => {
    for (let row = 6; row <= 18; row += 1) expect(movementAt(OLD_CITY_TILEMAP, 14, row), `south leg row ${row}`).toBe("walkable");
    for (let col = 13; col <= 34; col += 1) expect(movementAt(OLD_CITY_TILEMAP, col, 17), `street col ${col}`).toBe("walkable");
    for (let row = 5; row <= 18; row += 1) expect(movementAt(OLD_CITY_TILEMAP, 33, row), `north leg row ${row}`).toBe("walkable");
  });

  it("encloses the dirt alley between the tart shop and the bakery", () => {
    [19, 20].forEach((row) => [22, 23, 24].forEach((col) => {
      expect(tileAt(col, row)).toBe("dirt");
      expect(movementAt(OLD_CITY_TILEMAP, col, row)).toBe("walkable");
    }));
    [22, 23, 24].forEach((col) => expect(tileAt(col, 21)).toBe("fence"));
    expect(movementAt(OLD_CITY_TILEMAP, 21, 20)).toBe("blocked");
    expect(movementAt(OLD_CITY_TILEMAP, 25, 20)).toBe("blocked");
    expect(isWalkable(OLD_CITY_TILEMAP, OLD_CITY_MEMORY_POINT)).toBe(true);
  });

  it("labels all eight brand-free shop signs", () => {
    expect(SHOP_SIGNS.map((sign) => sign.name)).toEqual(["祐记士多", "海风咖啡", "德兴茶楼", "濠江银号", "猫记宠物", "同德按", "灯塔葡挞", "安记饼家"]);
    const signDecorations = OLD_CITY_TILEMAP.decorations.filter((decoration) => decoration.kind === "shop-sign");
    expect(signDecorations).toHaveLength(8);
    signDecorations.forEach((decoration) => expect(decoration.label).toBeTruthy());
  });
});
