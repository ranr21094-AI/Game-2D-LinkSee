import type { ObjectiveStep2D, RevealProfile, SceneId, TactilePathDefinition } from "./types";

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
    label: "沿盲道穿过旧城，点阵处停下转向",
    target: { x: 236, y: 112 },
    triggerRadius: 34,
    interaction: "interact",
    checkpoint: true,
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
      { x: 236, y: 112, kind: "decision", taskId: "follow-old-city-path" },
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

export const TUTORIAL_LINES = [
  "四条凸纹表示继续前进",
  "4×4凸点表示停下探测并改变方向",
  "空格敲击 · Shift横扫 · Q提示 · E互动",
];
