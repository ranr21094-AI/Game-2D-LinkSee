import Phaser from "phaser";
import { clampChannel } from "./pixel";

export type WarmImagePixel = { r: number; g: number; b: number; a: number };

/** Convert a source pixel to the project's low-saturation warm-gray palette. */
export function toWarmGray(pixel: WarmImagePixel): WarmImagePixel {
  const luminance = pixel.r * 0.299 + pixel.g * 0.587 + pixel.b * 0.114;
  return {
    r: clampChannel(luminance * 0.94 + 15),
    g: clampChannel(luminance * 0.91 + 13),
    b: clampChannel(luminance * 0.82 + 10),
    a: pixel.a,
  };
}

/** Build a warm-gray canvas texture from an already loaded source texture. */
export function createWarmGrayTexture(scene: Phaser.Scene, sourceKey: string, targetKey: string): void {
  if (scene.textures.exists(targetKey)) return;
  const source = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const width = source.width;
  const height = source.height;
  if (!width || !height) return;
  const canvas = scene.textures.createCanvas(targetKey, width, height);
  if (!canvas) return;
  const context = canvas.getContext();
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, width, height);
  for (let index = 0; index < image.data.length; index += 4) {
    const next = toWarmGray({ r: image.data[index], g: image.data[index + 1], b: image.data[index + 2], a: image.data[index + 3] });
    image.data[index] = next.r;
    image.data[index + 1] = next.g;
    image.data[index + 2] = next.b;
    image.data[index + 3] = next.a;
  }
  context.putImageData(image, 0, 0);
  canvas.refresh();
}
