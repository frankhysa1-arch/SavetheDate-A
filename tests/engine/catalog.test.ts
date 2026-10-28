// Gate for the committed catalog. Skipped until `data/activities.json` exists, so
// the suite stays green before the research skill has been run. Engine tests never
// read this file (they use tests/engine/fixtures.ts), so regenerating it cannot break them.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateCatalog } from "@/lib/engine/validate-activities";

const root = new URL("../../data/", import.meta.url);
const catalogPath = new URL("activities.json", root);
const provenancePath = new URL("activities.provenance.json", root);
const read = (u: URL) => JSON.parse(readFileSync(u, "utf8")) as unknown;

describe.skipIf(!existsSync(catalogPath))("data/activities.json", () => {
  const limit = existsSync(new URL("team.json", root)) ? (read(new URL("team.json", root)) as { limit: number }).limit : 40;

  it("meets the catalog invariants", () => {
    const report = validateCatalog(read(catalogPath), { limit });
    expect(report.errors).toEqual([]);
  });

  it("has a provenance entry for every activity", () => {
    expect(existsSync(provenancePath), "run the research-activities skill: it writes the sidecar").toBe(true);
    const report = validateCatalog(read(catalogPath), { limit, provenance: read(provenancePath) });
    expect(report.errors).toEqual([]);
  });
});
