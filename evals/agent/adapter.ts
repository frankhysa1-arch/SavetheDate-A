import type { Activity, Candidate, Category, PlanContext } from "@/lib/types";
import { tryImport } from "../shared/load";

/** Shape of AgentResult / PlanResult in CONTRACT v2. */
export interface AgentResultLike {
  candidates: Candidate[]; emptyCategories: Category[]; discovered: Activity[];
  mode?: "agent" | "fallback"; trace?: { tool: string; input: unknown; outputSummary: string; ms: number; error?: string }[];
  usage?: { toolCalls: number; inputTokens: number; outputTokens: number }; gaps?: string[];
}
type AgentFn = (ctx: PlanContext, opts?: Record<string, unknown>) => Promise<AgentResultLike>;
type CoreFn = (ctx: PlanContext) => AgentResultLike;

const agentMod = await tryImport<{ runPlanningAgent: AgentFn }>("@/lib/engine/agent");
const coreMod = await tryImport<{ planCandidates: CoreFn }>("@/lib/engine");

export const HAS_AGENT = !!agentMod?.runPlanningAgent && !!coreMod?.planCandidates;

/** The ONLY file that knows how to call the system under test (CONTRACT v2 seams). */
export const runAgent: AgentFn = (ctx, opts) => {
  if (!agentMod) throw new Error("lib/engine/agent not found (stream A has not landed)");
  return agentMod.runPlanningAgent(ctx, opts);
};
export const runCore: CoreFn = (ctx) => {
  if (!coreMod) throw new Error("lib/engine not found (stream A has not landed)");
  return coreMod.planCandidates(ctx);
};
