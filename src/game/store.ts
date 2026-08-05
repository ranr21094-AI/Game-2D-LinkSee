import type { EndingId, GameSnapshotV4, MemoryId, ResumeStage, TipId } from "./types";
import { checkpointForStage } from "./flow";

export const SAVE_KEY = "sound-road-macau-2d:v4";
const OUTDATED_SAVE_KEYS = ["sound-road-macau-2d:v3", "sound-road-macau-2d:v2"];

const DEFAULT_SETTINGS: GameSnapshotV4["settings"] = {
  masterVolume: 0.72,
  ambientVolume: 0.58,
  effectsVolume: 0.8,
  dialogueVolume: 0.9,
  subtitleScale: 1,
  reducedMotion: false,
  gameMode: "experience",
};

export function createInitialSnapshot(): GameSnapshotV4 {
  return {
    version: 4,
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
    settings: { ...DEFAULT_SETTINGS },
  };
}

let snapshot = createInitialSnapshot();
let activeStartedAt: number | null = null;

function persist(): GameSnapshotV4 {
  localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

function flushActiveElapsed(): void {
  if (activeStartedAt === null) return;
  const now = Date.now();
  snapshot = { ...snapshot, activeElapsedMs: snapshot.activeElapsedMs + Math.max(0, now - activeStartedAt) };
  activeStartedAt = now;
}

function normalizeBusInteriorResume(next: GameSnapshotV4): GameSnapshotV4 {
  if (next.scene !== "bus-interior") return next;
  if (next.objectiveId === "ride-to-camoes" || next.objectiveId === "ring-bell" || ["seated", "riding", "arrived"].includes(next.busState)) {
    return { ...next, objectiveId: "ring-bell", resumeStage: "bus-interior-bell" };
  }
  if (next.objectiveId === "find-seat" || next.resumeStage === "bus-interior-seat") {
    return { ...next, objectiveId: "find-seat", resumeStage: "bus-interior-seat" };
  }
  return { ...next, objectiveId: "find-card-reader", resumeStage: "bus-interior-entry" };
}

export function loadSnapshot(): GameSnapshotV4 | null {
  try {
    activeStartedAt = null;
    OUTDATED_SAVE_KEYS.forEach((key) => localStorage.removeItem(key));
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameSnapshotV4>;
    if (parsed.version !== 4 || typeof parsed.scene !== "string" || !parsed.settings) return null;
    snapshot = normalizeBusInteriorResume({
      ...createInitialSnapshot(),
      ...parsed,
      version: 4,
      mobilityGuideSeen: Boolean(parsed.mobilityGuideSeen),
      unlockedTips: Array.isArray(parsed.unlockedTips) ? parsed.unlockedTips.filter((id): id is TipId => id === "sighted-guide" || id === "bus-access" || id === "bus-ride-access" || id === "wheelchair-pushing" || id === "guide-dog-access") : [],
      activeElapsedMs: Number.isFinite(parsed.activeElapsedMs) ? Math.max(0, parsed.activeElapsedMs ?? 0) : 0,
      colorMemory: Array.isArray(parsed.colorMemory) ? parsed.colorMemory : [],
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    });
    return persist();
  } catch {
    return null;
  }
}

export function getSnapshot(): GameSnapshotV4 {
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

export function setSnapshot(next: GameSnapshotV4): GameSnapshotV4 {
  flushActiveElapsed();
  snapshot = { ...next, activeElapsedMs: Math.max(next.activeElapsedMs, snapshot.activeElapsedMs) };
  return persist();
}

export function patchSnapshot(patch: Partial<GameSnapshotV4>): GameSnapshotV4 {
  flushActiveElapsed();
  snapshot = { ...snapshot, ...patch };
  return persist();
}

export function startNewGame(): GameSnapshotV4 {
  activeStartedAt = null;
  snapshot = { ...createInitialSnapshot(), settings: { ...snapshot.settings } };
  return persist();
}

export function setCheckpoint(stage: ResumeStage): GameSnapshotV4 {
  return patchSnapshot(checkpointForStage(stage));
}

export function collectMemory(id: MemoryId): GameSnapshotV4 {
  if (snapshot.memories.includes(id)) return snapshot;
  return patchSnapshot({ memories: [...snapshot.memories, id] });
}

export function unlockTip(id: TipId): GameSnapshotV4 {
  if (snapshot.unlockedTips.includes(id)) return snapshot;
  return patchSnapshot({ unlockedTips: [...snapshot.unlockedTips, id] });
}

export function finishGame(ending: EndingId): GameSnapshotV4 {
  pauseActiveTimer();
  return patchSnapshot({ ending });
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
  OUTDATED_SAVE_KEYS.forEach((key) => localStorage.removeItem(key));
  activeStartedAt = null;
  snapshot = createInitialSnapshot();
}
