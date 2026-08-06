import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAVE_KEY, getActiveElapsedMs, getSnapshot, loadSnapshot, patchSnapshot, pauseActiveTimer, resumeActiveTimer, setCheckpoint, startNewGame, unlockTip } from "./store";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("V4 game snapshot", () => {
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

  it("keeps the chosen game mode and volume settings across a new game", () => {
    patchSnapshot({ settings: { ...getSnapshot().settings, gameMode: "night" }, mobilityGuideSeen: true });
    startNewGame();
    expect(getSnapshot().settings.gameMode).toBe("night");
    expect(getSnapshot()).toMatchObject({ scene: "bus-stop", objectiveId: "find-stop-sign", mobilityGuideSeen: false });
  });

  it("persists completion of the manual sighted-guide introduction", () => {
    patchSnapshot({ mobilityGuideSeen: true });
    expect(loadSnapshot()).toMatchObject({ mobilityGuideSeen: true, resumeStage: "bus-stop-entry" });
  });

  it("persists unlocked sighted-guide tips without duplicating them", () => {
    expect(getSnapshot().unlockedTips).toEqual([]);
    unlockTip("sighted-guide");
    unlockTip("sighted-guide");
    expect(getSnapshot().unlockedTips).toEqual(["sighted-guide"]);
    expect(loadSnapshot()?.unlockedTips).toEqual(["sighted-guide"]);
  });

  it("persists the bus accessibility tip without duplicating it", () => {
    unlockTip("bus-access");
    unlockTip("bus-access");
    expect(getSnapshot().unlockedTips).toEqual(["bus-access"]);
    expect(loadSnapshot()?.unlockedTips).toEqual(["bus-access"]);
  });

  it("persists the bus interior tip without duplicating it", () => {
    unlockTip("bus-ride-access");
    unlockTip("bus-ride-access");
    expect(getSnapshot().unlockedTips).toEqual(["bus-ride-access"]);
    expect(loadSnapshot()?.unlockedTips).toEqual(["bus-ride-access"]);
  });

  it("persists the wheelchair pushing tip without duplicating it", () => {
    unlockTip("wheelchair-pushing");
    unlockTip("wheelchair-pushing");
    expect(getSnapshot().unlockedTips).toEqual(["wheelchair-pushing"]);
    expect(loadSnapshot()?.unlockedTips).toEqual(["wheelchair-pushing"]);
  });

  it("persists the guide dog tip without duplicating it", () => {
    unlockTip("guide-dog-access");
    unlockTip("guide-dog-access");
    expect(getSnapshot().unlockedTips).toEqual(["guide-dog-access"]);
    expect(loadSnapshot()?.unlockedTips).toEqual(["guide-dog-access"]);
  });

  it("filters unknown V4 tips while retaining wheelchair guidance", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...getSnapshot(), unlockedTips: ["wheelchair-pushing", "unknown-tip"] }));
    expect(loadSnapshot()?.unlockedTips).toEqual(["wheelchair-pushing"]);
  });

  it("discards outdated saves so the merged old-city starts fresh", () => {
    localStorage.clear();
    localStorage.setItem("sound-road-macau-2d:v3", JSON.stringify({ version: 3, scene: "old-city-crossing", settings: {} }));
    expect(loadSnapshot()).toBeNull();
    expect(localStorage.getItem("sound-road-macau-2d:v3")).toBeNull();
  });

  it("rejects snapshots with a mismatched version", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...getSnapshot(), version: 3 }));
    expect(loadSnapshot()).toBeNull();
  });

  it("rejects a save with an unknown resumeStage instead of crashing", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...getSnapshot(), resumeStage: "bogus-stage" }));
    expect(loadSnapshot()).toBeNull();
  });

  it("rejects a save with an unknown busState instead of crashing", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...getSnapshot(), busState: "bogus-state" }));
    expect(loadSnapshot()).toBeNull();
  });

  it("rejects a save with an unknown objectiveId", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...getSnapshot(), objectiveId: "bogus-objective" }));
    expect(loadSnapshot()).toBeNull();
  });

  it("normalizes a bus-interior save so the card→seat→bell flow cannot soft-lock", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...getSnapshot(), scene: "bus-interior", busState: "waiting", objectiveId: "find-card-reader", resumeStage: "bus-interior-entry" }));
    expect(loadSnapshot()).toMatchObject({ scene: "bus-interior", busState: "boarding", objectiveId: "find-card-reader", resumeStage: "bus-interior-entry" });
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...getSnapshot(), scene: "bus-interior", busState: "waiting", objectiveId: "find-seat", resumeStage: "bus-interior-seat" }));
    expect(loadSnapshot()).toMatchObject({ scene: "bus-interior", busState: "boarding", objectiveId: "find-seat", resumeStage: "bus-interior-seat" });
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...getSnapshot(), scene: "bus-interior", busState: "waiting", objectiveId: "ring-bell", resumeStage: "bus-interior-bell" }));
    expect(loadSnapshot()).toMatchObject({ scene: "bus-interior", busState: "seated", objectiveId: "ring-bell", resumeStage: "bus-interior-bell" });
  });
});
