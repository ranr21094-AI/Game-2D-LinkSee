import { describe, expect, it } from "vitest";
import { PATHS } from "./content";
import { MAP_COLS, MAP_ROWS, OLD_CITY_MAP, OLD_CITY_TILEMAP, tileAt } from "./oldcity-map";
import { isWalkable, movementAt } from "./tilemap";

describe("old-city tilemap", () => {
  it("fills the complete 40x22 scene with ground and movement semantics", () => {
    expect(OLD_CITY_MAP).toHaveLength(MAP_ROWS);
    expect(OLD_CITY_TILEMAP.movementRows).toHaveLength(MAP_ROWS);
    OLD_CITY_MAP.forEach((row) => expect(row).toHaveLength(MAP_COLS));
    OLD_CITY_TILEMAP.movementRows.forEach((row) => expect(row).toHaveLength(MAP_COLS));
  });

  it("keeps every tactile path node on walkable ground", () => {
    PATHS["old-city"].nodes.forEach((node) => expect(isWalkable(OLD_CITY_TILEMAP, node), `node (${node.x},${node.y})`).toBe(true));
  });

  it("encloses the dirt detour with map-defined fences", () => {
    [11, 12, 13, 14, 15, 16].forEach((row) => expect(tileAt(36, row)).toBe("fence"));
    [31, 32, 33, 34, 35, 36].forEach((col) => expect(tileAt(col, 17)).toBe("fence"));
    [12, 14, 16].forEach((row) => expect(tileAt(33, row)).toBe("dirt"));
  });

  it("places a curb, drain and road below the alighting sidewalk", () => {
    expect(tileAt(10, 18)).toBe("sidewalk");
    expect(tileAt(10, 19)).toBe("curb");
    expect(tileAt(10, 20)).toBe("drain");
    expect(movementAt(OLD_CITY_TILEMAP, 10, 21)).toBe("road");
  });
});
