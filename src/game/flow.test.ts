import { describe, expect, it } from "vitest";
import { determineEnding, transitionBus } from "./flow";

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
