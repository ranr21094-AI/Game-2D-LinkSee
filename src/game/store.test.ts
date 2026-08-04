import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEGACY_SAVE_KEY, SAVE_KEY, getActiveElapsedMs, getSnapshot, loadSnapshot, pauseActiveTimer, resumeActiveTimer, setCheckpoint, startNewGame } from "./store";
import type { GameSnapshotV2 } from "./types";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("V3 game snapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-04T10:00:00Z"));
    vi.stubGlobal("localStorage", new MemoryStorage());
    startNewGame();
  });

  it("counts only active play and excludes pause or offline time", () => {
    resumeActiveTimer();
    vi.advanceTimersByTime(1200);
    pauseActiveTimer();
    vi.advanceTimersByTime(86_400_000);
    expect(getActiveElapsedMs()).toBe(1200);
  });

  it("restores an explicit safe stage without resetting its objective", () => {
    setCheckpoint("bus-stop-sign");
    expect(getSnapshot()).toMatchObject({ scene: "bus-stop", objectiveId: "board-17", resumeStage: "bus-stop-sign" });
  });

  it("migrates V2 story state while discarding its broken wall-clock timer", () => {
    const legacy: GameSnapshotV2 = {
      version: 2, objectiveId: "follow-handrail", scene: "old-city", busState: "alighted", selectedSeatId: "seat-a2", memories: ["bus-rain"], detourScore: 2,
      startedAt: 1, elapsedBeforeResume: 9999, returnRequested: false, ending: null, colorMemory: [],
      settings: { masterVolume: 0.5, effectsVolume: 0.7, dialogueVolume: 0.8, subtitleScale: 1.2, reducedMotion: true },
    };
    localStorage.clear();
    localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify(legacy));
    const migrated = loadSnapshot();
    expect(migrated).toMatchObject({ version: 3, scene: "old-city", objectiveId: "follow-handrail", resumeStage: "old-city-rail", activeElapsedMs: 0 });
    expect(migrated?.settings.ambientVolume).toBeGreaterThan(0);
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
    expect(localStorage.getItem(LEGACY_SAVE_KEY)).toBeNull();
  });
});
