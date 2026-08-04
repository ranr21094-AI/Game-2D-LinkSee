import { describe, expect, it } from "vitest";
import { toWarmGray } from "./warm-image";

describe("warm image conversion", () => {
  it("keeps alpha and removes strong hue while preserving luminance order", () => {
    const dark = toWarmGray({ r: 20, g: 30, b: 40, a: 128 });
    const light = toWarmGray({ r: 180, g: 190, b: 200, a: 255 });
    expect(dark.a).toBe(128);
    expect(light.a).toBe(255);
    expect(light.r).toBeGreaterThan(dark.r);
    expect(Math.abs(light.r - light.b)).toBeLessThan(45);
  });
});
