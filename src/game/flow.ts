import type { BusTransitState, EndingId, EndingMetrics, GameSnapshotV2, SceneId } from "./types";

export type BusAction = "openDoor" | "board" | "sit" | "depart" | "arrive" | "alight";

const BUS_TRANSITIONS: Record<BusTransitState, Partial<Record<BusAction, BusTransitState>>> = {
  waiting: { openDoor: "doorOpen" },
  doorOpen: { board: "boarding" },
  boarding: { sit: "seated" },
  seated: { depart: "riding" },
  riding: { arrive: "arrived" },
  arrived: { alight: "alighted" },
  alighted: {},
};

export function transitionBus(state: BusTransitState, action: BusAction): BusTransitState {
  return BUS_TRANSITIONS[state][action] ?? state;
}

export function determineEnding(metrics: EndingMetrics): EndingId {
  if (metrics.returnRequested) return "return";
  if (metrics.elapsedSeconds > 8 * 60 || metrics.detourScore >= 5) return "detour";
  return "reunion";
}

export function checkpointForScene(scene: SceneId): Pick<GameSnapshotV2, "scene" | "objectiveId"> {
  const objectiveByScene: Record<SceneId, string> = {
    "bus-stop": "board-17",
    "bus-interior": "find-seat",
    "bus-ride": "ride-to-camoes",
    "old-city": "follow-old-city-path",
    ruins: "meet-lam",
  };
  return { scene, objectiveId: objectiveByScene[scene] };
}
