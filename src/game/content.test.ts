import { describe, expect, it } from "vitest";
import { composeRepeatText, OLD_CITY_CROSSING, OLD_CITY_HANDRAIL, PATHS, REVEAL_PROFILE, TACTILE_LIT_MS } from "./content";
import { BUS_INTERIOR_TILEMAP } from "./businterior-map";
import { BUS_STOP_TILEMAP } from "./busstop-map";
import { CROSSING_TILEMAP } from "./crossing-map";
import { OLD_CITY_TILEMAP } from "./oldcity-map";
import { RUINS_TILEMAP } from "./ruins-map";
import { isWalkable, type TileMapDefinition } from "./tilemap";
import type { GroundTileKey } from "./ground-tiles";

describe("tactile path definitions", () => {
  it("keeps path coordinates valid and marks only intentional breaks", () => {
    Object.values(PATHS).forEach((path) => {
      expect(path.nodes.length).toBeGreaterThanOrEqual(4);
      path.nodes.forEach((node) => {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
      });
    });
    expect(PATHS["old-city"].nodes.filter((node) => node.breakBefore)).toHaveLength(1);
    expect(PATHS["old-city-crossing"].nodes.filter((node) => node.breakBefore)).toHaveLength(1);
    expect(PATHS["bus-stop"].nodes.filter((node) => node.breakBefore)).toHaveLength(1);
    expect(PATHS["bus-interior"].nodes.filter((node) => node.breakBefore)).toHaveLength(1);
  });

  it("keeps every tactile route segment axis-aligned", () => {
    Object.values(PATHS).forEach((path) => {
      path.nodes.slice(0, -1).forEach((node, index) => {
        const next = path.nodes[index + 1];
        expect(node.x === next.x || node.y === next.y).toBe(true);
      });
    });
  });

  it("places every route node on a walkable tile", () => {
    const maps: Record<keyof typeof PATHS, TileMapDefinition> = {
      "bus-stop": BUS_STOP_TILEMAP,
      "bus-interior": BUS_INTERIOR_TILEMAP,
      "old-city": OLD_CITY_TILEMAP,
      "old-city-crossing": CROSSING_TILEMAP,
      ruins: RUINS_TILEMAP,
    };
    const walkable = new Set<GroundTileKey>(["stone", "plaza", "concrete", "asphalt", "zebra", "curb", "dirt", "bus-floor"]);
    Object.entries(PATHS).forEach(([scene, path]) => {
      path.nodes.forEach((node) => expect(isWalkable(maps[scene as keyof typeof PATHS], node, walkable), `${scene} node ${node.x},${node.y}`).toBe(true));
    });
  });

  it("places decision tiles at boarding, seat and destination tasks", () => {
    const decisions = Object.values(PATHS).flatMap((path) => path.nodes.filter((node) => node.kind === "decision"));
    expect(decisions.some((node) => node.taskId === "board-17")).toBe(true);
    expect(decisions.some((node) => node.taskId === "find-seat")).toBe(true);
    expect(decisions.some((node) => node.taskId === "meet-lam")).toBe(true);
  });

  it("bridges the old-city tactile-path gap with the guide rail", () => {
    const oldCity = PATHS["old-city"].nodes;
    const railStart = oldCity.find((node) => node.taskId === "follow-old-city-path");
    const railEnd = oldCity.find((node) => node.taskId === "follow-handrail");
    expect(railStart).toMatchObject(OLD_CITY_HANDRAIL.start);
    expect(railEnd).toMatchObject({ ...OLD_CITY_HANDRAIL.end, breakBefore: true });
  });

  it("keeps tactile paving on the two curbs instead of across the roadway", () => {
    const crossing = PATHS["old-city-crossing"].nodes;
    expect(crossing.find((node) => node.taskId === "request-crossing")).toMatchObject(OLD_CITY_CROSSING.requestPoint);
    expect(crossing.find((node) => node.taskId === "cross-junction")).toMatchObject({ ...OLD_CITY_CROSSING.farCurb, breakBefore: true });
  });

  it("uses the requested reveal ranges and durations", () => {
    expect(REVEAL_PROFILE.tapForwardTiles).toBe(1);
    expect(REVEAL_PROFILE.tapBackTiles).toBe(0);
    expect(REVEAL_PROFILE.tapDurationMs).toBe(3000);
    expect(REVEAL_PROFILE.hintTiles).toBe(8);
    expect(REVEAL_PROFILE.hintDurationMs).toBe(3500);
  });

  it("keeps tactile highlight and color memory timing aligned", () => {
    expect(TACTILE_LIT_MS).toBe(2000);
  });

  it("repeats the latest tactile result together with the current task", () => {
    expect(composeRepeatText("四条连续凸纹：沿纹路继续", "当前任务：找到扶手")).toBe("最近触觉：四条连续凸纹：沿纹路继续。当前任务：找到扶手");
  });
});
