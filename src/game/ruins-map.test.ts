import { describe, expect, it } from "vitest";
import { PATHS } from "./content";
import { RUINS_DAUGHTER_END, RUINS_DAUGHTER_START, RUINS_LAM_END, RUINS_LAM_START, RUINS_PLAYER_END, RUINS_PLAYER_START, RUINS_TILEMAP } from "./ruins-map";
import { isWalkable, solidDecorationAt, tileAt, validateTileMap } from "./tilemap";

describe("ruins tile map", () => {
  it("keeps the final plaza and facade on the shared warm-gray tile layer", () => {
    expect(RUINS_TILEMAP.groundRows).toHaveLength(22);
    expect(RUINS_TILEMAP.groundRows.every((row) => row.length === 40)).toBe(true);
    expect(RUINS_TILEMAP.groundRows.slice(0, 3).every((row) => row[0] === "B")).toBe(true);
    expect(RUINS_TILEMAP.legend.p).toBe("plaza");
  });

  it("keeps a continuous four-tile ramp between road and facade", () => {
    expect(validateTileMap(RUINS_TILEMAP)).toEqual([]);
    for (let row = 6; row <= 19; row += 1) {
      for (let col = 18; col <= 21; col += 1) expect(tileAt(RUINS_TILEMAP, col, row)).toBe("ramp");
    }
    expect(tileAt(RUINS_TILEMAP, 17, 7)).toBe("steps");
    expect(tileAt(RUINS_TILEMAP, 22, 7)).toBe("steps");
  });

  it("uses continuous solid rails without covering actors or route nodes", () => {
    const rails = RUINS_TILEMAP.decorations.filter((decoration) => decoration.kind === "ramp-rail");
    expect(rails).toHaveLength(2);
    expect(rails.map((rail) => rail.x)).toEqual([288, 352]);
    expect(rails.every((rail) => rail.solid && rail.height === 224)).toBe(true);
    const points = [RUINS_PLAYER_START, RUINS_LAM_START, RUINS_DAUGHTER_START, RUINS_LAM_END, RUINS_DAUGHTER_END, RUINS_PLAYER_END, ...PATHS.ruins.nodes];
    points.forEach((point) => {
      expect(isWalkable(RUINS_TILEMAP, point), `${point.x},${point.y} should be walkable`).toBe(true);
      expect(solidDecorationAt(RUINS_TILEMAP, point)).toBeNull();
    });
  });
});
