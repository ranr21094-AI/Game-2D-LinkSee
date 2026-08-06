import { describe, expect, it } from "vitest";
import { isInsideVerticalInteractionZone, OLD_CITY_TILEMAP, PET_SHOP_INTERACTION_ZONE } from "./oldcity-map";
import { isWalkable } from "./tilemap";

describe("landmark interaction zones", () => {
  it("covers the full visible pet-shop frontage from the tactile corridor", () => {
    const frontagePoints = [
      { x: 536, y: 132 },
      { x: 536, y: 140 },
      { x: 536, y: 164 },
      { x: 536, y: 196 },
      { x: 552, y: 196 },
    ];

    frontagePoints.forEach((point) => {
      expect(isWalkable(OLD_CITY_TILEMAP, point), `${point.x},${point.y} should be walkable`).toBe(true);
      expect(isInsideVerticalInteractionZone(point, PET_SHOP_INTERACTION_ZONE)).toBe(true);
    });
  });

  it("does not overlap the preceding turn or the bank terminus", () => {
    expect(isInsideVerticalInteractionZone({ x: 536, y: 284 }, PET_SHOP_INTERACTION_ZONE)).toBe(false);
    expect(isInsideVerticalInteractionZone({ x: 536, y: 92 }, PET_SHOP_INTERACTION_ZONE)).toBe(false);
  });
});
