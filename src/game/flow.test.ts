import { describe, expect, it } from "vitest";
import { OLD_CITY_CROSSING } from "./content";
import { BASE_WALK_SPEED, BELL_WINDOW_MS, busRideCheckpointAfterBell, checkpointForStage, COLOR_MEMORY_LIMIT, constrainCrossingPosition, determineEnding, effectiveWalkSpeed, isBusState, isKnownStage, mergeColorMemory, movementSpeedMultiplier, resumePointForStage, shouldStartWheelchairProcession, transitionBus, transitionCrossing } from "./flow";
import { RUINS_DAUGHTER_END, RUINS_DAUGHTER_START, RUINS_LAM_END, RUINS_LAM_START, RUINS_PLAYER_END, RUINS_PLAYER_START, RUINS_PROCESSION_DURATION_MS, ruinsProcessionPositions } from "./ruins-map";
import type { ResumeStage } from "./types";

describe("bus state machine", () => {
  it("keeps the free-exploration bus checkpoints explicit", () => {
    expect(BELL_WINDOW_MS).toBe(7000);
    expect(checkpointForStage("bus-interior-entry")).toEqual({ scene: "bus-interior", objectiveId: "find-card-reader", resumeStage: "bus-interior-entry" });
    expect(checkpointForStage("bus-interior-seat")).toEqual({ scene: "bus-interior", objectiveId: "find-seat", resumeStage: "bus-interior-seat" });
    expect(checkpointForStage("bus-interior-bell")).toEqual({ scene: "bus-interior", objectiveId: "ring-bell", resumeStage: "bus-interior-bell" });
    expect(resumePointForStage("bus-interior-entry")).toEqual({ x: 536, y: 76 });
  });

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

  it("routes the normal post-bell flow through the bus ride scene", () => {
    expect(busRideCheckpointAfterBell("seated")).toEqual({
      busState: "riding",
      scene: "bus-ride",
      objectiveId: "ride-to-camoes",
      resumeStage: "bus-ride",
    });
  });

  it("keeps every outdoor non-tactile surface at exactly 35%", () => {
    expect(movementSpeedMultiplier({ onRoad: false, hasPath: true, onGuidedPath: true })).toBe(1);
    expect(movementSpeedMultiplier({ onRoad: false, hasPath: true, onGuidedPath: false })).toBe(0.35);
    expect(movementSpeedMultiplier({ onRoad: true, hasPath: true, onGuidedPath: false })).toBe(0.35);
    expect(movementSpeedMultiplier({ onRoad: false, hasPath: false, onGuidedPath: false })).toBe(1);
    expect(BASE_WALK_SPEED).toBe(68);
    expect(effectiveWalkSpeed(1, 1.6)).toBeCloseTo(108.8);
    expect(effectiveWalkSpeed(0.35, 1.6)).toBeCloseTo(38.08);
    expect(effectiveWalkSpeed(0.35, 1.6) / effectiveWalkSpeed(1, 1.6)).toBeCloseTo(0.35);
  });
});

describe("save-data guards", () => {
  it("recognizes real stages and bus states but rejects junk", () => {
    expect(isKnownStage("bus-interior-bell")).toBe(true);
    expect(isKnownStage("bus-stop-entry")).toBe(true);
    expect(isKnownStage("bogus")).toBe(false);
    expect(isKnownStage(42)).toBe(false);
    expect(isBusState("seated")).toBe(true);
    expect(isBusState("waiting")).toBe(true);
    expect(isBusState("bogus")).toBe(false);
  });

  it("degrades an unknown resume stage to the first checkpoint instead of crashing", () => {
    expect(resumePointForStage("bogus" as ResumeStage)).toEqual({ x: 88, y: 268 });
    expect(checkpointForStage("bogus" as ResumeStage)).toEqual({ scene: "bus-stop", objectiveId: "find-stop-sign", resumeStage: "bus-stop-entry" });
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
    expect(checkpointForStage("old-city-wait")).toEqual({ scene: "old-city", objectiveId: "wait-crossing", resumeStage: "old-city-wait" });
    expect(resumePointForStage("old-city-wait")).toEqual({ x: 40, y: 124 });
    expect(checkpointForStage("old-city-street")).toEqual({ scene: "old-city", objectiveId: "follow-street-south", resumeStage: "old-city-street" });
    expect(resumePointForStage("old-city-street")).toEqual({ x: 232, y: 124 });
  });

  it("blocks the roadway before permission and constrains the open crossing corridor", () => {
    expect(constrainCrossingPosition("requested", { x: 410, y: 180 }, OLD_CITY_CROSSING)).toEqual({ x: 56, y: 180 });

    const constrained = constrainCrossingPosition("walk", { x: 300, y: 124 }, OLD_CITY_CROSSING);
    expect(constrained.x).toBe(OLD_CITY_CROSSING.farCurb.x);
    expect(constrained.y).toBe(124);
    expect(constrainCrossingPosition("walk", { x: 120, y: 60 }, OLD_CITY_CROSSING).y).toBe(OLD_CITY_CROSSING.requestPoint.y - OLD_CITY_CROSSING.corridorWidth / 2);
    expect(constrainCrossingPosition("walk", { x: 10, y: 124 }, OLD_CITY_CROSSING).x).toBe(OLD_CITY_CROSSING.requestPoint.x);
  });
});

