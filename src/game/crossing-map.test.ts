import { describe, expect, it } from "vitest";
import { CROSSING_TILEMAP } from "./crossing-map";
import { tileUnderPoint } from "./tilemap";

describe("crossing tile map", () => {
  it("keeps a 40x22 asphalt map and marks both curb entries as zebra", () => {
    expect(CROSSING_TILEMAP.rows).toHaveLength(22);
    expect(CROSSING_TILEMAP.rows.every((row) => row.length === 40)).toBe(true);
    expect(tileUnderPoint(CROSSING_TILEMAP, { x: 278, y: 288 })).toBe("zebra");
    expect(tileUnderPoint(CROSSING_TILEMAP, { x: 278, y: 80 })).toBe("zebra");
    expect(tileUnderPoint(CROSSING_TILEMAP, { x: 430, y: 80 })).toBe("zebra");
    expect(CROSSING_TILEMAP.rows.join("")).toContain("z");
  });
});
