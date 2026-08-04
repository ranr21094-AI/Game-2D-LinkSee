export type Rgb = [number, number, number];

/** deterministic LCG so procedural textures stay stable frame to frame */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function jitter(rand: () => number, color: Rgb, amount: number): string {
  const delta = Math.floor(rand() * (amount * 2 + 1)) - amount;
  return `rgb(${clampChannel(color[0] + delta)},${clampChannel(color[1] + delta)},${clampChannel(color[2] + delta)})`;
}

export function rgb(color: Rgb): string {
  return `rgb(${color[0]},${color[1]},${color[2]})`;
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    clampChannel(a[0] + (b[0] - a[0]) * t),
    clampChannel(a[1] + (b[1] - a[1]) * t),
    clampChannel(a[2] + (b[2] - a[2]) * t),
  ];
}
