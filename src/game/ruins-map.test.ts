import { describe, expect, it } from "vitest";
import { RUINS_TILEMAP } from "./ruins-map";

describe("ruins tile map", () => {
  it("keeps the final plaza and facade on the shared warm-gray tile layer", () => {
    expect(RUINS_TILEMAP.rows).toHaveLength(22);
    expect(RUINS_TILEMAP.rows.every((row) => row.length === 40)).toBe(true);
    expect(RUINS_TILEMAP.rows.slice(0, 3).every((row) => row[0] === "#")).toBe(true);
    expect(RUINS_TILEMAP.legend["."]).toBe("stone");
  });
});
