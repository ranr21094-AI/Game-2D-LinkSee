import { describe, expect, it } from "vitest";
import { BUS_STOP_TILEMAP } from "./busstop-map";
import { BUS_INTERIOR_TILEMAP } from "./businterior-map";
import { isWalkable, movementUnderPoint, tileAt, tileCenter, tileUnderPoint, validateTileMap } from "./tilemap";

describe("shared tile maps", () => {
  it("keeps the M2 maps at 40x22 and maps their surface symbols", () => {
    [BUS_STOP_TILEMAP, BUS_INTERIOR_TILEMAP].forEach((map) => {
      expect(map.groundRows).toHaveLength(22);
      expect(map.movementRows).toHaveLength(22);
      expect(map.groundRows.every((row) => row.length === 40)).toBe(true);
      expect(validateTileMap(map)).toEqual([]);
    });
    expect(tileAt(BUS_STOP_TILEMAP, 0, 0)).toBe("building");
    expect(tileUnderPoint(BUS_STOP_TILEMAP, { x: 232, y: 204 })).toBe("sidewalk");
    expect(tileAt(BUS_INTERIOR_TILEMAP, 3, 4)).toBe("bus-seat");
  });

  it("converts a tile coordinate to a centered world point and tests walkability", () => {
    expect(tileCenter(2, 3, 4)).toEqual({ x: 40, y: 60 });
    expect(isWalkable(BUS_STOP_TILEMAP, { x: 232, y: 204 })).toBe(true);
    expect(isWalkable(BUS_STOP_TILEMAP, { x: 8, y: 8 })).toBe(false);
    expect(movementUnderPoint(BUS_STOP_TILEMAP, { x: 120, y: 340 })).toBe("road");
  });
});