describe("ending selection", () => {
  it("selects return only from an explicit request", () => {
    expect(determineEnding({ elapsedSeconds: 20, detourScore: 0, returnRequested: true })).toBe("return");
  });

  it("selects detour for severe corrections without punishing slow exploration", () => {
    expect(determineEnding({ elapsedSeconds: 481, detourScore: 0, returnRequested: false })).toBe("reunion");
    expect(determineEnding({ elapsedSeconds: 100, detourScore: 5, returnRequested: false })).toBe("detour");
  });

  it("selects reunion for a direct arrival", () => {
    expect(determineEnding({ elapsedSeconds: 300, detourScore: 2, returnRequested: false })).toBe("reunion");
  });
});

describe("wheelchair finale procession", () => {
  it("starts only when the story wheelchair tip is closed", () => {
    expect(shouldStartWheelchairProcession({ id: "wheelchair-pushing", source: "wheelchair" })).toBe(true);
    expect(shouldStartWheelchairProcession({ id: "wheelchair-pushing", source: "sidebar" })).toBe(false);
    expect(shouldStartWheelchairProcession({ id: "bus-ride-access", source: "bell" })).toBe(false);
  });

  it("restores the entry and procession at the shared safe start", () => {
    expect(checkpointForStage("ruins-entry")).toEqual({ scene: "ruins", objectiveId: "meet-lam", resumeStage: "ruins-entry" });
    expect(checkpointForStage("ruins-procession")).toEqual({ scene: "ruins", objectiveId: "follow-wheelchair", resumeStage: "ruins-procession" });
    expect(resumePointForStage("ruins-entry")).toEqual(RUINS_PLAYER_START);
    expect(resumePointForStage("ruins-procession")).toEqual(RUINS_PLAYER_START);
  });

  it("keeps the three actors 24 pixels apart for the 3.8 second climb", () => {
    expect(RUINS_PROCESSION_DURATION_MS).toBe(3800);
    expect(ruinsProcessionPositions(0)).toEqual({ lam: RUINS_LAM_START, daughter: RUINS_DAUGHTER_START, player: RUINS_PLAYER_START });
    expect(ruinsProcessionPositions(1)).toEqual({ lam: RUINS_LAM_END, daughter: RUINS_DAUGHTER_END, player: RUINS_PLAYER_END });
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const positions = ruinsProcessionPositions(progress);
      expect(positions.daughter.y - positions.lam.y).toBe(24);
      expect(positions.player.y - positions.daughter.y).toBe(24);
      expect(positions.lam.x).toBe(328);
      expect(positions.daughter.x).toBe(328);
      expect(positions.player.x).toBe(328);
    }
  });
});

describe("color memory", () => {
  it("keeps distant discoveries and deduplicates nearby cane contacts", () => {
    const first = { scene: "old-city" as const, x: 100, y: 120, radius: 38 };
    expect(mergeColorMemory([], first)).toEqual([first]);
    expect(mergeColorMemory([first], { ...first, x: 108, y: 124 })).toEqual([first]);
    expect(mergeColorMemory([first], { ...first, x: 150 })).toHaveLength(2);
  });

  it("caps the memory list by dropping the oldest discoveries", () => {
    const seed = Array.from({ length: COLOR_MEMORY_LIMIT }, (_, index) => ({ scene: "old-city" as const, x: index * 100, y: 120, radius: 38 }));
    const merged = mergeColorMemory(seed, { scene: "old-city", x: 99999, y: 120, radius: 38 });
    expect(merged).toHaveLength(COLOR_MEMORY_LIMIT);
    expect(merged[0].x).toBe(100);
    expect(merged[merged.length - 1].x).toBe(99999);
  });
});
