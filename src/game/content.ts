import busAccessibilityTipUrl from "../assets/bus-accessibility-tip-pixel.png";
import busRideAccessTipUrl from "../assets/bus-ride-access-tip-pixel.png";
import guideDogTipUrl from "../assets/guide-dog-tip-pixel.png";
import sightedGuideTutorialUrl from "../assets/sighted-guide-tutorial-pixel.png";
import wheelchairPushingTipUrl from "../assets/wheelchair-pushing-tip-pixel.png";
import { BUS_BELL, BUS_CARD_READER, BUS_SEAT_EDGE } from "./businterior-map";
import type { CrossingDefinition, ObjectiveStep2D, RevealProfile, SceneId, TactilePathDefinition, TipDefinition, TipId } from "./types";

export const REVEAL_PROFILE: RevealProfile = {
  tapForwardTiles: 1,
  tapBackTiles: 0,
  tapDurationMs: 180,
  hintTiles: 8,
  hintDurationMs: 2000,
  hintCooldownMs: 4500,
  color: 0xf6ca55,
};

export const TACTILE_LIT_MS = 2000;

export const TIP_DEFINITIONS: Record<TipId, TipDefinition> = {
  "sighted-guide": {
    id: "sighted-guide",
    title: "扶盲方法",
    heading: "让盲人握住你的手臂",
    summary: "先征求同意，再让盲人主动握住你的肘部，并把你看到的路况说清楚。",
    image: sightedGuideTutorialUrl,
    imageAlt: "暖灰像素插图：工作人员先征求同意，盲人主动握住引导者肘部，随后在引导者侧后方半步随行",
    steps: [
      { title: "先询问", body: "从正面接近，说清身份和要提供的帮助，得到同意后再接触。" },
      { title: "递手臂", body: "轻触手背或把手臂靠近，让盲人主动握住你的肘部；引导者领先半步。" },
      { title: "说清路况", body: "把你看到的告诉盲人：方向、台阶、路缘、窄处、障碍物和即将发生的转向。" },
    ],
    callout: "关键：把你看到的告诉盲人，不替对方做决定。",
  },
  "bus-access": {
    id: "bus-access",
    title: "帮助盲人乘车",
    heading: "看见盲人等车，可以这样帮忙",
    summary: "盲人可能无法确认驶来的线路、车辆是否进站和车门位置，一次主动询问，可能帮他赶上想坐的车。",
    image: busAccessibilityTipUrl,
    imageAlt: "暖灰雨夜像素插图：持盲杖的乘客在公交站等待，一名公众主动靠近询问，公交车停在旁边",
    steps: [
      { title: "主动询问", body: "先自我介绍，询问是否需要确认线路或协助，不要突然拉住或推着走。" },
      { title: "说清车辆", body: "说明线路、车辆进站方向和车门位置；不确定时先向司机或工作人员确认。" },
      { title: "征得同意再协助", body: "得到同意后陪到车门或递出手臂，并说明台阶、路缘和周围人流。" },
    ],
    callout: "先问、说清楚、再陪同，不替对方做决定。",
  },
  "bus-ride-access": {
    id: "bus-ride-access",
    title: "公交无障碍",
    heading: "让公交更容易被找到",
    summary: "刷卡机和下车按钮位置各异，可能让盲人在车内反复摸索，也可能错过下车站点。",
    image: busRideAccessTipUrl,
    imageAlt: "暖灰雨夜像素插图：盲人乘客在公交车内寻找刷卡机或按铃，一名公众先询问再说明位置并准备协助",
    steps: [
      { title: "统一位置与触感", body: "固定刷卡机和按铃的高度、位置，并提供明显的触觉与声音提示。" },
      { title: "让信息顺手可用", body: "在一户通等常用 App 中集成乘车码与到站提醒，让刷卡与提醒成为顺手操作。" },
      { title: "报站时说清楚", body: "说明车门、按铃位置和下车方向；公众或工作人员协助前先征得同意。" },
    ],
    callout: "无障碍不是让乘客记住每辆车的不同，而是让每辆车都更容易被理解。",
  },
  "wheelchair-pushing": {
    id: "wheelchair-pushing",
    title: "轮椅推行需要学习",
    heading: "会推轮椅，不只是向前用力",
    summary: "公众缺少正确推行手动轮椅的教育，突然转向、失控加速或错误上下坡可能让乘客陷入危险。",
    image: wheelchairPushingTipUrl,
    imageAlt: "暖灰雨夜像素插图：三格画面——先确认双手放扶手、双脚在脚踏板；沿坡道向上推行时身体前倾；下坡时背对坡道倒退行进并控制刹车",
    steps: [
      { title: "先问再检查", body: "征求乘客同意，确认双手放在扶手上、双脚稳在脚踏板上、衣物远离车轮；移动前先说明。" },
      { title: "平地前进", body: "握住推行把手，正直、平稳推进；不得突然加速、紧急刹车或突然转弯。" },
      { title: "上坡", body: "面向前进方向，身体稍前倾，双手握紧把手控制轮椅重量；踏稳每一步，缓慢平稳上坡。" },
      { title: "下坡", body: "将轮椅背对坡道，向后倒退行进；推行者回头观察确认路线安全；全程控制刹车与速度，随时准备停车。" },
      { title: "上下台阶", body: "到台阶前先停稳；上台阶时双手下压把手、单脚踩倾斜杆翘起前轮，缓慢推上；下台阶先掉转方向倒退下行，照护者先下台阶，再控制后轮沿台阶缓慢落下。" },
    ],
    callout: "先提示、再检查，平地稳推不急转；上坡缓慢向前，下坡倒退并控制刹车；遇到台阶先停稳，再按规范操作。",
  },
  "guide-dog-access": {
    id: "guide-dog-access",
    title: "导盲犬在澳门",
    heading: "在澳门，导盲犬仍是「宠物」",
    summary: "澳门法律尚未承认导盲犬的工作犬身份，视障者想带导盲犬出行，面对的是制度的空白。",
    image: guideDogTipUrl,
    imageAlt: "暖灰雨夜像素插图：持盲杖的视障者与导盲犬被挡在门外，中段是层层检疫隔离文件，右侧导盲机器人停在楼梯前无法上行",
    steps: [
      { title: "法律未承认", body: "导盲犬无法以工作犬身份入境，只能以「宠物狗」名义申请，检疫、隔离流程复杂漫长。" },
      { title: "购买困难", body: "没有正式的引进渠道，个案往往需要议员协助推动，视障者难以独立完成。" },
      { title: "电子导盲犬", body: "政府倾向发展导盲机器人：成本低、无需医疗照护，但面对楼梯等复杂地形仍无能为力。" },
    ],
    callout: "机器人可以补位，但补不齐制度的空白。",
  },
};

