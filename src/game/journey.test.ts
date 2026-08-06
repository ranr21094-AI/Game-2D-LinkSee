import { describe, expect, it } from "vitest";
import { endingChoiceCopy, JOURNEY_GOAL, LANDMARK_NOTES, openingReplyEcho, OPENING_REPLIES } from "./journey";

describe("journey bookends", () => {
  it("keeps one explicit appointment goal and three non-punitive replies", () => {
    expect(JOURNEY_GOAL).toContain("林伯");
    expect(JOURNEY_GOAL).toContain("大三巴");
    expect(OPENING_REPLIES.map((reply) => reply.id)).toEqual(["old-place", "careful", "call-nearby"]);
    OPENING_REPLIES.forEach((reply) => expect(openingReplyEcho(reply.id).length).toBeGreaterThan(8));
  });

  it("gives every ending choice a successful action and quote", () => {
    ["photo", "listen-rain", "share-memories"].forEach((choice) => {
      const copy = endingChoiceCopy(choice as "photo" | "listen-rain" | "share-memories", 3);
      expect(copy.action).toBeTruthy();
      expect(copy.quote).toMatch(/^“/);
    });
  });

  it("defines a concise note for every discovered landmark", () => {
    expect(Object.keys(LANDMARK_NOTES)).toHaveLength(12);
    Object.values(LANDMARK_NOTES).forEach((note) => expect(note.length).toBeGreaterThan(10));
  });
});
