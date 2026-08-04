import type { BusTransitState, ColorMemoryPoint, CrossingDefinition, CrossingState, EndingId, EndingMetrics, GameSnapshotV2, SceneId, TilePoint } from "./types";

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

export type CrossingAction = "request" | "allow" | "finish";

const CROSSING_TRANSITIONS: Record<CrossingState, Partial<Record<CrossingAction, CrossingState>>> = {
  approach: { request: "requested" },
  requested: { allow: "walk" },
  walk: { finish: "crossed" },
  crossed: {},
};

export function transitionCrossing(state: CrossingState, action: CrossingAction): CrossingState {
  return CROSSING_TRANSITIONS[state][action] ?? state;
}

export function constrainCrossingPosition(state: CrossingState, position: TilePoint, definition: CrossingDefinition): TilePoint {
  if (state === "approach" || state === "requested") {
    return {
      x: Math.min(position.x, definition.nearSideBoundary.maxX),
      y: Math.max(position.y, definition.nearSideBoundary.minY),
    };
  }
  if (state !== "walk") return position;

  const halfWidth = definition.corridorWidth / 2;
  const dx = definition.farCurb.x - definition.requestPoint.x;
  const dy = definition.farCurb.y - definition.requestPoint.y;
  const startX = Math.min(definition.requestPoint.x, definition.farCurb.x);
  const endX = Math.max(definition.requestPoint.x, definition.farCurb.x);
  const startY = Math.min(definition.requestPoint.y, definition.farCurb.y);
  const endY = Math.max(definition.requestPoint.y, definition.farCurb.y);

  // Keep the crossing orthogonal: the player stays inside one straight
  // vertical or horizontal corridor and is never projected onto a diagonal.
  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: Math.max(startX, Math.min(endX, position.x)),
      y: Math.max(definition.requestPoint.y - halfWidth, Math.min(definition.requestPoint.y + halfWidth, position.y)),
    };
  }
  return {
    x: Math.max(definition.requestPoint.x - halfWidth, Math.min(definition.requestPoint.x + halfWidth, position.x)),
    y: Math.max(startY, Math.min(endY, position.y)),
  };
}

export function determineEnding(metrics: EndingMetrics): EndingId {
  if (metrics.returnRequested) return "return";
  if (metrics.elapsedSeconds > 8 * 60 || metrics.detourScore >= 5) return "detour";
  return "reunion";
}

export function mergeColorMemory(points: ColorMemoryPoint[], next: ColorMemoryPoint, minimumDistance = 18): ColorMemoryPoint[] {
  const existing = points.find((point) => point.scene === next.scene && Math.hypot(point.x - next.x, point.y - next.y) < minimumDistance);
  if (existing) return points;
  return [...points, next];
}

export function checkpointForScene(scene: SceneId): Pick<GameSnapshotV2, "scene" | "objectiveId"> {
  const objectiveByScene: Record<SceneId, string> = {
    "bus-stop": "find-stop-sign",
    "bus-interior": "find-seat",
    "bus-ride": "ride-to-camoes",
    "old-city": "follow-old-city-path",
    "old-city-crossing": "request-crossing",
    ruins: "meet-lam",
  };
  return { scene, objectiveId: objectiveByScene[scene] };
}
