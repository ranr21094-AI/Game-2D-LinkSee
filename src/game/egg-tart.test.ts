import { describe, expect, it } from "vitest";
import { EGG_TART_BOOST_MS, EGG_TART_BOOST_MULTIPLIER, EGG_TART_SCENT_TILES, eggTartBoostFactor, isInsideEggTartScentZone } from "./egg-tart";

describe("egg tart stall rules", () => {
  it("uses a six by three explicit scent zone", () => {
    expect(EGG_TART_SCENT_TILES).toHaveLength(18);
    expect(isInsideEggTartScentZone(EGG_TART_SCENT_TILES[0])).toBe(true);
    expect(isInsideEggTartScentZone({ x: 40, y: 40 })).toBe(false);
  });

  it("grants exactly one minute at 1.60x", () => {
    expect(EGG_TART_BOOST_MS).toBe(60_000);
    expect(EGG_TART_BOOST_MULTIPLIER).toBe(1.6);
    expect(eggTartBoostFactor(1)).toBe(1.6);
    expect(eggTartBoostFactor(0)).toBe(1);
  });
});
