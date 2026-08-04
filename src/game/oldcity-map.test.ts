import { describe, expect, it } from "vitest";
import { PATHS } from "./content";
import { MAP_COLS, MAP_OFFSET_Y, MAP_ROWS, MAP_TILE_SIZE, OLD_CITY_MAP, tileAt } from "./oldcity-map";

const WALKABLE = new Set(["stone", "plaza", "asphalt", "dirt"]);

function tileUnder(point: { x: number; y: number }): string | null {
  const col = Math.floor(point.x / MAP_TILE_SIZE);
  const row = Math.floor((point.y - MAP_OFFSET_Y) / MAP_TILE_SIZE);
  return tileAt(col, row);
}

describe("old-city tilemap", () => {
  it("has the expected dimensions", () => {
    expect(OLD_CITY_MAP).toHaveLength(MAP_ROWS);
    OLD_CITY_MAP.forEach((row) => expect(row).toHaveLength(MAP_COLS));
  });

  it("keeps every tactile path node on walkable ground", () => {
    PATHS["old-city"].nodes.forEach((node) => {
      const tile = tileUnder(node);
      expect(tile && WALKABLE.has(tile), `node (${node.x},${node.y}) on ${tile}`).toBe(true);
    });
  });

  it("keeps the spawn platform walkable", () => {
    expect(WALKABLE.has(tileUnder({ x: 330, y: 330 }) ?? "")).toBe(true);
  });

  it("encloses the dead-end branch with fences", () => {
    [12, 13, 14, 15, 16].forEach((row) => expect(tileAt(36, row)).toBe("fence"));
    [32, 33, 34, 35, 36].forEach((col) => expect(tileAt(col, 17)).toBe("fence"));
    [12, 14, 16].forEach((row) => expect(WALKABLE.has(tileAt(33, row) ?? "")).toBe(true));
  });

  it("marks the dead-end branch corridor as a dirt surface", () => {
    [12, 13, 14, 15, 16].forEach((row) => expect(tileAt(33, row)).toBe("dirt"));
  });

  it("puts the bus stop on an asphalt road behind a curb", () => {
    expect(OLD_CITY_MAP[19].split("").every((char) => char === "-")).toBe(true);
    expect(OLD_CITY_MAP[21].split("").every((char) => char === "=")).toBe(true);
  });
});
