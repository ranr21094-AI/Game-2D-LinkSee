import type { EndingId, GameSnapshotV2, MemoryId, SceneId } from "./types";
import { checkpointForScene } from "./flow";

export const SAVE_KEY = "sound-road-macau-2d:v1";

export function createInitialSnapshot(): GameSnapshotV2 {
  return {
    version: 1,
    objectiveId: "board-17",
    scene: "bus-stop",
    busState: "waiting",
    selectedSeatId: null,
    memories: [],
    detourScore: 0,
    startedAt: Date.now(),
    elapsedBeforeResume: 0,
    returnRequested: false,
    ending: null,
    colorMemory: [],
    settings: {
      masterVolume: 0.72,
      effectsVolume: 0.8,
      dialogueVolume: 0.9,
      subtitleScale: 1,
      reducedMotion: false,
    },
  };
}

let snapshot = createInitialSnapshot();

export function loadSnapshot(): GameSnapshotV2 | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameSnapshotV2>;
    if (parsed.version !== 1 || typeof parsed.scene !== "string" || !parsed.settings) return null;
    snapshot = {
      ...createInitialSnapshot(),
      ...parsed,
      colorMemory: Array.isArray(parsed.colorMemory) ? parsed.colorMemory : [],
      settings: { ...createInitialSnapshot().settings, ...parsed.settings },
    };
    return snapshot;
  } catch {
    return null;
  }
}

export function getSnapshot(): GameSnapshotV2 {
  return snapshot;
}

export function setSnapshot(next: GameSnapshotV2): GameSnapshotV2 {
  snapshot = next;
  localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function patchSnapshot(patch: Partial<GameSnapshotV2>): GameSnapshotV2 {
  return setSnapshot({ ...snapshot, ...patch });
}

export function startNewGame(): GameSnapshotV2 {
  snapshot = createInitialSnapshot();
  return setSnapshot(snapshot);
}

export function setCheckpoint(scene: SceneId): GameSnapshotV2 {
  return patchSnapshot(checkpointForScene(scene));
}

export function collectMemory(id: MemoryId): GameSnapshotV2 {
  if (snapshot.memories.includes(id)) return snapshot;
  return patchSnapshot({ memories: [...snapshot.memories, id] });
}

export function finishGame(ending: EndingId): GameSnapshotV2 {
  return patchSnapshot({ ending });
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
  snapshot = createInitialSnapshot();
}
