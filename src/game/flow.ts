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

  const dx = definition.farCurb.x - definition.requestPoint.x;
  const dy = definition.farCurb.y - definition.requestPoint.y;
  const lengthSq = Math.max(1, dx * dx + dy * dy);
  const relativeX = position.x - definition.requestPoint.x;
  const relativeY = position.y - definition.requestPoint.y;
  const t = Math.max(0, Math.min(1, (relativeX * dx + relativeY * dy) / lengthSq));
  const center = { x: definition.requestPoint.x + dx * t, y: definition.requestPoint.y + dy * t };
  const offsetX = position.x - center.x;
  const offsetY = position.y - center.y;
  const distance = Math.hypot(offsetX, offsetY);
  const halfWidth = definition.corridorWidth / 2;
  if (distance <= halfWidth || distance === 0) return position;
  return { x: center.x + (offsetX / distance) * halfWidth, y: center.y + (offsetY / distance) * halfWidth };
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
    "bus-stop": "board-17",
    "bus-interior": "find-seat",
    "bus-ride": "ride-to-camoes",
    "old-city": "follow-old-city-path",
    "old-city-crossing": "request-crossing",
    ruins: "meet-lam",
  };
  return { scene, objectiveId: objectiveByScene[scene] };
}
