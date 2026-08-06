import { describe, expect, it } from "vitest";
import { NPC_DEFINITIONS } from "./npcs";

describe("direction NPCs", () => {
  it("keeps all helpers in the merged old-city scene with contextual hints", () => {
    expect(NPC_DEFINITIONS.map((npc) => npc.scene)).toEqual(["old-city", "old-city", "old-city", "old-city"]);
    expect(NPC_DEFINITIONS.map((npc) => npc.frame)).toEqual([0, 4, 0, 8]);
    NPC_DEFINITIONS.forEach((npc) => expect(npc.hint({ x: npc.x, y: npc.y }, { x: 1, y: 1 })).toContain("说"));
  });

  it("offers contextual choices without forcing help", () => {
    const vendor = NPC_DEFINITIONS.find((npc) => npc.id === "old-city-vendor")!;
    const dialogue = vendor.dialogue({ objectiveId: "follow-street-east", player: { x: vendor.x, y: vendor.y }, objectiveTarget: { x: 536, y: 284 } });
    expect(dialogue.options).toHaveLength(3);
    expect(dialogue.options.find((option) => option.id === "route")?.response).toContain("向东");
    expect(dialogue.options.find((option) => option.id === "decline")?.response).toContain("慢慢来");
  });

  it("changes the crossing answer with the live objective", () => {
    const traveler = NPC_DEFINITIONS.find((npc) => npc.id === "crossing-traveler")!;
    const waiting = traveler.dialogue({ objectiveId: "wait-crossing", player: { x: 24, y: 188 }, objectiveTarget: { x: 40, y: 124 } });
    const walking = traveler.dialogue({ objectiveId: "cross-junction", player: { x: 24, y: 188 }, objectiveTarget: { x: 200, y: 124 } });
    expect(waiting.options[0].response).toContain("红灯");
    expect(walking.options[0].response).toContain("双音已经响了");
  });

  it("supports buying once and lets the protagonist help a tourist", () => {
    const tart = NPC_DEFINITIONS.find((npc) => npc.id === "egg-tart-vendor")!;
    expect(tart.visual).toBe("egg-tart");
    expect(tart.dialogue({ objectiveId: "follow-street-east", player: tart, objectiveTarget: { x: 536, y: 284 }, eggTartPurchased: false }).options[0].id).toBe("buy");
    expect(tart.dialogue({ objectiveId: "follow-street-east", player: tart, objectiveTarget: { x: 536, y: 284 }, eggTartPurchased: true }).options.some((option) => option.id === "buy")).toBe(false);
    const tourist = NPC_DEFINITIONS.find((npc) => npc.id === "lost-tourist")!;
    expect(tourist.dialogue({ objectiveId: "follow-street-east", player: tourist, objectiveTarget: { x: 536, y: 284 } }).options[0].label).toContain("我刚确认过");
  });
});
