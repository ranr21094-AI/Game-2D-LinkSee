import { describe, expect, it } from "vitest";
import { OLD_CITY_CROSSING, OLD_CITY_HANDRAIL, PATHS, REVEAL_PROFILE } from "./content";

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
    expect(Object.entries(PATHS).filter(([scene]) => !["old-city", "old-city-crossing"].includes(scene)).every(([, path]) => path.nodes.every((node) => !node.breakBefore))).toBe(true);
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
    expect(REVEAL_PROFILE.tapForwardTiles).toBe(4);
    expect(REVEAL_PROFILE.tapBackTiles).toBe(1);
    expect(REVEAL_PROFILE.tapDurationMs).toBe(3000);
    expect(REVEAL_PROFILE.sweepTiles).toBe(5);
    expect(REVEAL_PROFILE.sweepDurationMs).toBe(2500);
    expect(REVEAL_PROFILE.hintTiles).toBe(8);
    expect(REVEAL_PROFILE.hintDurationMs).toBe(3500);
  });
});
