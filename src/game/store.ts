import { OBJECTIVES } from "./content";
import { checkpointForStage, isBusState, isKnownStage } from "./flow";
import type { BusRideLandmarkId, EndingId, GameSnapshotV5, KnownLandmarkId, MemoryId, OpeningReply, ResumeStage, RouteChoice, TipId } from "./types";

export const SAVE_KEY = "sound-road-macau-2d:v5";
const LEGACY_V4_SAVE_KEY = "sound-road-macau-2d:v4";
const OUTDATED_SAVE_KEYS = ["sound-road-macau-2d:v3", "sound-road-macau-2d:v2"];

const DEFAULT_SETTINGS: GameSnapshotV5["settings"] = {
  masterVolume: 0.72,
  ambientVolume: 0.58,
  effectsVolume: 0.8,
  dialogueVolume: 0.9,
  subtitleScale: 1,
  reducedMotion: false,
  gameMode: "experience",
};

export function createInitialSnapshot(): GameSnapshotV5 {
  return {
    version: 5,
    mobilityGuideSeen: false,
    unlockedTips: [],
    objectiveId: "find-stop-sign",
    scene: "bus-stop",
    resumeStage: "bus-stop-entry",
    busState: "waiting",
    selectedSeatId: null,
    memories: [],
    detourScore: 0,
    activeElapsedMs: 0,
    returnRequested: false,
    ending: null,
    colorMemory: [],
    openingReply: null,
    endingChoice: null,
    routeChoice: null,
    knownLandmarks: [],
    busRideRecognized: [],
    npcChoices: {},
    eggTartPurchased: false,
    eggTartBoostRemainingMs: 0,
    eggTartScentPrompted: false,
    settings: { ...DEFAULT_SETTINGS },
  };
}

let snapshot = createInitialSnapshot();
let activeStartedAt: number | null = null;

