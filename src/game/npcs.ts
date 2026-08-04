import type { TilePoint } from "./types";

export type NpcDefinition = {
  id: string;
  scene: "old-city" | "old-city-crossing";
  x: number;
  y: number;
  tint: number;
  idleLabel: string;
  hint: (player: TilePoint, objectiveTarget: TilePoint) => string;
};

export const NPC_DEFINITIONS: NpcDefinition[] = [
  {
    id: "old-city-vendor",
    scene: "old-city",
    x: 285,
    y: 220,
    tint: 0x9e7661,
    idleLabel: "卖花的人",
    hint: () => "卖花的人说：扶手在右侧上坡，听见金属声就靠近一点。",
  },
  {
    id: "crossing-traveler",
    scene: "old-city-crossing",
    x: 146,
    y: 212,
    tint: 0x6d8794,
    idleLabel: "等候过街的人",
    hint: () => "等候的人说：路口的斑马线直直穿过去，到对岸再向右转；信号响起后再走。",
  },
];
