import type { CrossingDefinition, GuideRailDefinition, ObjectiveStep2D, RevealProfile, SceneId, TactilePathDefinition } from "./types";

export const REVEAL_PROFILE: RevealProfile = {
  tapForwardTiles: 1,
  tapBackTiles: 0,
  tapDurationMs: 180,
  hintTiles: 8,
  hintDurationMs: 3500,
  hintCooldownMs: 4500,
  color: 0xf6ca55,
};

export const TACTILE_LIT_MS = 2000;

export const ROUTE_BRIEFINGS: Record<"bus-stop" | "bus-interior", string> = {
  "bus-stop": "站牌信息：17路开往白鸽巢，站台右侧还有一块写着25的相似站牌，请用盲杖确认17这个凸字。",
  "bus-interior": "车厢信息：车门在身后，中央扶手向前延伸；左侧座位边缘有软垫和金属框，确认后按 E 坐下。",
};

export const BUS_STOP_SIGN = { x: 232, y: 204 } as const;
export const BUS_STOP_DECOY_SIGNS = [{ x: 392, y: 204, route: "25" }] as const;
export const BUS_SEAT_EDGE = { x: 344, y: 172 } as const;

export const SCENE_LABELS: Record<SceneId, string> = {
  "bus-stop": "關閘 · 17路候车区",
  "bus-interior": "17路 · 车厢",
  "bus-ride": "17路 · 前往白鸽巢",
  "old-city": "白鸽巢 · 新旧城交界",
  "old-city-crossing": "旧城 · 直行路口",
  ruins: "大三巴牌坊",
};

export const CHAPTER_NODES = [
  { scene: "bus-stop" as const, label: "關閘" },
  { scene: "bus-interior" as const, label: "17路" },
  { scene: "old-city" as const, label: "白鸽巢" },
  { scene: "old-city-crossing" as const, label: "旧城" },
  { scene: "ruins" as const, label: "大三巴" },
];

export const OBJECTIVES: Record<string, ObjectiveStep2D> = {
  "find-stop-sign": {
    id: "find-stop-sign",
    scene: "bus-stop",
    label: "触碰站牌，确认17路方向",
    target: BUS_STOP_SIGN,
    triggerRadius: 34,
    interaction: "approach",
    checkpoint: true,
  },
  "board-17": {
    id: "board-17",
    scene: "bus-stop",
    label: "沿四纹盲道前往17路车门",
    target: { x: 488, y: 284 },
    triggerRadius: 35,
    interaction: "interact",
    checkpoint: true,
  },
  "find-seat": {
    id: "find-seat",
    scene: "bus-interior",
    label: "沿车厢盲道寻找空座",
    target: BUS_SEAT_EDGE,
    triggerRadius: 34,
    interaction: "interact",
    checkpoint: true,
  },
  "ride-to-camoes": {
    id: "ride-to-camoes",
    scene: "bus-ride",
    label: "坐稳，下一站白鸽巢",
    target: { x: 0, y: 0 },
    triggerRadius: 0,
    interaction: "approach",
  },
  "follow-old-city-path": {
    id: "follow-old-city-path",
    scene: "old-city",
    label: "用盲杖判断凸纹，找到上坡扶手",
    target: { x: 408, y: 204 },
    triggerRadius: 34,
    interaction: "interact",
    checkpoint: true,
  },
  "follow-handrail": {
    id: "follow-handrail",
    scene: "old-city",
    label: "握住右侧扶手，沿扶手前进",
    target: { x: 408, y: 124 },
    triggerRadius: 24,
    interaction: "approach",
  },
  "request-crossing": {
    id: "request-crossing",
    scene: "old-city-crossing",
    label: "到点阵处按 E 请求通行",
    target: { x: 280, y: 284 },
    triggerRadius: 32,
    interaction: "interact",
    checkpoint: true,
  },
  "wait-crossing": {
    id: "wait-crossing",
    scene: "old-city-crossing",
    label: "留在路缘，等待可通行提示",
    target: { x: 280, y: 284 },
    triggerRadius: 32,
    interaction: "approach",
  },
  "cross-junction": {
    id: "cross-junction",
    scene: "old-city-crossing",
    label: "沿直线斑马线通过路口，再向右转",
    target: { x: 280, y: 108 },
    triggerRadius: 30,
    interaction: "approach",
  },
  "leave-crossing": {
    id: "leave-crossing",
    scene: "old-city-crossing",
    label: "抵达对岸后向右转，沿盲道离开路口",
    target: { x: 520, y: 108 },
    triggerRadius: 30,
    interaction: "approach",
  },
  "meet-lam": {
    id: "meet-lam",
    scene: "ruins",
    label: "循着台阶前的盲道，找到林伯",
    target: { x: 232, y: 108 },
    triggerRadius: 36,
    interaction: "interact",
    checkpoint: true,
  },
};

