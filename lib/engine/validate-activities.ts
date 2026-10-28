// Catalog validator. Gate for `data/activities.json` produced by the research skill
// (.claude/skills/research-activities). Pure: takes parsed JSON, returns findings.
import { CATEGORIES } from "@/lib/types";
import type { Activity, Category } from "@/lib/types";
import { ActivitySchema, ProvenanceSchema } from "./schemas";

export const CATALOG_MIN = {
  total: 40,
  perCategory: 4,
  overLimit: 6, // so C1 actually filters something
  free: 1,
  indoor: 10,
  outdoor: 6,
} as const;

export interface CatalogReport {
  errors: string[];   // the catalog must not ship with these
  warnings: string[]; // worth a human look
  stats: {
    total: number;
    perCategory: Record<Category, number>;
    overLimit: number; atLimit: number; free: number;
    estimates: number; indoor: number; outdoor: number;
  };
}

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, "");

export function validateCatalog(
  raw: unknown, opts: { limit: number; provenance?: unknown },
): CatalogReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const activities: Activity[] = [];

  if (!Array.isArray(raw)) {
    errors.push("catalog must be a JSON array");
  } else {
    raw.forEach((item, i) => {
      const r = ActivitySchema.safeParse(item);
      if (r.success) activities.push(r.data);
      else {
        const label = (item as { id?: unknown } | null)?.id ?? `#${i}`;
        for (const issue of r.error.issues) errors.push(`${String(label)}: ${issue.path.join(".") || "(root)"} ${issue.message}`);
      }
    });
  }

  const seen = { id: new Set<string>(), url: new Set<string>(), name: new Set<string>() };
  for (const a of activities) {
    if (seen.id.has(a.id)) errors.push(`${a.id}: duplicate id`);
    seen.id.add(a.id);
    // disc: ids are derived from the source URL, so duplicates here would also confuse dedupe.
    const url = a.sourceUrl.replace(/\/+$/, "").toLowerCase();
    if (seen.url.has(url)) errors.push(`${a.id}: duplicate sourceUrl ${a.sourceUrl}`);
    seen.url.add(url);
    const name = a.name.trim().toLowerCase();
    if (seen.name.has(name)) errors.push(`${a.id}: duplicate name "${a.name}"`);
    seen.name.add(name);
    if (!a.id.startsWith(`${a.category}-`)) errors.push(`${a.id}: id must start with its category "${a.category}-"`);
    if (a.category === "outdoor" && a.indoor) warnings.push(`${a.id}: category outdoor but indoor is true`);
  }

  const perCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  for (const a of activities) perCategory[a.category]++;
  const count = (f: (a: Activity) => boolean) => activities.filter(f).length;
  const stats: CatalogReport["stats"] = {
    total: activities.length,
    perCategory,
    overLimit: count((a) => a.pricePerPerson > opts.limit),
    atLimit: count((a) => a.pricePerPerson === opts.limit),
    free: count((a) => a.pricePerPerson === 0),
    estimates: count((a) => a.priceIsEstimate),
    indoor: count((a) => a.indoor),
    outdoor: count((a) => !a.indoor),
  };

  if (stats.total < CATALOG_MIN.total) errors.push(`need at least ${CATALOG_MIN.total} activities, found ${stats.total}`);
  for (const c of CATEGORIES) {
    if (perCategory[c] < CATALOG_MIN.perCategory) errors.push(`category ${c} has ${perCategory[c]}, need ${CATALOG_MIN.perCategory}`);
  }
  if (stats.overLimit < CATALOG_MIN.overLimit) errors.push(`need at least ${CATALOG_MIN.overLimit} items over the limit of ${opts.limit} so C1 bites, found ${stats.overLimit}`);
  if (stats.free < CATALOG_MIN.free) errors.push("need at least one free activity");
  if (stats.indoor < CATALOG_MIN.indoor) errors.push(`need at least ${CATALOG_MIN.indoor} indoor activities, found ${stats.indoor}`);
  if (stats.outdoor < CATALOG_MIN.outdoor) errors.push(`need at least ${CATALOG_MIN.outdoor} outdoor activities, found ${stats.outdoor}`);
  if (stats.atLimit === 0) warnings.push(`no item priced exactly at the limit (${opts.limit}); the C1 boundary is only covered by fixtures`);
  if (stats.estimates === 0) warnings.push("no estimated prices; check that unlisted prices were not recorded as listed");
  if (stats.estimates > stats.total / 2) warnings.push(`${stats.estimates} of ${stats.total} prices are estimates`);

  if (opts.provenance !== undefined) checkProvenance(activities, opts.provenance, errors);
  return { errors, warnings, stats };
}

function checkProvenance(activities: Activity[], rawProvenance: unknown, errors: string[]): void {
  const parsed = ProvenanceSchema.safeParse(rawProvenance);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(`provenance: ${issue.path.join(".") || "(root)"} ${issue.message}`);
    return;
  }
  const prov = parsed.data;
  const ids = new Set(activities.map((a) => a.id));
  for (const a of activities) {
    const p = prov[a.id];
    if (!p) {
      errors.push(`${a.id}: missing provenance entry`);
      continue;
    }
    if ((p.priceSource === "estimated") !== a.priceIsEstimate) {
      errors.push(`${a.id}: priceIsEstimate=${a.priceIsEstimate} but provenance priceSource=${p.priceSource}`);
    }
    if (hostOf(p.finalUrl) !== hostOf(a.sourceUrl)) {
      errors.push(`${a.id}: provenance finalUrl host ${hostOf(p.finalUrl)} differs from sourceUrl host ${hostOf(a.sourceUrl)}`);
    }
  }
  for (const id of Object.keys(prov)) if (!ids.has(id)) errors.push(`${id}: provenance entry has no matching activity`);
}
