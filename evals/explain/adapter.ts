import type { Candidate } from "@/lib/types";
import { tryImport } from "../shared/load";
import { WORLD } from "./world";

type ExplainFn = (c: Candidate[], ctx?: unknown) => Promise<Candidate[]>;
export const explainMod = await tryImport<{ explain: ExplainFn }>("@/lib/explain");
export const HAS_EXPLAIN = !!explainMod?.explain;

/**
 * The ONLY file that knows how to call the system under test.
 * Proposed contract delta (needs a PR, see README "Prerequisites"):
 *   explain(candidates, ctx?: { activities; members; discovered? })
 * `ctx` defaults to the real catalog/DB/Run.discovered; the eval injects a fixed world.
 * Since contract v2, explain() is the FALLBACK path only: POST /plan calls it when
 * AgentResult.mode === "fallback" and for any candidate whose explanation is still "".
 */
export const runExplain = (candidates: Candidate[]): Promise<Candidate[]> => {
  if (!explainMod) throw new Error("lib/explain.ts not found (stream B has not landed)");
  return explainMod.explain(candidates, WORLD);
};
