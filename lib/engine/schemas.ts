// Runtime validators for data files. `lib/types.ts` is frozen, so data-file schemas
// live here; the compile-time guard keeps them identical to the contract types.
import { z } from "zod";
import { CATEGORIES } from "@/lib/types";
import type { Activity } from "@/lib/types";

/** Stable slug: `<category>-<venue-slug>`, lowercase ascii. Members reference these ids in `tags`. */
const ID_PATTERN = /^[a-z]+(-[a-z0-9]+)+$/;
const TAG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const httpsUrl = z.string().refine((s) => {
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
}, "must be an https URL");

export const ActivitySchema = z.strictObject({
  id: z.string().regex(ID_PATTERN, "id must be a lowercase slug like dining-tartine-bakery"),
  name: z.string().trim().min(1),
  category: z.enum(CATEGORIES),
  tags: z.array(z.string().regex(TAG_PATTERN, "tags are lowercase kebab-case")),
  indoor: z.boolean(),
  pricePerPerson: z.number().finite().min(0),
  priceIsEstimate: z.boolean(),
  sourceUrl: httpsUrl,
});

/** Where an activity's facts came from. Kept in a sidecar because `Activity` has no extra fields. */
export const ProvenanceEntrySchema = z.strictObject({
  retrievedAt: z.iso.datetime({ offset: true }),
  finalUrl: httpsUrl,
  evidence: z.string().trim().min(1).max(300),
  priceSource: z.enum(["listed", "estimated"]),
});
export const ProvenanceSchema = z.record(z.string(), ProvenanceEntrySchema);
export type ProvenanceEntry = z.infer<typeof ProvenanceEntrySchema>;

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const _activitySchemaMatchesInterface: Equals<z.infer<typeof ActivitySchema>, Activity> = true;
void _activitySchemaMatchesInterface;
