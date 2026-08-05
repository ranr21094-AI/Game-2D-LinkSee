import { describe, expect, it } from "vitest";
import { BUS_STOP_DECOY_SIGNS, BUS_STOP_DOOR, BUS_STOP_GATE_ENTRY, BUS_STOP_PATH_START, BUS_STOP_SIGN, BUS_STOP_SIGN_PROBE_RADIUS, BUS_STOP_TILEMAP } from "./busstop-map";
import { PATHS } from "./content";
import { isWalkable, solidDecorationAt } from "./tilemap";

function pointToSegmentDistance(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = Math.max(1, abx * abx + aby * aby);
  const t = Math.min(1, Math.max(0, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSq));
  return Math.hypot(point.x - (a.x + abx * t), point.y - (a.y + aby * t));
}

function distanceToTactileRoute(point: { x: number; y: number }): number {
  const nodes = PATHS["bus-stop"].nodes;
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < nodes.length - 1; index += 1) {
    if (nodes[index + 1].breakBefore) continue;
    best = Math.min(best, pointToSegmentDistance(point, nodes[index], nodes[index + 1]));
  }
  return best;
}

describe("bus-stop solid decorations", () => {
  it("places the route signs in the requested screenshot slots", () => {
    expect(BUS_STOP_TILEMAP.decorations.find((decoration) => decoration.kind === "stop-sign-17")).toMatchObject({ x: 520, y: 282 });
    expect(BUS_STOP_TILEMAP.decorations.find((decoration) => decoration.kind === "stop-sign-25")).toMatchObject({ x: 272, y: 282 });
    expect(BUS_STOP_SIGN).toEqual({ x: 520, y: 241 });
    expect(BUS_STOP_DECOY_SIGNS[0]).toMatchObject({ x: 272, y: 241, route: "25" });
    expect(BUS_STOP_SIGN_PROBE_RADIUS).toBe(42);
  });

  it("keeps stop signs off the tactile route", () => {
    [BUS_STOP_SIGN, ...BUS_STOP_DECOY_SIGNS].forEach((sign) => {
      expect(distanceToTactileRoute(sign), `sign at ${sign.x},${sign.y}`).toBeGreaterThan(14);
      expect(distanceToTactileRoute(sign), `sign at ${sign.x},${sign.y}`).toBeLessThanOrEqual(42);
    });
  });

  it("blocks the gate building, benches and sign poles", () => {
    [
      { label: "gate facade", x: 320, y: 90 },
      { label: "left bench", x: 112, y: 214 },
      { label: "shelter bench", x: 424, y: 158 },
      { label: "17 sign pole", x: 520, y: 270 },
      { label: "25 sign pole", x: 272, y: 270 },
    ].forEach((point) => {
      expect(isWalkable(BUS_STOP_TILEMAP, point), `${point.label} should block`).toBe(false);
      expect(solidDecorationAt(BUS_STOP_TILEMAP, point), `${point.label} should be solid`).not.toBeNull();
    });
  });

  it("defines a tiled gate facade and keeps its introduction positions valid", () => {
    const gate = BUS_STOP_TILEMAP.decorations.find((decoration) => decoration.kind === "gate-building");
    expect(gate).toBeDefined();
    expect(gate!.height % 16).toBe(0);
    expect(gate!.width).toBe(640);
    expect(Math.round(gate!.width / 16)).toBe(40);
    expect(isWalkable(BUS_STOP_TILEMAP, BUS_STOP_GATE_ENTRY)).toBe(true);
    expect(isWalkable(BUS_STOP_TILEMAP, BUS_STOP_PATH_START)).toBe(true);
  });

  it("keeps spawn, objectives and cane reading points walkable", () => {
    [
      { label: "spawn", ...BUS_STOP_PATH_START },
      { label: "find-stop-sign target", x: 488, y: 252 },
      { label: "board-17 door", x: BUS_STOP_DOOR.x, y: BUS_STOP_DOOR.y },
      { label: "17 sign plate", x: BUS_STOP_SIGN.x, y: BUS_STOP_SIGN.y },
      { label: "25 sign plate", x: BUS_STOP_DECOY_SIGNS[0].x, y: BUS_STOP_DECOY_SIGNS[0].y },
    ].forEach((point) => {
      expect(isWalkable(BUS_STOP_TILEMAP, point), `${point.label} should stay walkable`).toBe(true);
    });
  });
});
