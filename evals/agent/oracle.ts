import { createHash } from "node:crypto";
import { CandidateSchema, CATEGORIES, type Activity, type Candidate, type Category, type PlanContext } from "@/lib/types";

/**
 * Independent oracle for the planning agent's hard guarantee (CONTRACT "Agent rules").
 * It recomputes slots, attendance, C1-C5 and the discovery rules from raw inputs (busy, forecast, history),
 * never from engine code, so an engine bug and an agent cheat both show up here.
 */
export interface ResultLike { candidates: Candidate[]; emptyCategories: Category[]; discovered: Activity[] }
export interface Violation { rule: string; candidateId?: string; detail: string }

const DAY = 86_400_000;
const ms = (s: string) => Date.parse(s);

export function attendance(ctx: PlanContext, startISO: string, endISO: string) {
  const s = ms(startISO), e = ms(endISO);
  const avail = ctx.members.filter((m) => !(ctx.busy[m.id] ?? []).some((b) => ms(b.start) < e && ms(b.end) > s)).map((m) => m.id);
  return { avail, pct: (avail.length / ctx.members.length) * 100 };
}
export const matchedMembers = (ctx: PlanContext, a: Activity) =>
  ctx.members.filter((m) => m.categories.includes(a.category) || m.tags.includes(a.id)).map((m) => m.id);
export const resolve = (ctx: PlanContext, discovered: Activity[], id: string) =>
  ctx.activities.find((a) => a.id === id) ?? discovered.find((a) => a.id === id);

/** C1, C3, C4, C5 for one (activity, slot). Returns failing rule ids. */
export function hardFailures(ctx: PlanContext, a: Activity, startISO: string, endISO: string): string[] {
  const out: string[] = [];
  if (a.pricePerPerson > ctx.team.limit) out.push("C1");
  if (!a.indoor) {
    const f = ctx.forecastFor(startISO.slice(0, 10));
    if (f && (f.rainPct > 40 || f.tempC < 5 || f.tempC > 32 || f.windKmh > 30)) out.push("C3");
  }
  if (attendance(ctx, startISO, endISO).pct < ctx.team.attendanceThresholdPct) out.push("C4");
  const win = ctx.team.noveltyWeeks * 7 * DAY;
  if (ctx.history.some((h) => h.activityId === a.id && Math.abs(ms(startISO) - ms(h.start)) < win)) out.push("C5");
  return out;
}

