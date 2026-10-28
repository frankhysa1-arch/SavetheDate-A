import type { Candidate } from "@/lib/types";
import { explain } from "@/lib/explain";
import { WORLD } from "./world";

/**
 * The ONLY file that knows how to call the system under test.
 * Proposed contract delta (needs a PR, see README "Prerequisites"):
 *   explain(candidates, ctx?: { activities: Activity[]; members: Member[] })
 * `ctx` defaults to the real catalog/DB; the eval injects a fixed world.
 */
export const runExplain = (candidates: Candidate[]): Promise<Candidate[]> => explain(candidates, WORLD);
