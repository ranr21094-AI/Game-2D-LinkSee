import type { SceneId, TilePoint } from "./types";

export type NpcDialogueOption = {
  id: string;
  label: string;
  response: string;
};

export type NpcDialogue = {
  npcId: string;
  speaker: string;
  prompt: string;
  options: NpcDialogueOption[];
};

export type NpcDialogueContext = {
  objectiveId: string;
  player: TilePoint;
  objectiveTarget: TilePoint;
  eggTartPurchased?: boolean;
};

export type NpcDefinition = {
  id: string;
  scene: Exclude<SceneId, "bus-ride">;
  x: number;
  y: number;
  tint: number;
  /** Frame index in the shared npc-spritesheet. */
  frame: number;
  visual?: "sheet" | "egg-tart";
  idleLabel: string;
  patrol?: { axis: "x" | "y"; distance: number; durationMs: number };
  dialogue: (context: NpcDialogueContext) => NpcDialogue;
  hint: (player: TilePoint, objectiveTarget: TilePoint) => string;
};

function vendorDialogue(context: NpcDialogueContext): NpcDialogue {
  const route = context.objectiveId === "follow-street-south"
    ? "卖花人说：先沿盲道向南走到商铺街口的点阵。"
    : context.objectiveId === "follow-street-east"
      ? "卖花人说：沿骑楼前的盲道向东，街尾点阵再向北转。"
      : context.objectiveId === "visit-pet-shop"
        ? "卖花人说：你已经转向北边，猫记宠物的竖招牌就在右手边。"
        : "卖花人说：继续沿北向盲道走，银号门前就是旧城街口。";
  return {
    npcId: "old-city-vendor",
    speaker: "卖花人",
    prompt: "花纸被雨点轻轻敲响。卖花人停下手里的活，等你开口。",
    options: [
      { id: "route", label: "请问前面的盲道怎么走？", response: route },
      { id: "sound", label: "附近有什么容易辨认的声音？", response: "卖花人说：南边饼家的风铃最清楚；如果脚下变成碎土，就走进短巷了。" },
      { id: "decline", label: "谢谢，我想先自己找找。", response: "卖花人说：好，慢慢来。花摊一直在这里，不着急。" },
    ],
  };
}

function crossingDialogue(context: NpcDialogueContext): NpcDialogue {
  const status = context.objectiveId === "wait-crossing"
    ? "等候的人说：现在还是红灯。留在点阵旁，听见连续双音再走。"
    : context.objectiveId === "cross-junction"
      ? "等候的人说：双音已经响了，斑马线向东直行，对岸点阵接着盲道。"
      : context.objectiveId.startsWith("follow-") || context.objectiveId === "visit-pet-shop" || context.objectiveId === "reach-terminus"
        ? "等候的人说：你已经安全过街了，右侧盲道向南进入商铺街。"
        : "等候的人说：请求点就在北面的 4×4 点阵，按 E 发出通行请求。";
  return {
    npcId: "crossing-traveler",
    speaker: "等候过街的人",
    prompt: "对方稍微侧过身，让出盲道中央的位置。",
    options: [
      { id: "status", label: "现在可以过街吗？", response: status },
      { id: "landmark", label: "对岸怎么确认？", response: "等候的人说：一直向东，杖头碰到对岸的点阵砖后，右侧会出现新的四纹盲道。" },
      { id: "decline", label: "谢谢，我会听信号自己判断。", response: "等候的人说：好，我不会拉你。双音响起时我再提醒一句。" },
    ],
  };
}

function eggTartDialogue(context: NpcDialogueContext): NpcDialogue {
  if (context.eggTartPurchased) {
    return {
      npcId: "egg-tart-vendor",
      speaker: "蛋挞摊主",
      prompt: "摊主认出你手里的纸袋，把刚出炉的烤盘往里收好。",
      options: [
        { id: "aftertaste", label: "蛋挞很好吃，谢谢。", response: "摊主笑着说：慢慢走，雨后石板还滑。" },
        { id: "landmark", label: "附近最好认的声音是什么？", response: "摊主说：向东是饼家风铃，向北转后能听见宠物店门铃。" },
        { id: "decline", label: "我继续赴约了。", response: "摊主说：好，替我向老朋友问声好。" },
      ],
    };
  }
  return {
    npcId: "egg-tart-vendor",
    speaker: "蛋挞摊主",
    prompt: "烤炉计时铃刚响。摊主打开纸袋，酥皮香气变得更清楚。",
    options: [
      { id: "buy", label: "买一个刚出炉的蛋挞。", response: "纸袋暖在掌心。蛋挞的余温让你的脚步轻快起来。" },
      { id: "sound", label: "请告诉我摊车和盲道的位置。", response: "摊主说：摊车在盲道北侧，我站在服务口后面；向东继续就是街尾点阵。" },
      { id: "decline", label: "谢谢，我先不买。", response: "摊主说：好。烤炉铃一直在这里，想回来再听它找我。" },
    ],
  };
}

function touristDialogue(): NpcDialogue {
  return {
    npcId: "lost-tourist",
    speaker: "迷路的游客",
    prompt: "游客听见你的盲杖，先问候，然后说自己找不到北面的宠物店。",
    options: [
      { id: "help-pet", label: "我刚确认过：沿街向东，街尾转北。", response: "游客说：谢谢你。我会留意北转点阵旁的门铃。" },
      { id: "help-sound", label: "先听饼家风铃，再找右侧门铃。", response: "游客说：原来声音也能把这条街说清楚，谢谢。" },
      { id: "decline", label: "我还在确认路线，请问旁边店家。", response: "游客说：明白，谢谢你把情况说清楚。" },
    ],
  };
}

export const NPC_DEFINITIONS: NpcDefinition[] = [
  {
    id: "old-city-vendor",
    scene: "old-city",
    x: 280,
    y: 268,
    tint: 0x9e7661,
    frame: 0,
    idleLabel: "卖花的人",
    patrol: { axis: "x", distance: 6, durationMs: 2200 },
    dialogue: vendorDialogue,
    hint: () => "卖花的人说：商铺街的盲道一直向东，到街尾的点阵再向北转，银号门前就是街口。",
  },
  {
    id: "crossing-traveler",
    scene: "old-city",
    x: 24,
    y: 188,
    tint: 0x6d8794,
    frame: 4,
    idleLabel: "等候过街的人",
    patrol: { axis: "y", distance: 4, durationMs: 1800 },
    dialogue: crossingDialogue,
    hint: () => "等候的人说：斑马线朝东直直穿过去，信号响起后再走，到对岸点阵就有盲道。",
  },
  {
    id: "egg-tart-vendor",
    scene: "old-city",
    x: 344,
    y: 252,
    tint: 0xd8a84f,
    frame: 0,
    visual: "egg-tart",
    idleLabel: "蛋挞摊主",
    dialogue: eggTartDialogue,
    hint: () => "蛋挞摊主说：摊车在盲道北侧，烤炉铃响的位置就是服务口。",
  },
  {
    id: "lost-tourist",
    scene: "old-city",
    x: 448,
    y: 268,
    tint: 0x8b765e,
    frame: 8,
    idleLabel: "迷路的游客",
    patrol: { axis: "x", distance: 4, durationMs: 2400 },
    dialogue: touristDialogue,
    hint: () => "游客说：你刚才讲的声音地标很清楚，我会自己沿街确认。",
  },
];
