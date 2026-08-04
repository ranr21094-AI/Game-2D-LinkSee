import { describe, expect, it } from "vitest";
import { BUS_STOP_TILEMAP } from "./busstop-map";
import { BUS_INTERIOR_TILEMAP } from "./businterior-map";
import { isWalkable, tileAt, tileCenter, tileUnderPoint } from "./tilemap";

describe("shared tile maps", () => {
  it("keeps the M2 maps at 40x22 and maps their surface symbols", () => {
    [BUS_STOP_TILEMAP, BUS_INTERIOR_TILEMAP].forEach((map) => {
      expect(map.rows).toHaveLength(22);
      expect(map.rows.every((row) => row.length === 40)).toBe(true);
    });
    expect(tileAt(BUS_STOP_TILEMAP, 0, 0)).toBe("wall");
    expect(tileUnderPoint(BUS_STOP_TILEMAP, { x: 250, y: 212 })).toBe("concrete");
    expect(tileAt(BUS_INTERIOR_TILEMAP, 3, 4)).toBe("bus-seat");
  });

  it("converts a tile coordinate to a centered world point and tests walkability", () => {
    expect(tileCenter(2, 3, 4)).toEqual({ x: 40, y: 60 });
    const walkable = new Set(["concrete"] as const);
    expect(isWalkable(BUS_STOP_TILEMAP, { x: 250, y: 212 }, walkable)).toBe(true);
    expect(isWalkable(BUS_STOP_TILEMAP, { x: 8, y: 8 }, walkable)).toBe(false);
  });
});
