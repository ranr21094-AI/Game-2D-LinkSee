import { describe, expect, it } from "vitest";
import { endingChoiceCopy, JOURNEY_GOAL, MEMORY_DEFINITIONS, openingReplyEcho, OPENING_REPLIES } from "./journey";

describe("journey bookends", () => {
  it("keeps one explicit appointment goal and one opening reply", () => {
    expect(JOURNEY_GOAL).toContain("林伯");
    expect(JOURNEY_GOAL).toContain("大三巴");
    expect(OPENING_REPLIES.map((reply) => reply.id)).toEqual(["old-place"]);
    OPENING_REPLIES.forEach((reply) => expect(openingReplyEcho(reply.id).length).toBeGreaterThan(8));
  });

  it("gives every ending choice a successful action and quote", () => {
    ["photo", "listen-rain", "share-memories"].forEach((choice) => {
      const copy = endingChoiceCopy(choice as "photo" | "listen-rain" | "share-memories", 3);
      expect(copy.action).toBeTruthy();
      expect(copy.quote).toMatch(/^“/);
    });
  });

  it("defines a title and description for all three memories", () => {
    expect(Object.keys(MEMORY_DEFINITIONS)).toEqual(["old-city-bell", "egg-tart", "ruins-rain"]);
    Object.values(MEMORY_DEFINITIONS).forEach((memory) => {
      expect(memory.title.length).toBeGreaterThan(0);
      expect(memory.description.length).toBeGreaterThan(8);
    });
  });
});
