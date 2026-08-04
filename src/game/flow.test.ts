import { describe, expect, it } from "vitest";
import { OLD_CITY_CROSSING } from "./content";
import { checkpointForStage, constrainCrossingPosition, determineEnding, mergeColorMemory, resumePointForStage, transitionBus, transitionCrossing } from "./flow";

describe("bus state machine", () => {
  it("follows the seven required stages", () => {
    let state = transitionBus("waiting", "openDoor");
    expect(state).toBe("doorOpen");
    state = transitionBus(state, "board");
    expect(state).toBe("boarding");
    state = transitionBus(state, "sit");
    expect(state).toBe("seated");
    state = transitionBus(state, "depart");
    expect(state).toBe("riding");
    state = transitionBus(state, "arrive");
    expect(state).toBe("arrived");
    state = transitionBus(state, "alight");
    expect(state).toBe("alighted");
  });

  it("lets boarding advance to seated without consulting an objective id", () => {
    expect(transitionBus("boarding", "sit")).toBe("seated");
  });

  it("rejects invalid jumps", () => {
    expect(transitionBus("waiting", "sit")).toBe("waiting");
  });
});

describe("crossing state machine", () => {
  it("requires a request before allowing the player to cross", () => {
    expect(transitionCrossing("approach", "allow")).toBe("approach");
    const requested = transitionCrossing("approach", "request");
    expect(requested).toBe("requested");
    const walk = transitionCrossing(requested, "allow");
    expect(walk).toBe("walk");
    expect(transitionCrossing(walk, "finish")).toBe("crossed");
  });

  it("restores the crossing at its safe request point", () => {
    expect(checkpointForStage("crossing-wait")).toEqual({ scene: "old-city-crossing", objectiveId: "wait-crossing", resumeStage: "crossing-wait" });
    expect(resumePointForStage("crossing-wait")).toEqual({ x: 280, y: 284 });
  });

  it("blocks the roadway before permission and constrains the open crossing corridor", () => {
    expect(constrainCrossingPosition("requested", { x: 410, y: 180 }, OLD_CITY_CROSSING)).toEqual({ x: 320, y: 280 });

    const constrained = constrainCrossingPosition("walk", { x: 420, y: 260 }, OLD_CITY_CROSSING);
    expect(constrained.x).toBe(OLD_CITY_CROSSING.requestPoint.x + OLD_CITY_CROSSING.corridorWidth / 2);
    expect(constrained.y).toBe(260);
    expect(constrainCrossingPosition("walk", { x: 280, y: 20 }, OLD_CITY_CROSSING).y).toBe(108);
  });
});

describe("ending selection", () => {
  it("selects return only from an explicit request", () => {
    expect(determineEnding({ elapsedSeconds: 20, detourScore: 0, returnRequested: true })).toBe("return");
  });

  it("selects detour for time or severe corrections", () => {
    expect(determineEnding({ elapsedSeconds: 481, detourScore: 0, returnRequested: false })).toBe("detour");
    expect(determineEnding({ elapsedSeconds: 100, detourScore: 5, returnRequested: false })).toBe("detour");
  });

  it("selects reunion for a direct arrival", () => {
    expect(determineEnding({ elapsedSeconds: 300, detourScore: 2, returnRequested: false })).toBe("reunion");
  });
});

describe("color memory", () => {
  it("keeps distant discoveries and deduplicates nearby cane contacts", () => {
    const first = { scene: "old-city" as const, x: 100, y: 120, radius: 38 };
    expect(mergeColorMemory([], first)).toEqual([first]);
    expect(mergeColorMemory([first], { ...first, x: 108, y: 124 })).toEqual([first]);
    expect(mergeColorMemory([first], { ...first, x: 150 })).toHaveLength(2);
  });
});
