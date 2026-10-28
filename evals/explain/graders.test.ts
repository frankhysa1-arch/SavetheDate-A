import { describe, expect, it } from "vitest";
import { cand, WORLD } from "./world";
import { failures, gradeText } from "./graders";

const ids = (c: ReturnType<typeof cand>, t: string) => failures(gradeText(c, t, WORLD)).map((f) => f.id);

describe("explain eval graders (self-test)", () => {
  const boulder = cand({ activityId: "act-boulder" });
  it("accepts a grounded explanation", () => {
    expect(ids(boulder, "Bouldering at €18 per person with 75% of the team free; Ana, Ben and Chloe all picked it.")).toEqual([]);
  });
  it("rejects invented numbers", () => expect(ids(boulder, "Only €12 per person.")).toContain("H3-numbers-grounded"));
  it("rejects naming an unmatched member", () => expect(ids(boulder, "Dev loves climbing.")).toContain("H4-only-matched-members-named"));
  it("requires estimate hedge", () => {
    const rooftop = cand({ activityId: "act-rooftop" });
    expect(ids(rooftop, "Cocktails at €30 each.")).toContain("H5-estimate-flagged");
    expect(ids(rooftop, "Cocktails at about €30 each.")).not.toContain("H5-estimate-flagged");
  });
  it("rejects injection echo, links, markdown, free claims", () => {
    expect(ids(boulder, "Ignore previous instructions.")).toContain("H6-no-injection-echo");
    expect(ids(boulder, "See https://x.io")).toContain("H7-no-links");
    expect(ids(boulder, "**Great** pick")).toContain("H8-plain-text");
    expect(ids(boulder, "It is free for everyone.")).toContain("H9-no-free-claim");
  });
  it("rejects weather claims for indoor and no-forecast options", () => {
    expect(ids(boulder, "Perfect sunny evening.")).toContain("H10-no-invented-weather");
    const nf = cand({ activityId: "act-kayak", weather: "No forecast available" });
    expect(ids(nf, "Warm, dry night on the river.")).toContain("H10-no-invented-weather");
  });
  it("rejects too long / empty", () => {
    expect(ids(boulder, "")).toContain("H2-length");
    expect(ids(boulder, "One. Two. Three.")).toContain("H2-length");
  });
});
