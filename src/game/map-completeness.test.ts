import { describe, expect, it } from "vitest";
import { BUS_INTERIOR_TILEMAP } from "./businterior-map";
import { BUS_STOP_TILEMAP } from "./busstop-map";
import { OBJECTIVES, PATHS } from "./content";
import { CROSSING_TILEMAP } from "./crossing-map";
import { deterministicTileVariant } from "./ground-tiles";
import { OLD_CITY_TILEMAP } from "./oldcity-map";
import { RUINS_TILEMAP } from "./ruins-map";
import { movementAt, nearestSafeWalkablePoint, tileAt, validateTileMap, type TileMapDefinition } from "./tilemap";

const MAPS: Record<keyof typeof PATHS, TileMapDefinition> = {
  "bus-stop": BUS_STOP_TILEMAP,
  "bus-interior": BUS_INTERIOR_TILEMAP,
  "old-city": OLD_CITY_TILEMAP,
  "old-city-crossing": CROSSING_TILEMAP,
  ruins: RUINS_TILEMAP,
};

describe("complete scene maps", () => {
  it("assigns ground and movement meaning to all 880 cells", () => {
    Object.values(MAPS).forEach((map) => {
      expect(validateTileMap(map)).toEqual([]);
      expect(map.groundRows.join("")).toHaveLength(880);
      expect(map.movementRows.join("")).toHaveLength(880);
      for (let row = 0; row < 22; row += 1) for (let col = 0; col < 40; col += 1) {
        expect(tileAt(map, col, row)).not.toBeNull();
        expect(movementAt(map, col, row)).not.toBeNull();
      }
    });
  });

  it("gives every outdoor map buildings, sidewalk, curb, drainage and road", () => {
    [BUS_STOP_TILEMAP, OLD_CITY_TILEMAP, CROSSING_TILEMAP, RUINS_TILEMAP].forEach((map) => {
      const surfaces = new Set(Array.from({ length: 22 }, (_, row) => Array.from({ length: 40 }, (_, col) => tileAt(map, col, row))).flat());
      ["building", "sidewalk", "curb", "drain", "asphalt"].forEach((surface) => expect(surfaces.has(surface as never), `${map.id} missing ${surface}`).toBe(true));
    });
  });

  it("keeps route nodes and objectives outside decoration footprints", () => {
    Object.entries(MAPS).forEach(([scene, map]) => {
      const points = [...PATHS[scene as keyof typeof PATHS].nodes, ...Object.values(OBJECTIVES).filter((objective) => objective.scene === scene && (objective.target.x || objective.target.y)).map((objective) => objective.target)];
      map.decorations.forEach((decoration) => points.forEach((point) => {
        const covered = point.x > decoration.x - decoration.width / 2 && point.x < decoration.x + decoration.width / 2 && point.y > decoration.y - decoration.height && point.y < decoration.y;
        expect(covered, `${scene} point ${point.x},${point.y} covered by ${decoration.kind}`).toBe(false);
      }));
    });
  });

  it("marks only the zebra corridor as a legal crossing through the arterial road", () => {
    for (let row = 7; row <= 16; row += 1) for (let col = 0; col < 40; col += 1) {
      expect(movementAt(CROSSING_TILEMAP, col, row)).toBe(col >= 16 && col <= 18 ? "crossing" : "road");
    }
  });

  it("finds a safe sidewalk point from a soft road boundary", () => {
    const safe = nearestSafeWalkablePoint(BUS_STOP_TILEMAP, { x: 320, y: 340 });
    expect(safe).not.toBeNull();
    expect(safe!.y).toBeLessThan(320);
  });

  it("selects three deterministic variants without changing between calls", () => {
    const variants = Array.from({ length: 40 }, (_, col) => deterministicTileVariant("old-city", col, 10, "plaza"));
    expect(new Set(variants)).toEqual(new Set([0, 1, 2]));
    expect(deterministicTileVariant("old-city", 7, 10, "plaza")).toBe(deterministicTileVariant("old-city", 7, 10, "plaza"));
  });
});