function persist(): GameSnapshotV5 {
  localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

function flushActiveElapsed(): void {
  if (activeStartedAt === null) return;
  const now = Date.now();
  snapshot = { ...snapshot, activeElapsedMs: snapshot.activeElapsedMs + Math.max(0, now - activeStartedAt) };
  activeStartedAt = now;
}

function normalizeBusInteriorResume(next: GameSnapshotV5): GameSnapshotV5 {
  if (next.scene !== "bus-interior") return next;
  // Coerce busState to what the flow gates expect, so a corrupt save
  // (e.g. busState "waiting") cannot soft-lock the card→seat→bell chain.
  if (next.objectiveId === "ring-bell" || ["seated", "riding", "arrived"].includes(next.busState)) {
    return { ...next, objectiveId: "ring-bell", resumeStage: "bus-interior-bell", busState: "seated" };
  }
  if (next.objectiveId === "find-seat" || next.resumeStage === "bus-interior-seat") {
    return { ...next, objectiveId: "find-seat", resumeStage: "bus-interior-seat", busState: "boarding" };
  }
  return { ...next, objectiveId: "find-card-reader", resumeStage: "bus-interior-entry", busState: "boarding" };
}

const OLD_CITY_RESUME_BY_OBJECTIVE: Record<string, GameSnapshotV5["resumeStage"]> = {
  "request-crossing": "old-city-entry",
  "wait-crossing": "old-city-wait",
  "cross-junction": "old-city-go",
  "follow-street-south": "old-city-street",
  "follow-shop-wall": "old-city-street",
  "follow-curb-edge": "old-city-street",
  "follow-street-east": "old-city-street",
  "visit-pet-shop": "old-city-street",
  "reach-terminus": "old-city-street",
};

function normalizeSceneResume(next: GameSnapshotV5): GameSnapshotV5 {
  const busNormalized = normalizeBusInteriorResume(next);
  if (busNormalized.scene === "old-city") {
    const resumeStage = OLD_CITY_RESUME_BY_OBJECTIVE[busNormalized.objectiveId];
    return resumeStage ? { ...busNormalized, resumeStage } : busNormalized;
  }
  if (busNormalized.scene === "bus-stop" && busNormalized.objectiveId === "board-17") {
    return { ...busNormalized, resumeStage: "bus-stop-sign" };
  }
  if (busNormalized.scene === "ruins" && busNormalized.objectiveId === "follow-wheelchair") {
    return { ...busNormalized, resumeStage: "ruins-procession" };
  }
  return busNormalized;
}

const OPENING_REPLIES: OpeningReply[] = ["old-place", "careful", "call-nearby"];
const ROUTE_CHOICES: RouteChoice[] = ["shop-wall", "curb-edge"];
const KNOWN_LANDMARKS: KnownLandmarkId[] = ["gate-rain", "route-17-engine", "bus-card-reader", "bus-seat", "bus-bell", "harbor-horn", "old-city-crossing", "flower-bell", "egg-tart-oven", "pet-shop-bell", "ruins-wheelchair", "ruins-rain"];
const BUS_RIDE_LANDMARKS: BusRideLandmarkId[] = ["elevated-rain", "harbor-horn", "bakery-bell"];

export function loadSnapshot(): GameSnapshotV5 | null {
  try {
    activeStartedAt = null;
    OUTDATED_SAVE_KEYS.forEach((key) => localStorage.removeItem(key));
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(LEGACY_V4_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Omit<Partial<GameSnapshotV5>, "version"> & { version?: number };
    if ((parsed.version !== 4 && parsed.version !== 5) || typeof parsed.scene !== "string" || !parsed.settings) return null;
    // Reject unknown enum values so a tampered/old-format save degrades to a
    // fresh start instead of crashing on a missing CHECKPOINTS/BUS_TRANSITIONS key.
    if (parsed.resumeStage !== undefined && !isKnownStage(parsed.resumeStage)) return null;
    if (parsed.busState !== undefined && !isBusState(parsed.busState)) return null;
    if (parsed.objectiveId !== undefined && !OBJECTIVES[parsed.objectiveId]) return null;
    snapshot = normalizeSceneResume({
      ...createInitialSnapshot(),
      ...parsed,
      version: 5,
      mobilityGuideSeen: Boolean(parsed.mobilityGuideSeen),
      unlockedTips: Array.isArray(parsed.unlockedTips) ? parsed.unlockedTips.filter((id): id is TipId => id === "sighted-guide" || id === "bus-access" || id === "bus-ride-access" || id === "wheelchair-pushing" || id === "guide-dog-access") : [],
      activeElapsedMs: Number.isFinite(parsed.activeElapsedMs) ? Math.max(0, parsed.activeElapsedMs ?? 0) : 0,
      colorMemory: Array.isArray(parsed.colorMemory) ? parsed.colorMemory : [],
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      openingReply: OPENING_REPLIES.includes(parsed.openingReply as OpeningReply) ? parsed.openingReply as OpeningReply : null,
      endingChoice: parsed.endingChoice === "photo" || parsed.endingChoice === "listen-rain" || parsed.endingChoice === "share-memories" ? parsed.endingChoice : null,
      routeChoice: ROUTE_CHOICES.includes(parsed.routeChoice as RouteChoice) ? parsed.routeChoice as RouteChoice : null,
      knownLandmarks: Array.isArray(parsed.knownLandmarks) ? parsed.knownLandmarks.filter((id): id is KnownLandmarkId => KNOWN_LANDMARKS.includes(id as KnownLandmarkId)) : [],
      busRideRecognized: Array.isArray(parsed.busRideRecognized) ? parsed.busRideRecognized.filter((id): id is BusRideLandmarkId => BUS_RIDE_LANDMARKS.includes(id as BusRideLandmarkId)) : [],
      npcChoices: parsed.npcChoices && typeof parsed.npcChoices === "object" ? parsed.npcChoices : {},
      eggTartPurchased: Boolean(parsed.eggTartPurchased),
      eggTartBoostRemainingMs: Number.isFinite(parsed.eggTartBoostRemainingMs) ? Math.max(0, Math.min(60_000, parsed.eggTartBoostRemainingMs ?? 0)) : 0,
      eggTartScentPrompted: Boolean(parsed.eggTartScentPrompted),
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    });
    const migrated = persist();
    localStorage.removeItem(LEGACY_V4_SAVE_KEY);
    return migrated;
  } catch {
    return null;
  }
}

export function getSnapshot(): GameSnapshotV5 {
  return snapshot;
}

export function getActiveElapsedMs(): number {
  return snapshot.activeElapsedMs + (activeStartedAt === null ? 0 : Math.max(0, Date.now() - activeStartedAt));
}

export function resumeActiveTimer(): void {
  if (activeStartedAt === null && !snapshot.ending) activeStartedAt = Date.now();
}

export function pauseActiveTimer(): void {
  if (activeStartedAt === null) return;
  flushActiveElapsed();
  activeStartedAt = null;
  persist();
}

export function setSnapshot(next: GameSnapshotV5): GameSnapshotV5 {
  flushActiveElapsed();
  snapshot = { ...next, activeElapsedMs: Math.max(next.activeElapsedMs, snapshot.activeElapsedMs) };
  return persist();
}

export function patchSnapshot(patch: Partial<GameSnapshotV5>): GameSnapshotV5 {
  flushActiveElapsed();
  snapshot = { ...snapshot, ...patch };
  return persist();
}

export function startNewGame(): GameSnapshotV5 {
  activeStartedAt = null;
  snapshot = { ...createInitialSnapshot(), settings: { ...snapshot.settings } };
  return persist();
}

export function setCheckpoint(stage: ResumeStage): GameSnapshotV5 {
  return patchSnapshot(checkpointForStage(stage));
}

export function collectMemory(id: MemoryId): GameSnapshotV5 {
  if (snapshot.memories.includes(id)) return snapshot;
  return patchSnapshot({ memories: [...snapshot.memories, id] });
}

export function unlockTip(id: TipId): GameSnapshotV5 {
  if (snapshot.unlockedTips.includes(id)) return snapshot;
  return patchSnapshot({ unlockedTips: [...snapshot.unlockedTips, id] });
}

export function discoverLandmark(id: KnownLandmarkId): GameSnapshotV5 {
  if (snapshot.knownLandmarks.includes(id)) return snapshot;
  return patchSnapshot({ knownLandmarks: [...snapshot.knownLandmarks, id] });
}

export function recordNpcChoice(npcId: string, optionId: string): GameSnapshotV5 {
  return patchSnapshot({ npcChoices: { ...snapshot.npcChoices, [npcId]: optionId } });
}

export function finishGame(ending: EndingId): GameSnapshotV5 {
  pauseActiveTimer();
  return patchSnapshot({ ending });
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(LEGACY_V4_SAVE_KEY);
  OUTDATED_SAVE_KEYS.forEach((key) => localStorage.removeItem(key));
  activeStartedAt = null;
  snapshot = createInitialSnapshot();
}
