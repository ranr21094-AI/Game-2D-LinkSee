import type { TilePoint } from "./types";

export type NpcDefinition = {
  id: string;
  scene: "old-city";
  x: number;
  y: number;
  tint: number;
  /** Frame index in the shared npc-spritesheet. */
  frame: number;
  idleLabel: string;
  hint: (player: TilePoint, objectiveTarget: TilePoint) => string;
};

export const NPC_DEFINITIONS: NpcDefinition[] = [
  {
    id: "old-city-vendor",
    scene: "old-city",
    x: 280,
    y: 268,
    tint: 0x9e7661,
    frame: 0,
    idleLabel: "卖花的人",
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
    hint: () => "等候的人说：斑马线朝东直直穿过去，信号响起后再走，到对岸点阵就有盲道。",
  },
];
