import type { EndingId, GameSnapshotV2, GameSnapshotV3, MemoryId, ResumeStage, TipId } from "./types";
import { checkpointForStage } from "./flow";

export const SAVE_KEY = "sound-road-macau-2d:v3";
export const LEGACY_SAVE_KEY = "sound-road-macau-2d:v2";

const DEFAULT_SETTINGS: GameSnapshotV3["settings"] = {
  masterVolume: 0.72,
  ambientVolume: 0.58,
  effectsVolume: 0.8,
  dialogueVolume: 0.9,
  subtitleScale: 1,
  reducedMotion: false,
  gameMode: "experience",
};

export function createInitialSnapshot(): GameSnapshotV3 {
  return {
    version: 3,
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

function persist(): GameSnapshotV3 {
  localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

function flushActiveElapsed(): void {
  if (activeStartedAt === null) return;
  const now = Date.now();
  snapshot = { ...snapshot, activeElapsedMs: snapshot.activeElapsedMs + Math.max(0, now - activeStartedAt) };
  activeStartedAt = now;
}

function migrateV2(legacy: GameSnapshotV2): GameSnapshotV3 {
  const stageByScene: Record<GameSnapshotV2["scene"], ResumeStage> = {
    "bus-stop": legacy.objectiveId === "board-17" ? "bus-stop-sign" : "bus-stop-entry",
    "bus-interior": "bus-interior-entry",
    "bus-ride": "bus-ride",
    "old-city": legacy.objectiveId === "follow-handrail" ? "old-city-rail" : "old-city-entry",
    "old-city-crossing": legacy.objectiveId === "cross-junction" ? "crossing-go" : legacy.objectiveId === "wait-crossing" ? "crossing-wait" : "crossing-approach",
    ruins: "ruins-entry",
  };
  return {
    ...createInitialSnapshot(),
    mobilityGuideSeen: false,
    unlockedTips: [],
    objectiveId: legacy.objectiveId,
    scene: legacy.scene,
    resumeStage: stageByScene[legacy.scene],
    busState: legacy.busState,
    selectedSeatId: legacy.selectedSeatId,
    memories: Array.isArray(legacy.memories) ? legacy.memories : [],
    detourScore: Number.isFinite(legacy.detourScore) ? legacy.detourScore : 0,
    activeElapsedMs: 0,
    returnRequested: Boolean(legacy.returnRequested),
    ending: legacy.ending ?? null,
    colorMemory: Array.isArray(legacy.colorMemory) ? legacy.colorMemory : [],
    settings: { ...DEFAULT_SETTINGS, ...legacy.settings },
  };
}

export function loadSnapshot(): GameSnapshotV3 | null {
  try {
    activeStartedAt = null;
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GameSnapshotV3>;
      if (parsed.version !== 3 || typeof parsed.scene !== "string" || !parsed.settings) return null;
      snapshot = {
        ...createInitialSnapshot(),
        ...parsed,
        version: 3,
        mobilityGuideSeen: Boolean(parsed.mobilityGuideSeen),
        unlockedTips: Array.isArray(parsed.unlockedTips) ? parsed.unlockedTips.filter((id): id is TipId => id === "sighted-guide" || id === "bus-access") : [],
        activeElapsedMs: Number.isFinite(parsed.activeElapsedMs) ? Math.max(0, parsed.activeElapsedMs ?? 0) : 0,
        colorMemory: Array.isArray(parsed.colorMemory) ? parsed.colorMemory : [],
        memories: Array.isArray(parsed.memories) ? parsed.memories : [],
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      };
      return snapshot;
    }
    const legacyRaw = localStorage.getItem(LEGACY_SAVE_KEY);
    if (!legacyRaw) return null;
    const legacy = JSON.parse(legacyRaw) as GameSnapshotV2;
    if (legacy.version !== 2 || typeof legacy.scene !== "string") return null;
    snapshot = migrateV2(legacy);
    localStorage.removeItem(LEGACY_SAVE_KEY);
    return persist();
  } catch {
    return null;
  }
}

export function getSnapshot(): GameSnapshotV3 {
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

export function setSnapshot(next: GameSnapshotV3): GameSnapshotV3 {
  flushActiveElapsed();
  snapshot = { ...next, activeElapsedMs: Math.max(next.activeElapsedMs, snapshot.activeElapsedMs) };
  return persist();
}

export function patchSnapshot(patch: Partial<GameSnapshotV3>): GameSnapshotV3 {
  flushActiveElapsed();
  snapshot = { ...snapshot, ...patch };
  return persist();
}

export function startNewGame(): GameSnapshotV3 {
  activeStartedAt = null;
  snapshot = { ...createInitialSnapshot(), settings: { ...snapshot.settings } };
  return persist();
}

export function setCheckpoint(stage: ResumeStage): GameSnapshotV3 {
  return patchSnapshot(checkpointForStage(stage));
}

export function collectMemory(id: MemoryId): GameSnapshotV3 {
  if (snapshot.memories.includes(id)) return snapshot;
  return patchSnapshot({ memories: [...snapshot.memories, id] });
}

export function unlockTip(id: TipId): GameSnapshotV3 {
  if (snapshot.unlockedTips.includes(id)) return snapshot;
  return patchSnapshot({ unlockedTips: [...snapshot.unlockedTips, id] });
}

export function finishGame(ending: EndingId): GameSnapshotV3 {
  pauseActiveTimer();
  return patchSnapshot({ ending });
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(LEGACY_SAVE_KEY);
  activeStartedAt = null;
  snapshot = createInitialSnapshot();
}
