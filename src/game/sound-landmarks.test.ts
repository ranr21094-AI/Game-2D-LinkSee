import { describe, expect, it } from "vitest";
import { BUS_CARD_READER } from "./businterior-map";
import { listeningReport, nearbySoundLandmarks, relativeDirection, SOUND_LANDMARKS } from "./sound-landmarks";

describe("active listening landmarks", () => {
  it("provides at least two real landmarks in every walking scene", () => {
    ["bus-stop", "bus-interior", "old-city", "ruins"].forEach((scene) => {
      expect(SOUND_LANDMARKS.filter((landmark) => landmark.scene === scene).length).toBeGreaterThanOrEqual(2);
    });
  });

  it("describes directions relative to player facing", () => {
    expect(relativeDirection({ x: 0, y: 0 }, "up", { x: 0, y: -20 })).toBe("正前");
    expect(relativeDirection({ x: 0, y: 0 }, "up", { x: 20, y: 0 })).toBe("右侧");
    expect(relativeDirection({ x: 0, y: 0 }, "right", { x: 20, y: 0 })).toBe("正前");
  });

  it("filters by scene and radius and produces a readable report", () => {
    const nearby = nearbySoundLandmarks("bus-stop", { x: 360, y: 188 }, "right");
    expect(nearby.length).toBeGreaterThanOrEqual(1);
    expect(nearby.every((landmark) => landmark.scene === "bus-stop")).toBe(true);
    expect(listeningReport(nearby)).toContain("驻足聆听");
  });

  it("anchors the card-reader sound to the physical card reader", () => {
    const readerSound = SOUND_LANDMARKS.find((landmark) => landmark.id === "bus-card-reader");
    expect(readerSound?.point).toEqual(BUS_CARD_READER);
    expect(nearbySoundLandmarks("bus-interior", BUS_CARD_READER, "up").map((landmark) => landmark.id)).toContain("bus-card-reader");
  });
});