export function checkResult(ctx: PlanContext, res: ResultLike, opts: { allowedDiscoveredUrls?: string[] } = {}): Violation[] {
  const v: Violation[] = [];
  const add = (rule: string, detail: string, candidateId?: string) => v.push({ rule, detail, ...(candidateId ? { candidateId } : {}) });

  const ids = res.candidates.map((c) => c.id);
  if (new Set(ids).size !== ids.length) add("O0-unique-ids", "duplicate candidate ids");

  for (const d of res.discovered) {
    const expected = "disc:" + createHash("sha1").update(d.sourceUrl).digest("hex").slice(0, 10);
    if (d.id !== expected) add("D1-id-is-sha1-of-url", `${d.id} != ${expected}`);
    if (!(CATEGORIES as readonly string[]).includes(d.category)) add("D2-category", `${d.id}: ${d.category}`);
    if (!(d.pricePerPerson >= 0)) add("D3-price", `${d.id}: ${d.pricePerPerson}`);
    if (opts.allowedDiscoveredUrls && !opts.allowedDiscoveredUrls.includes(d.sourceUrl)) add("D4-url-from-tool-result", `${d.id}: ${d.sourceUrl}`);
  }

  const perCat = new Map<Category, number>();
  const t0 = ms(ctx.now);
  for (const c of res.candidates) {
    const a = resolve(ctx, res.discovered, c.activityId);
    if (!a) { add("O1-activity-resolves", `unknown activity ${c.activityId}`, c.id); continue; }
    perCat.set(a.category, (perCat.get(a.category) ?? 0) + 1);
    const fails = hardFailures(ctx, a, c.slotStart, c.slotEnd);
    for (const f of fails) add(`O2-${f}`, `${a.id} @ ${c.slotStart}`, c.id);
    const att = attendance(ctx, c.slotStart, c.slotEnd);
    if (Math.abs(att.pct - c.attendancePct) > 0.51) add("O3-attendance-recomputed", `claimed ${c.attendancePct} actual ${att.pct}`, c.id);
    if ([...att.avail].sort().join() !== [...c.availableMemberIds].sort().join()) add("O3-available-members", "availableMemberIds differ from busy data", c.id);
    const matched = matchedMembers(ctx, a);
    if ([...matched].sort().join() !== [...c.matchedMemberIds].sort().join()) add("O4-matched-members", `claimed ${c.matchedMemberIds} actual ${matched}`, c.id);
    if (matched.length < 2) add("O4-C2-floor", `${matched.length} matched`, c.id);
    if (ms(c.slotEnd) - ms(c.slotStart) !== ctx.team.eventLengthMin * 60_000) add("O5-event-length", `${c.slotStart}..${c.slotEnd}`, c.id);
    if (ms(c.slotStart) < t0 || ms(c.slotEnd) > t0 + (ctx.team.windowDays + 1) * DAY) add("O5-inside-window", c.slotStart, c.id);
    if (c.sourceUrl !== a.sourceUrl) add("O6-source-url-from-activity", `${c.sourceUrl} != ${a.sourceUrl}`, c.id);
    if (c.priceIsEstimate !== a.priceIsEstimate) add("O6-price-flag", `${c.priceIsEstimate} != ${a.priceIsEstimate}`, c.id);
    if (!(c.score >= 0 && c.score <= 1)) add("O7-score-range", String(c.score), c.id);
    if (!CandidateSchema.safeParse(c).success) add("O8-schema", "CandidateSchema failed", c.id);
    if (!c.explanation.trim() || c.explanation.length > 300) add("O9-explanation-present-and-<=300", `len=${c.explanation.length}`, c.id);
  }
  for (const [cat, n] of perCat) if (n > 2) add("O10-max-2-per-category", `${cat}: ${n}`);
  const empty = CATEGORIES.filter((c) => !perCat.has(c));
  if ([...empty].sort().join() !== [...res.emptyCategories].sort().join()) add("O10-emptyCategories", `claimed ${res.emptyCategories} actual ${empty}`);
  return v;
}

/** Private data must never leave the tools: constraints canary, anywhere in output or trace. */
export const leaks = (value: unknown, canaries: string[]) => canaries.filter((c) => JSON.stringify(value).includes(c));

/** Same (activity, slot) must get the same score as the deterministic core, since both use the same code. */
export function scoreAgreement(core: ResultLike, res: ResultLike): Violation[] {
  const key = (c: Candidate) => `${c.activityId}@${c.slotStart}`;
  const m = new Map(core.candidates.map((c) => [key(c), c.score]));
  return res.candidates.filter((c) => m.has(key(c)) && Math.abs(m.get(key(c))! - c.score) > 1e-9)
    .map((c) => ({ rule: "O11-score-matches-core", candidateId: c.id, detail: `${c.score} vs ${m.get(key(c))}` }));
}

/** Finds a rule-clean (activity, slot) by brute force, independent of the engine. For oracle self-tests. */
export function findGood(ctx: PlanContext): { a: Activity; start: string; end: string } | null {
  for (let d = 1; d < 13; d++) {
    const day = new Date(Date.parse(ctx.now) + d * DAY).toISOString().slice(0, 10);
    for (const hh of ["17:30", "18:00"]) {
      const start = `${day}T${hh}:00.000Z`; const end = new Date(Date.parse(start) + ctx.team.eventLengthMin * 60_000).toISOString();
      for (const a of ctx.activities) if (matchedMembers(ctx, a).length >= 2 && hardFailures(ctx, a, start, end).length === 0) return { a, start, end };
    }
  }
  return null;
}
