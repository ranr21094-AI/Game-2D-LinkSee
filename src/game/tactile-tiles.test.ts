import { describe, expect, it } from "vitest";
import { PATHS } from "./content";
import { describeDecisionBrick, rasterizeTactilePath, TACTILE_BRICK_SIZE } from "./tactile-tiles";
import type { TactilePathDefinition } from "./types";

describe("rasterizeTactilePath", () => {
  it("places a decision brick at every decision node", () => {
    Object.values(PATHS).forEach((path) => {
      const bricks = rasterizeTactilePath(path);
      const decisions = path.nodes.filter((node) => node.kind === "decision");
      decisions.forEach((node) => {
        expect(bricks.some((brick) => brick.kind === "decision" && brick.x === node.x && brick.y === node.y)).toBe(true);
      });
    });
  });

  it("lays guidance bricks no farther apart than one brick size", () => {
    const path: TactilePathDefinition = {
      scene: "bus-stop",
      nodes: [
        { x: 0, y: 0, kind: "guidance" },
        { x: 64, y: 0, kind: "guidance" },
      ],
    };
    const bricks = rasterizeTactilePath(path).sort((a, b) => a.x - b.x);
    expect(bricks.length).toBeGreaterThanOrEqual(4);
    for (let index = 0; index < bricks.length - 1; index += 1) {
      expect(bricks[index + 1].x - bricks[index].x).toBeLessThanOrEqual(TACTILE_BRICK_SIZE + 0.001);
    }
    bricks.forEach((brick) => expect(brick.orientation).toBeCloseTo(0));
  });

  it("lets decision bricks replace overlapping guidance bricks", () => {
    const path: TactilePathDefinition = {
      scene: "bus-stop",
      nodes: [
        { x: 0, y: 0, kind: "guidance" },
        { x: 32, y: 0, kind: "decision" },
      ],
    };
    const bricks = rasterizeTactilePath(path);
    expect(bricks.filter((brick) => brick.kind === "decision")).toHaveLength(1);
    expect(bricks.some((brick) => brick.kind === "guidance" && Math.hypot(brick.x - 32, brick.y) < TACTILE_BRICK_SIZE * 0.75)).toBe(false);
  });

  it("keeps guidance bricks off the zebra gap between the two curbs", () => {
    const nodes = PATHS["old-city"].nodes;
    const start = nodes.find((node) => node.taskId === "request-crossing")!;
    const end = nodes.find((node) => node.taskId === "cross-junction")!;
    const guidance = rasterizeTactilePath(PATHS["old-city"]).filter((brick) => brick.kind === "guidance");
    [0.25, 0.5, 0.75].forEach((t) => {
      const point = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
      const nearest = Math.min(...guidance.map((brick) => Math.hypot(brick.x - point.x, brick.y - point.y)));
      expect(nearest).toBeGreaterThan(TACTILE_BRICK_SIZE);
    });
  });
});

describe("describeDecisionBrick", () => {
  const makePath = (nodes: TactilePathDefinition["nodes"]): TactilePathDefinition => ({ scene: "bus-stop", nodes });

  it("reads a straight continuation", () => {
    const path = makePath([
      { x: 0, y: 0, kind: "guidance" },
      { x: 32, y: 0, kind: "decision" },
      { x: 64, y: 0, kind: "guidance" },
    ]);
    expect(describeDecisionBrick(path, 1)).toContain("前方继续");
  });

  it("reads a right turn in screen coordinates", () => {
    // travelling east, then turning to face down-screen = visual right turn
    const path = makePath([
      { x: 0, y: 0, kind: "guidance" },
      { x: 32, y: 0, kind: "decision" },
      { x: 32, y: 32, kind: "guidance" },
    ]);
    expect(describeDecisionBrick(path, 1)).toContain("右侧");
  });

  it("reads a left turn in screen coordinates", () => {
    // travelling east, then turning to face up-screen = visual left turn
    const path = makePath([
      { x: 0, y: 0, kind: "guidance" },
      { x: 32, y: 0, kind: "decision" },
      { x: 32, y: -32, kind: "guidance" },
    ]);
    expect(describeDecisionBrick(path, 1)).toContain("左侧");
  });

  it("reads an interrupted path", () => {
    const path = makePath([
      { x: 0, y: 0, kind: "guidance" },
      { x: 32, y: 0, kind: "decision" },
      { x: 64, y: 0, kind: "guidance", breakBefore: true },
    ]);
    expect(describeDecisionBrick(path, 1)).toContain("中断");
  });
});
