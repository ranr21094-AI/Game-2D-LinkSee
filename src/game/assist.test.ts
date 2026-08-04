import { describe, expect, it } from "vitest";
import { bearingLabel, describePhonePosition, PHONE_COOLDOWN_MS } from "./assist";
import { PATHS } from "./content";

describe("phone assistance", () => {
  it("labels eight compass directions without revealing a route", () => {
    expect(bearingLabel({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe("右方");
    expect(bearingLabel({ x: 0, y: 0 }, { x: -10, y: -10 })).toBe("左上方");
    expect(bearingLabel({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe("下方");
  });

  it("keeps the cooldown explicit and gives a concise scene-relative report", () => {
    expect(PHONE_COOLDOWN_MS).toBe(6000);
    expect(describePhonePosition("old-city", { x: 330, y: 330 }, PATHS["old-city"], { x: 395, y: 165 })).toContain("目标在");
    expect(describePhonePosition("old-city", { x: 330, y: 330 }, PATHS["old-city"], { x: 395, y: 165 })).not.toContain("路线:");
  });
});
