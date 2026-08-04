import type { BusTransitState, ColorMemoryPoint, CrossingDefinition, CrossingState, EndingId, EndingMetrics, GameSnapshotV3, ResumeStage, TilePoint } from "./types";

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

export const COLOR_MEMORY_LIMIT = 240;

export function mergeColorMemory(points: ColorMemoryPoint[], next: ColorMemoryPoint, minimumDistance = 18): ColorMemoryPoint[] {
  const existing = points.find((point) => point.scene === next.scene && Math.hypot(point.x - next.x, point.y - next.y) < minimumDistance);
  if (existing) return points;
  const merged = [...points, next];
  // Hard cap: drop the oldest discoveries first so per-frame cost and save size stay bounded.
  return merged.length > COLOR_MEMORY_LIMIT ? merged.slice(merged.length - COLOR_MEMORY_LIMIT) : merged;
}

const CHECKPOINTS: Record<ResumeStage, Pick<GameSnapshotV3, "scene" | "objectiveId" | "resumeStage"> & { point: TilePoint }> = {
  "bus-stop-entry": { scene: "bus-stop", objectiveId: "find-stop-sign", resumeStage: "bus-stop-entry", point: { x: 88, y: 268 } },
  "bus-stop-sign": { scene: "bus-stop", objectiveId: "board-17", resumeStage: "bus-stop-sign", point: { x: 232, y: 204 } },
  "bus-interior-entry": { scene: "bus-interior", objectiveId: "find-seat", resumeStage: "bus-interior-entry", point: { x: 536, y: 316 } },
  "bus-ride": { scene: "bus-ride", objectiveId: "ride-to-camoes", resumeStage: "bus-ride", point: { x: 320, y: 180 } },
  "old-city-entry": { scene: "old-city", objectiveId: "follow-old-city-path", resumeStage: "old-city-entry", point: { x: 328, y: 284 } },
  "old-city-rail": { scene: "old-city", objectiveId: "follow-handrail", resumeStage: "old-city-rail", point: { x: 408, y: 204 } },
  "crossing-approach": { scene: "old-city-crossing", objectiveId: "request-crossing", resumeStage: "crossing-approach", point: { x: 136, y: 316 } },
  "crossing-wait": { scene: "old-city-crossing", objectiveId: "wait-crossing", resumeStage: "crossing-wait", point: { x: 280, y: 284 } },
  "crossing-go": { scene: "old-city-crossing", objectiveId: "cross-junction", resumeStage: "crossing-go", point: { x: 280, y: 284 } },
  "ruins-entry": { scene: "ruins", objectiveId: "meet-lam", resumeStage: "ruins-entry", point: { x: 328, y: 284 } },
};

export function checkpointForStage(stage: ResumeStage): Pick<GameSnapshotV3, "scene" | "objectiveId" | "resumeStage"> {
  const { point: _point, ...checkpoint } = CHECKPOINTS[stage];
  return checkpoint;
}

export function resumePointForStage(stage: ResumeStage): TilePoint {
  return { ...CHECKPOINTS[stage].point };
}