export const PATHS: Record<Exclude<SceneId, "bus-ride">, TactilePathDefinition> = {
  "bus-stop": {
    scene: "bus-stop",
    nodes: [
      { x: 88, y: 268, kind: "guidance" },
      { x: 232, y: 268, kind: "decision" },
      { x: 232, y: 204, kind: "decision", taskId: "find-stop-sign" },
      { x: 488, y: 204, kind: "guidance" },
      { x: 488, y: 284, kind: "decision", taskId: "board-17" },
    ],
  },
  "bus-interior": {
    scene: "bus-interior",
    nodes: [
      { x: 536, y: 316, kind: "guidance" },
      { x: 408, y: 316, kind: "decision" },
      { x: 408, y: 172, kind: "guidance" },
      { x: 344, y: 172, kind: "decision", taskId: "find-seat" },
    ],
  },
  "old-city": {
    scene: "old-city",
    nodes: [
      { x: 328, y: 284, kind: "guidance" },
      { x: 328, y: 204, kind: "decision" },
      { x: 408, y: 204, kind: "decision", taskId: "follow-old-city-path" },
      { x: 408, y: 124, kind: "decision", taskId: "follow-handrail", breakBefore: true },
    ],
  },
  "old-city-crossing": {
    scene: "old-city-crossing",
    nodes: [
      { x: 136, y: 316, kind: "guidance" },
      { x: 280, y: 316, kind: "guidance" },
      { x: 280, y: 284, kind: "decision", taskId: "request-crossing" },
      { x: 280, y: 108, kind: "decision", taskId: "cross-junction", breakBefore: true },
      { x: 520, y: 108, kind: "decision", taskId: "leave-crossing" },
    ],
  },
  ruins: {
    scene: "ruins",
    nodes: [
      { x: 328, y: 284, kind: "guidance" },
      { x: 328, y: 204, kind: "decision" },
      { x: 232, y: 204, kind: "guidance" },
      { x: 232, y: 108, kind: "decision", taskId: "meet-lam" },
    ],
  },
};

export const OLD_CITY_HANDRAIL: GuideRailDefinition = {
  id: "old-city-right-rail",
  scene: "old-city",
  start: { x: 408, y: 204 },
  end: { x: 408, y: 124 },
  engageRadius: 30,
  revealColor: 0xe1b85f,
};

export const OLD_CITY_CROSSING: CrossingDefinition = {
  scene: "old-city-crossing",
  requestPoint: { x: 280, y: 284 },
  farCurb: { x: 280, y: 108 },
  nearSideBoundary: { maxX: 320, minY: 280 },
  corridorWidth: 48,
  waitMs: 2500,
};

export const TUTORIAL_LINES = [
  "四条凸纹表示继续前进",
  "4×4凸点表示停下探测并改变方向",
  "Space 敲击单杖 · G照亮四周 · E互动 · Q方向提示 · H重复任务 · F辅助",
];

export function composeRepeatText(contact: string, task: string): string {
  return `最近触觉：${contact}。${task}`;
}
