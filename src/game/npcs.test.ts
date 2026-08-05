import { describe, expect, it } from "vitest";
import { NPC_DEFINITIONS } from "./npcs";

describe("direction NPCs", () => {
  it("keeps both helpers in the merged old-city scene with contextual hints", () => {
    expect(NPC_DEFINITIONS.map((npc) => npc.scene)).toEqual(["old-city", "old-city"]);
    expect(NPC_DEFINITIONS.map((npc) => npc.frame)).toEqual([0, 4]);
    NPC_DEFINITIONS.forEach((npc) => expect(npc.hint({ x: npc.x, y: npc.y }, { x: 1, y: 1 })).toContain("说"));
  });
});
