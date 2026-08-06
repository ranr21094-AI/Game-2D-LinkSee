import type { SceneId, SoundLandmarkId, TilePoint } from "./types";
import { BUS_CARD_READER } from "./businterior-map";

export type Facing = "up" | "down" | "left" | "right";

export type SoundLandmark = {
  id: SoundLandmarkId;
  scene: Exclude<SceneId, "bus-ride">;
  point: TilePoint;
  label: string;
  radius: number;
  tone: number;
};

export const SOUND_LANDMARKS: readonly SoundLandmark[] = [
  { id: "gate-rain", scene: "bus-stop", point: { x: 360, y: 188 }, label: "雨点敲击金属站棚", radius: 220, tone: 540 },
  { id: "route-17-engine", scene: "bus-stop", point: { x: 520, y: 284 }, label: "17路巴士低沉的引擎声", radius: 190, tone: 170 },
  { id: "bus-card-reader", scene: "bus-interior", point: BUS_CARD_READER, label: "刷卡机短促电子音", radius: 220, tone: 960 },
  { id: "bus-seat", scene: "bus-interior", point: { x: 392, y: 148 }, label: "空座旁衣料摩擦声", radius: 180, tone: 260 },
  { id: "bus-bell", scene: "bus-interior", point: { x: 392, y: 148 }, label: "下车铃确认音", radius: 180, tone: 820 },
  { id: "old-city-crossing", scene: "old-city", point: { x: 40, y: 124 }, label: "路口过街信号的双音", radius: 210, tone: 760 },
  { id: "flower-bell", scene: "old-city", point: { x: 280, y: 268 }, label: "花纸与店铺风铃轻响", radius: 170, tone: 650 },
  { id: "egg-tart-oven", scene: "old-city", point: { x: 344, y: 260 }, label: "蛋挞烤炉的计时铃", radius: 160, tone: 900 },
  { id: "pet-shop-bell", scene: "old-city", point: { x: 536, y: 140 }, label: "宠物店门铃", radius: 150, tone: 720 },
  { id: "ruins-wheelchair", scene: "ruins", point: { x: 328, y: 268 }, label: "林伯轮椅的轻响", radius: 220, tone: 310 },
  { id: "ruins-rain", scene: "ruins", point: { x: 328, y: 92 }, label: "雨水沿牌坊石墙落下", radius: 260, tone: 460 },
] as const;

const FACING_VECTOR: Record<Facing, TilePoint> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function relativeDirection(player: TilePoint, facing: Facing, target: TilePoint): "左侧" | "右侧" | "正前" | "身后" {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const forward = FACING_VECTOR[facing];
  const right = { x: -forward.y, y: forward.x };
  const forwardDot = dx * forward.x + dy * forward.y;
  const rightDot = dx * right.x + dy * right.y;
  if (Math.abs(rightDot) > Math.abs(forwardDot) * 0.72) return rightDot > 0 ? "右侧" : "左侧";
  return forwardDot >= 0 ? "正前" : "身后";
}

export function distanceBand(distance: number): "很近" | "稍远" | "远处" {
  if (distance <= 64) return "很近";
  if (distance <= 140) return "稍远";
  return "远处";
}

export function nearbySoundLandmarks(scene: Exclude<SceneId, "bus-ride">, player: TilePoint, facing: Facing, limit = 3): Array<SoundLandmark & { distance: number; direction: string }> {
  return SOUND_LANDMARKS
    .filter((landmark) => landmark.scene === scene)
    .map((landmark) => ({ ...landmark, distance: Math.round(Math.hypot(landmark.point.x - player.x, landmark.point.y - player.y)), direction: relativeDirection(player, facing, landmark.point) }))
    .filter((landmark) => landmark.distance <= landmark.radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

export function listeningReport(landmarks: ReturnType<typeof nearbySoundLandmarks>): string {
  if (!landmarks.length) return "你驻足聆听。附近只有雨声和自己的脚步，没有可辨认的声音。";
  return `你驻足聆听。${landmarks.map((landmark) => `${landmark.direction}${distanceBand(landmark.distance)}：${landmark.label}`).join("；")}。`;
}
