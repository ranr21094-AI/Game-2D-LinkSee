import type { CrossingDefinition, GuideRailDefinition, ObjectiveStep2D, RevealProfile, SceneId, TactilePathDefinition } from "./types";

export const REVEAL_PROFILE: RevealProfile = {
  tapForwardTiles: 4,
  tapBackTiles: 1,
  tapDurationMs: 3000,
  sweepTiles: 5,
  sweepDurationMs: 2500,
  hintTiles: 8,
  hintDurationMs: 3500,
  hintCooldownMs: 4500,
  color: 0xf6ca55,
};

export const SCENE_LABELS: Record<SceneId, string> = {
  "bus-stop": "關閘 · 17路候车区",
  "bus-interior": "17路 · 车厢",
  "bus-ride": "17路 · 前往白鸽巢",
  "old-city": "白鸽巢 · 澳门旧城",
  "old-city-crossing": "旧城 · 斜向路口",
  ruins: "大三巴牌坊",
};

export const OBJECTIVES: Record<string, ObjectiveStep2D> = {
  "board-17": {
    id: "board-17",
    scene: "bus-stop",
    label: "沿四纹盲道前往17路车门",
    target: { x: 532, y: 188 },
    triggerRadius: 35,
    interaction: "interact",
    checkpoint: true,
  },
  "find-seat": {
    id: "find-seat",
    scene: "bus-interior",
    label: "沿车厢盲道寻找空座",
    target: { x: 350, y: 164 },
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
    label: "沿盲道前往窄巷扶手起点",
    target: { x: 318, y: 138 },
    triggerRadius: 34,
    interaction: "interact",
    checkpoint: true,
  },
  "follow-handrail": {
    id: "follow-handrail",
    scene: "old-city",
    label: "握住右侧扶手，沿扶手前进",
    target: { x: 246, y: 100 },
    triggerRadius: 24,
    interaction: "approach",
  },
  "request-crossing": {
    id: "request-crossing",
    scene: "old-city-crossing",
    label: "到点阵处按 E 请求通行",
    target: { x: 278, y: 288 },
    triggerRadius: 32,
    interaction: "interact",
    checkpoint: true,
  },
  "wait-crossing": {
    id: "wait-crossing",
    scene: "old-city-crossing",
    label: "留在路缘，等待可通行提示",
    target: { x: 278, y: 288 },
    triggerRadius: 32,
    interaction: "approach",
  },
  "cross-junction": {
    id: "cross-junction",
    scene: "old-city-crossing",
    label: "沿斜向右前方斑马线通过路口",
    target: { x: 430, y: 80 },
    triggerRadius: 30,
    interaction: "approach",
  },
  "meet-lam": {
    id: "meet-lam",
    scene: "ruins",
    label: "循着台阶前的盲道，找到林伯",
    target: { x: 240, y: 88 },
    triggerRadius: 36,
    interaction: "interact",
    checkpoint: true,
  },
};

export const PATHS: Record<Exclude<SceneId, "bus-ride">, TactilePathDefinition> = {
  "bus-stop": {
    scene: "bus-stop",
    nodes: [
      { x: 96, y: 318, kind: "guidance" },
      { x: 250, y: 318, kind: "decision" },
      { x: 250, y: 244, kind: "guidance" },
      { x: 448, y: 244, kind: "decision" },
      { x: 532, y: 188, kind: "decision", taskId: "board-17" },
    ],
  },
  "bus-interior": {
    scene: "bus-interior",
    nodes: [
      { x: 530, y: 314, kind: "decision" },
      { x: 470, y: 274, kind: "guidance" },
      { x: 390, y: 274, kind: "decision" },
      { x: 390, y: 205, kind: "guidance" },
      { x: 350, y: 164, kind: "decision", taskId: "find-seat" },
    ],
  },
  "old-city": {
    scene: "old-city",
    nodes: [
      { x: 326, y: 320, kind: "guidance" },
      { x: 326, y: 266, kind: "decision" },
      { x: 445, y: 266, kind: "decision", taskId: "old-city-bell" },
      { x: 445, y: 188, kind: "guidance" },
      { x: 360, y: 188, kind: "decision" },
      { x: 360, y: 138, kind: "guidance" },
      { x: 318, y: 138, kind: "decision", taskId: "follow-old-city-path" },
      { x: 246, y: 100, kind: "decision", taskId: "follow-handrail", breakBefore: true },
    ],
  },
  "old-city-crossing": {
    scene: "old-city-crossing",
    nodes: [
      { x: 180, y: 326, kind: "guidance" },
      { x: 278, y: 288, kind: "decision", taskId: "request-crossing" },
      { x: 430, y: 80, kind: "decision", taskId: "cross-junction", breakBefore: true },
      { x: 520, y: 56, kind: "guidance" },
    ],
  },
  ruins: {
    scene: "ruins",
    nodes: [
      { x: 326, y: 290, kind: "guidance" },
      { x: 326, y: 186, kind: "decision" },
      { x: 260, y: 150, kind: "guidance" },
      { x: 240, y: 88, kind: "decision", taskId: "meet-lam" },
    ],
  },
};

export const OLD_CITY_HANDRAIL: GuideRailDefinition = {
  id: "old-city-right-rail",
  scene: "old-city",
  start: { x: 318, y: 138 },
  end: { x: 246, y: 100 },
  engageRadius: 30,
  revealColor: 0xe1b85f,
};

export const OLD_CITY_CROSSING: CrossingDefinition = {
  scene: "old-city-crossing",
  requestPoint: { x: 278, y: 288 },
  farCurb: { x: 430, y: 80 },
  nearSideBoundary: { maxX: 340, minY: 258 },
  corridorWidth: 48,
  waitMs: 2500,
};

export const TUTORIAL_LINES = [
  "四条凸纹表示继续前进",
  "4×4凸点表示停下探测并改变方向",
  "空格敲击 · Shift横扫 · Q提示 · E互动",
];