export const ROUTE_BRIEFINGS: Record<"bus-stop" | "bus-interior", string> = {
  "bus-stop": "站牌信息：17路开往白鸽巢，沿途还有一块写着25的相似站牌，请用盲杖确认17这个凸字。",
  "bus-interior": "车厢信息：上车后先摸索刷卡机，刷卡完成再找座位；白鸽巢报站后，记得在七秒内寻找按铃。",
};

export const SCENE_LABELS: Record<SceneId, string> = {
  "bus-stop": "關閘 · 17路候车区",
  "bus-interior": "17路 · 车厢",
  "old-city": "白鸽巢 · 旧城街市",
  ruins: "大三巴牌坊",
};

export const OBJECTIVES: Record<string, ObjectiveStep2D> = {
  "find-stop-sign": {
    id: "find-stop-sign",
    scene: "bus-stop",
    label: "触碰站牌，确认17路方向",
    target: { x: 488, y: 252 },
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
  "find-card-reader": {
    id: "find-card-reader",
    scene: "bus-interior",
    label: "用盲杖摸索刷卡机，确认后按 E 刷卡",
    target: BUS_CARD_READER,
    triggerRadius: 30,
    interaction: "interact",
    checkpoint: true,
  },
  "find-seat": {
    id: "find-seat",
    scene: "bus-interior",
    label: "在车厢内自由摸索座位",
    target: BUS_SEAT_EDGE,
    triggerRadius: 34,
    interaction: "interact",
    checkpoint: true,
  },
  "ring-bell": {
    id: "ring-bell",
    scene: "bus-interior",
    label: "白鸽巢报站后找到按铃并按 E",
    target: BUS_BELL,
    triggerRadius: 30,
    interaction: "interact",
    checkpoint: true,
  },
  "request-crossing": {
    id: "request-crossing",
    scene: "old-city",
    label: "沿盲道向北到路缘点阵，按 E 请求通行",
    target: { x: 40, y: 124 },
    triggerRadius: 34,
    interaction: "interact",
    checkpoint: true,
  },
  "wait-crossing": {
    id: "wait-crossing",
    scene: "old-city",
    label: "留在路缘，等待可通行提示",
    target: { x: 40, y: 124 },
    triggerRadius: 34,
    interaction: "approach",
  },
  "cross-junction": {
    id: "cross-junction",
    scene: "old-city",
    label: "沿斑马线向东直行，抵达对岸路缘",
    target: { x: 200, y: 124 },
    triggerRadius: 30,
    interaction: "approach",
  },
  "follow-street-south": {
    id: "follow-street-south",
    scene: "old-city",
    label: "沿盲道向南，走到商铺街口的点阵",
    target: { x: 232, y: 284 },
    triggerRadius: 30,
    interaction: "approach",
    checkpoint: true,
  },
  "follow-street-east": {
    id: "follow-street-east",
    scene: "old-city",
    label: "沿商铺街盲道向东，找到北转点阵",
    target: { x: 536, y: 284 },
    triggerRadius: 30,
    interaction: "approach",
  },
  "follow-shop-wall": {
    id: "follow-shop-wall",
    scene: "old-city",
    label: "沿店铺墙面前进，听风铃确认街段",
    target: { x: 392, y: 268 },
    triggerRadius: 30,
    interaction: "approach",
  },
  "follow-curb-edge": {
    id: "follow-curb-edge",
    scene: "old-city",
    label: "沿路缘慢行，听排水声确认街段",
    target: { x: 408, y: 284 },
    triggerRadius: 30,
    interaction: "approach",
  },
  "visit-pet-shop": {
    id: "visit-pet-shop",
    scene: "old-city",
    label: "在猫记宠物门前停下，按 E 了解导盲犬的处境",
    target: { x: 536, y: 140 },
    triggerRadius: 32,
    interaction: "interact",
  },
  "reach-terminus": {
    id: "reach-terminus",
    scene: "old-city",
    label: "沿盲道北上，银号门前就是街口终点",
    target: { x: 536, y: 92 },
    triggerRadius: 30,
    interaction: "approach",
  },
  "meet-lam": {
    id: "meet-lam",
    scene: "ruins",
    label: "沿路边坡道找到轮椅上的林伯",
    target: { x: 328, y: 268 },
    triggerRadius: 38,
    interaction: "interact",
    checkpoint: true,
  },
  "follow-wheelchair": {
    id: "follow-wheelchair",
    scene: "ruins",
    label: "紧随林伯和女儿沿中央坡道上行",
    target: { x: 328, y: 108 },
    triggerRadius: 0,
    interaction: "approach",
  },
};

export const PATHS: Record<Exclude<SceneId, "bus-ride" | "bus-interior">, TactilePathDefinition> = {
  "bus-stop": {
    scene: "bus-stop",
    nodes: [
      { x: 88, y: 268, kind: "guidance" },
      { x: 232, y: 268, kind: "decision" },
      { x: 232, y: 204, kind: "decision" },
      { x: 488, y: 204, kind: "guidance" },
      { x: 488, y: 252, kind: "decision", taskId: "find-stop-sign" },
      { x: 488, y: 284, kind: "decision", taskId: "board-17" },
    ],
  },
  "old-city": {
    scene: "old-city",
    nodes: [
      { x: 40, y: 284, kind: "guidance" },
      { x: 40, y: 124, kind: "decision", taskId: "request-crossing" },
      { x: 200, y: 124, kind: "decision", taskId: "cross-junction", breakBefore: true },
      { x: 232, y: 124, kind: "decision" },
      { x: 232, y: 284, kind: "decision", taskId: "follow-street-south" },
      { x: 536, y: 284, kind: "decision", taskId: "follow-street-east" },
      { x: 536, y: 140, kind: "decision", taskId: "visit-pet-shop" },
      { x: 536, y: 92, kind: "decision", taskId: "reach-terminus" },
    ],
  },
  ruins: {
    scene: "ruins",
    nodes: [
      { x: 328, y: 316, kind: "guidance" },
      { x: 328, y: 268, kind: "decision", taskId: "meet-lam" },
      { x: 328, y: 204, kind: "guidance" },
      { x: 328, y: 108, kind: "decision", taskId: "follow-wheelchair" },
    ],
  },
};

export const OLD_CITY_CROSSING: CrossingDefinition = {
  scene: "old-city",
  requestPoint: { x: 40, y: 124 },
  farCurb: { x: 200, y: 124 },
  nearSideBoundary: { maxX: 56, minY: 40 },
  corridorWidth: 48,
  waitMs: 2500,
};

export const TUTORIAL_LINES = [
  "四条凸纹表示继续前进",
  "4×4凸点表示停下探测并改变方向",
  "Space 敲击单杖 · R驻足聆听 · G照亮四周 · E互动 · Q方向提示 · H重复任务",
];

export function composeRepeatText(contact: string, task: string, journeyGoal: string): string {
  return `最近触觉：${contact}。${task}。${journeyGoal}`;
}
