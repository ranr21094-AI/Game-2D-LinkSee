import type { BusTransitState, ColorMemoryPoint, CrossingDefinition, CrossingState, EndingId, EndingMetrics, GameSnapshotV5, ResumeStage, TilePoint } from "./types";
import type { TipEventPayload } from "./events";

export type BusAction = "openDoor" | "board" | "sit" | "depart" | "arrive" | "alight";

export const BELL_WINDOW_MS = 7000;
export const BELL_ANNOUNCEMENT_DELAY_MS = 1200;

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
  return BUS_TRANSITIONS[state]?.[action] ?? state;
}

export function busRideCheckpointAfterBell(state: BusTransitState): Pick<GameSnapshotV5, "busState" | "scene" | "objectiveId" | "resumeStage"> {
  return {
    busState: transitionBus(state, "depart"),
    scene: "bus-ride",
    objectiveId: "ride-to-camoes",
    resumeStage: "bus-ride",
  };
}

export function movementSpeedMultiplier(options: { onRoad: boolean; hasPath: boolean; onGuidedPath: boolean }): number {
  if (!options.hasPath || options.onGuidedPath) return 1;
  return 0.35;
}

export const BASE_WALK_SPEED = 68;

export function effectiveWalkSpeed(terrainMultiplier: number, boostMultiplier = 1): number {
  return BASE_WALK_SPEED * terrainMultiplier * boostMultiplier;
}

export function shouldStartWheelchairProcession(tip: TipEventPayload): boolean {
  return tip.source === "wheelchair" && tip.id === "wheelchair-pushing";
}

export type CrossingAction = "request" | "allow" | "finish";

const CROSSING_TRANSITIONS: Record<CrossingState, Partial<Record<CrossingAction, CrossingState>>> = {
  approach: { request: "requested" },
  requested: { allow: "walk" },
  walk: { finish: "crossed" },
  crossed: {},
};

export function transitionCrossing(state: CrossingState, action: CrossingAction): CrossingState {
  return CROSSING_TRANSITIONS[state]?.[action] ?? state;
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
  if (metrics.detourScore >= 5) return "detour";
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

const CHECKPOINTS: Record<ResumeStage, Pick<GameSnapshotV5, "scene" | "objectiveId" | "resumeStage"> & { point: TilePoint }> = {
  "bus-stop-entry": { scene: "bus-stop", objectiveId: "find-stop-sign", resumeStage: "bus-stop-entry", point: { x: 88, y: 268 } },
  "bus-stop-sign": { scene: "bus-stop", objectiveId: "board-17", resumeStage: "bus-stop-sign", point: { x: 232, y: 204 } },
  "bus-interior-entry": { scene: "bus-interior", objectiveId: "find-card-reader", resumeStage: "bus-interior-entry", point: { x: 536, y: 76 } },
  "bus-interior-seat": { scene: "bus-interior", objectiveId: "find-seat", resumeStage: "bus-interior-seat", point: { x: 392, y: 148 } },
  "bus-interior-bell": { scene: "bus-interior", objectiveId: "ring-bell", resumeStage: "bus-interior-bell", point: { x: 392, y: 148 } },
  "bus-ride": { scene: "bus-ride", objectiveId: "ride-to-camoes", resumeStage: "bus-ride", point: { x: 320, y: 180 } },
  "old-city-entry": { scene: "old-city", objectiveId: "request-crossing", resumeStage: "old-city-entry", point: { x: 40, y: 284 } },
  "old-city-wait": { scene: "old-city", objectiveId: "wait-crossing", resumeStage: "old-city-wait", point: { x: 40, y: 124 } },
  "old-city-go": { scene: "old-city", objectiveId: "cross-junction", resumeStage: "old-city-go", point: { x: 40, y: 124 } },
  "old-city-street": { scene: "old-city", objectiveId: "follow-street-south", resumeStage: "old-city-street", point: { x: 232, y: 124 } },
  "ruins-entry": { scene: "ruins", objectiveId: "meet-lam", resumeStage: "ruins-entry", point: { x: 328, y: 316 } },
  "ruins-procession": { scene: "ruins", objectiveId: "follow-wheelchair", resumeStage: "ruins-procession", point: { x: 328, y: 316 } },
};

/** Runtime guards for untrusted persisted data; a save with an unknown
 *  stage/state is rejected at load instead of crashing on a missing key. */
const STAGES = new Set<ResumeStage>(Object.keys(CHECKPOINTS) as ResumeStage[]);
const BUS_STATES = new Set<BusTransitState>(Object.keys(BUS_TRANSITIONS) as BusTransitState[]);

export function isKnownStage(stage: unknown): stage is ResumeStage {
  return typeof stage === "string" && (STAGES as Set<string>).has(stage);
}

export function isBusState(state: unknown): state is BusTransitState {
  return typeof state === "string" && (BUS_STATES as Set<string>).has(state);
}

export function checkpointForStage(stage: ResumeStage): Pick<GameSnapshotV5, "scene" | "objectiveId" | "resumeStage"> {
  // Degrade a bad stage to the very first checkpoint instead of throwing.
  const { point: _point, ...checkpoint } = CHECKPOINTS[stage] ?? CHECKPOINTS["bus-stop-entry"];
  return checkpoint;
}

export function resumePointForStage(stage: ResumeStage): TilePoint {
  const { point } = CHECKPOINTS[stage] ?? CHECKPOINTS["bus-stop-entry"];
  return { ...point };
}
