import { describe, expect, it } from "vitest";
import { CROSSING_TILEMAP } from "./crossing-map";
import { tileUnderPoint } from "./tilemap";

describe("crossing tile map", () => {
  it("keeps a 40x22 asphalt map and marks both curb entries as zebra", () => {
    expect(CROSSING_TILEMAP.groundRows).toHaveLength(22);
    expect(CROSSING_TILEMAP.groundRows.every((row) => row.length === 40)).toBe(true);
    expect(tileUnderPoint(CROSSING_TILEMAP, { x: 280, y: 284 })).toBe("curb");
    expect(tileUnderPoint(CROSSING_TILEMAP, { x: 280, y: 108 })).toBe("curb");
    expect(tileUnderPoint(CROSSING_TILEMAP, { x: 280, y: 180 })).toBe("zebra");
    expect(CROSSING_TILEMAP.groundRows.join("")).toContain("z");
  });
});
