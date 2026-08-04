import { describe, expect, it } from "vitest";
import { NPC_DEFINITIONS } from "./npcs";

describe("direction NPCs", () => {
  it("provides one old-city and one crossing helper with contextual hints", () => {
    expect(NPC_DEFINITIONS.map((npc) => npc.scene)).toEqual(["old-city", "old-city-crossing"]);
    NPC_DEFINITIONS.forEach((npc) => expect(npc.hint({ x: npc.x, y: npc.y }, { x: 1, y: 1 })).toContain("说"));
  });
});
