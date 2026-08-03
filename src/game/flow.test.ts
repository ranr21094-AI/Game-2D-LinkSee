import { describe, expect, it } from "vitest";
import { OLD_CITY_CROSSING } from "./content";
import { checkpointForScene, constrainCrossingPosition, determineEnding, transitionBus, transitionCrossing } from "./flow";

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
    expect(checkpointForScene("old-city-crossing")).toEqual({ scene: "old-city-crossing", objectiveId: "request-crossing" });
  });

  it("blocks the roadway before permission and constrains the open crossing corridor", () => {
    expect(constrainCrossingPosition("requested", { x: 410, y: 180 }, OLD_CITY_CROSSING)).toEqual({ x: 340, y: 258 });

    const constrained = constrainCrossingPosition("walk", { x: 420, y: 260 }, OLD_CITY_CROSSING);
    const dx = OLD_CITY_CROSSING.farCurb.x - OLD_CITY_CROSSING.requestPoint.x;
    const dy = OLD_CITY_CROSSING.farCurb.y - OLD_CITY_CROSSING.requestPoint.y;
    const relativeX = constrained.x - OLD_CITY_CROSSING.requestPoint.x;
    const relativeY = constrained.y - OLD_CITY_CROSSING.requestPoint.y;
    const distance = Math.abs(relativeX * dy - relativeY * dx) / Math.hypot(dx, dy);
    expect(distance).toBeLessThanOrEqual(OLD_CITY_CROSSING.corridorWidth / 2 + 0.001);
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
