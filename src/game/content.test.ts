import { describe, expect, it } from "vitest";
import { composeRepeatText, OBJECTIVES, OLD_CITY_CROSSING, PATHS, REVEAL_PROFILE, TACTILE_LIT_MS, TIP_DEFINITIONS, TUTORIAL_LINES } from "./content";
import { BUS_SEATED_SPRITE_KEYS } from "./businterior-map";
import { BUS_STOP_TILEMAP } from "./busstop-map";
import { OLD_CITY_TILEMAP } from "./oldcity-map";
import { RUINS_TILEMAP } from "./ruins-map";
import { isWalkable, type TileMapDefinition } from "./tilemap";

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
    expect(PATHS["bus-stop"].nodes.filter((node) => node.breakBefore)).toHaveLength(0);
    expect(PATHS).not.toHaveProperty("bus-interior");
    expect(PATHS).not.toHaveProperty("old-city-crossing");
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
      "old-city": OLD_CITY_TILEMAP,
      ruins: RUINS_TILEMAP,
    };
    Object.entries(PATHS).forEach(([scene, path]) => {
      path.nodes.forEach((node) => expect(isWalkable(maps[scene as keyof typeof PATHS], node), `${scene} node ${node.x},${node.y}`).toBe(true));
    });
  });

  it("places decision tiles at boarding, seat and destination tasks", () => {
    const decisions = Object.values(PATHS).flatMap((path) => path.nodes.filter((node) => node.kind === "decision"));
    expect(decisions.find((node) => node.taskId === "find-stop-sign")).toMatchObject({ x: 488, y: 252 });
    expect(decisions.some((node) => node.taskId === "board-17")).toBe(true);
    expect(decisions.some((node) => node.taskId === "find-seat")).toBe(false);
    expect(decisions.some((node) => node.taskId === "meet-lam")).toBe(true);
  });

  it("anchors the crossing decisions at the request point and the far curb", () => {
    const oldCity = PATHS["old-city"].nodes;
    expect(oldCity.find((node) => node.taskId === "request-crossing")).toMatchObject(OLD_CITY_CROSSING.requestPoint);
    expect(oldCity.find((node) => node.taskId === "cross-junction")).toMatchObject({ ...OLD_CITY_CROSSING.farCurb, breakBefore: true });
  });

  it("chains the merged street objectives along the U-shaped route", () => {
    const oldCity = PATHS["old-city"].nodes;
    expect(oldCity.find((node) => node.taskId === "follow-street-south")).toMatchObject(OBJECTIVES["follow-street-south"].target);
    expect(oldCity.find((node) => node.taskId === "follow-street-east")).toMatchObject(OBJECTIVES["follow-street-east"].target);
    expect(oldCity.find((node) => node.taskId === "visit-pet-shop")).toMatchObject(OBJECTIVES["visit-pet-shop"].target);
    expect(oldCity.find((node) => node.taskId === "reach-terminus")).toMatchObject(OBJECTIVES["reach-terminus"].target);
    expect(OBJECTIVES["visit-pet-shop"].interaction).toBe("interact");
  });

  it("uses the requested reveal ranges and durations", () => {
    expect(REVEAL_PROFILE.tapForwardTiles).toBe(1);
    expect(REVEAL_PROFILE.tapBackTiles).toBe(0);
    expect(REVEAL_PROFILE.tapDurationMs).toBe(180);
    expect(REVEAL_PROFILE.hintTiles).toBe(8);
    expect(REVEAL_PROFILE.hintDurationMs).toBe(2000);
  });

  it("keeps tactile highlight and color memory timing aligned", () => {
    expect(TACTILE_LIT_MS).toBe(2000);
  });

  it("repeats the latest tactile result together with the current task", () => {
    expect(composeRepeatText("四条连续凸纹：沿纹路继续", "当前任务：找到扶手")).toBe("最近触觉：四条连续凸纹：沿纹路继续。当前任务：找到扶手");
  });

  it("keeps the temporarily disabled F phone assist out of tutorial copy", () => {
    expect(TUTORIAL_LINES.join(" ")).not.toMatch(/F\s*辅助|F\s*手机|手机定位/);
  });

  it("defines all data-driven accessibility tips", () => {
    expect(Object.keys(TIP_DEFINITIONS)).toEqual(["sighted-guide", "bus-access", "bus-ride-access", "wheelchair-pushing", "guide-dog-access"]);
    const tip = TIP_DEFINITIONS["bus-access"];
    expect(tip.title).toBe("帮助盲人乘车");
    expect(tip.steps).toHaveLength(3);
    expect(tip.callout).toContain("先问");
    expect(tip.image).toContain("bus-accessibility-tip-pixel");
    const rideTip = TIP_DEFINITIONS["bus-ride-access"];
    expect(rideTip.heading).toBe("让公交更容易被找到");
    expect(rideTip.image).toContain("bus-ride-access-tip-pixel");
    expect(rideTip.steps).toHaveLength(3);
    expect(rideTip.callout).toContain("每辆车都更容易被理解");
    const wheelchairTip = TIP_DEFINITIONS["wheelchair-pushing"];
    expect(wheelchairTip.title).toBe("轮椅推行需要学习");
    expect(wheelchairTip.heading).toBe("会推轮椅，不只是向前用力");
    expect(wheelchairTip.image).toContain("wheelchair-pushing-tip-pixel");
    expect(wheelchairTip.steps).toHaveLength(5);
    expect(wheelchairTip.steps.map((step) => step.title)).toEqual(["先问再检查", "平地前进", "上坡", "下坡", "上下台阶"]);
    expect(wheelchairTip.callout).toContain("下坡倒退并控制刹车");
    const guideDogTip = TIP_DEFINITIONS["guide-dog-access"];
    expect(guideDogTip.title).toBe("导盲犬在澳门");
    expect(guideDogTip.heading).toBe("在澳门，导盲犬仍是「宠物」");
    expect(guideDogTip.image).toContain("guide-dog-tip-pixel");
    expect(guideDogTip.steps).toHaveLength(3);
    expect(guideDogTip.steps.map((step) => step.title)).toEqual(["法律未承认", "购买困难", "电子导盲犬"]);
    expect(guideDogTip.steps[2].body).toContain("楼梯");
    expect(guideDogTip.callout).toContain("制度的空白");
    expect(BUS_SEATED_SPRITE_KEYS.lower).toBe("traveler-sit-up");
    expect(OBJECTIVES["find-card-reader"].target).toEqual({ x: 488, y: 284 });
    expect(OBJECTIVES["ring-bell"].target).toEqual({ x: 152, y: 188 });
  });

  it("uses the straight central ramp for the wheelchair finale", () => {
    expect(PATHS.ruins.nodes).toEqual([
      { x: 328, y: 316, kind: "guidance" },
      { x: 328, y: 268, kind: "decision", taskId: "meet-lam" },
      { x: 328, y: 204, kind: "guidance" },
      { x: 328, y: 108, kind: "decision", taskId: "follow-wheelchair" },
    ]);
    expect(OBJECTIVES["meet-lam"].target).toEqual({ x: 328, y: 268 });
    expect(OBJECTIVES["follow-wheelchair"].target).toEqual({ x: 328, y: 108 });
  });
});
