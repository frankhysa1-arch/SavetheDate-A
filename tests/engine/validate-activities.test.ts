import { describe, expect, it } from "vitest";
import { validateCatalog } from "@/lib/engine/validate-activities";
import { CATEGORIES } from "@/lib/types";
import type { Activity } from "@/lib/types";

/** A catalog that satisfies every minimum: 5 per category, 10 over limit, 1 free, 1 at limit. */
function goodCatalog(): Activity[] {
  const out: Activity[] = [];
  CATEGORIES.forEach((category, ci) => {
    for (let i = 0; i < 5; i++) {
      const n = ci * 5 + i;
      out.push({
        id: `${category}-venue-${i}`, name: `${category} venue ${i}`, category, tags: ["group-friendly"],
        indoor: category !== "outdoor" && n % 4 !== 0,
        pricePerPerson: n === 0 ? 0 : n === 1 ? 40 : n % 3 === 0 ? 55 : 15 + (n % 20),
        priceIsEstimate: n % 5 === 0,
        sourceUrl: `https://venue${n}.example.com/`,
      });
    }
  });
  return out;
}

const run = (c: unknown, provenance?: unknown) => validateCatalog(c, { limit: 40, provenance });

function provenanceFor(catalog: Activity[]) {
  return Object.fromEntries(
    catalog.map((a) => [a.id, {
      retrievedAt: "2026-10-28T12:00:00Z", finalUrl: a.sourceUrl, evidence: "Adult ticket $20",
      priceSource: a.priceIsEstimate ? "estimated" : "listed",
    }]),
  );
}

describe("validateCatalog", () => {
  it("accepts a catalog that meets every minimum", () => {
    const r = run(goodCatalog());
    expect(r.errors).toEqual([]);
    expect(r.stats.total).toBe(40);
    expect(r.stats.atLimit).toBeGreaterThanOrEqual(1);
  });

  it("rejects a non-array", () => {
    expect(run({}).errors).toContain("catalog must be a JSON array");
  });

  it("flags schema problems per item: http url, negative price, extra field, bad id", () => {
    const c = goodCatalog() as unknown as Record<string, unknown>[];
    c[0].sourceUrl = "http://insecure.example.com";
    c[1].pricePerPerson = -1;
    c[2].extra = "nope";
    c[3].id = "Bad Id";
    const errors = run(c).errors.join("\n");
    expect(errors).toMatch(/sourceUrl/);
    expect(errors).toMatch(/pricePerPerson/);
    expect(errors).toMatch(/extra|Unrecognized/i);
    expect(errors).toMatch(/slug/);
  });

  it("flags duplicate ids, urls and names", () => {
    const c = goodCatalog();
    c[1] = { ...c[1], id: c[0].id };
    c[2] = { ...c[2], sourceUrl: c[3].sourceUrl };
    c[4] = { ...c[4], name: c[5].name.toUpperCase() };
    const errors = run(c).errors.join("\n");
    expect(errors).toMatch(/duplicate id/);
    expect(errors).toMatch(/duplicate sourceUrl/);
    expect(errors).toMatch(/duplicate name/);
  });

  it("requires the id to start with its category", () => {
    const c = goodCatalog();
    c[0] = { ...c[0], id: "games-wrong-prefix" };
    expect(run(c).errors.join("\n")).toMatch(/must start with its category/);
  });

  it("requires coverage: total, per category, over limit, free, indoor/outdoor mix", () => {
    const small = goodCatalog().slice(0, 20);
    expect(run(small).errors.join("\n")).toMatch(/at least 40/);
    expect(run(small).errors.join("\n")).toMatch(/category wellness has 0/);

    const cheap = goodCatalog().map((a) => ({ ...a, pricePerPerson: 10 }));
    const cheapErrors = run(cheap).errors.join("\n");
    expect(cheapErrors).toMatch(/over the limit/);
    expect(cheapErrors).toMatch(/free/);

    const allIndoor = goodCatalog().map((a) => ({ ...a, indoor: true }));
    expect(run(allIndoor).errors.join("\n")).toMatch(/outdoor activities/);
  });

  it("warns, not errors, when nothing sits exactly at the limit or nothing is estimated", () => {
    const c = goodCatalog().map((a) => ({ ...a, pricePerPerson: a.pricePerPerson === 40 ? 41 : a.pricePerPerson, priceIsEstimate: false }));
    const r = run(c);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join("\n")).toMatch(/exactly at the limit/);
    expect(r.warnings.join("\n")).toMatch(/no estimated prices/);
  });

  it("warns when an outdoor-category item is marked indoor", () => {
    const c = goodCatalog();
    const i = c.findIndex((a) => a.category === "outdoor");
    c[i] = { ...c[i], indoor: true };
    expect(run(c).warnings.join("\n")).toMatch(/category outdoor but indoor is true/);
  });

  describe("provenance", () => {
    it("accepts a complete, consistent sidecar", () => {
      const c = goodCatalog();
      expect(run(c, provenanceFor(c)).errors).toEqual([]);
    });
    it("flags missing entries, orphan entries, estimate mismatch and host mismatch", () => {
      const c = goodCatalog();
      const p = provenanceFor(c) as Record<string, Record<string, unknown>>;
      delete p[c[0].id];
      p["dining-orphan"] = { retrievedAt: "2026-10-28T12:00:00Z", finalUrl: "https://x.example.com", evidence: "x", priceSource: "listed" };
      p[c[1].id].priceSource = c[1].priceIsEstimate ? "listed" : "estimated";
      p[c[2].id].finalUrl = "https://elsewhere.example.org/page";
      const errors = run(c, p).errors.join("\n");
      expect(errors).toMatch(new RegExp(`${c[0].id}: missing provenance`));
      expect(errors).toMatch(/dining-orphan: provenance entry has no matching/);
      expect(errors).toMatch(new RegExp(`${c[1].id}: priceIsEstimate`));
      expect(errors).toMatch(new RegExp(`${c[2].id}: provenance finalUrl host`));
    });
    it("rejects a malformed sidecar", () => {
      const c = goodCatalog();
      expect(run(c, { [c[0].id]: { retrievedAt: "yesterday" } }).errors.join("\n")).toMatch(/provenance/);
    });
  });
});
