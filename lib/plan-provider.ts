// Single import seam to stream A. Owned by stream B.
// Today this re-exports a throwaway stub so the backend runs before A merges.
// At integration, replace the line below with:
//   export { planCandidates } from "@/lib/engine/index";
//   export { loadActivities, loadBusy, loadForecast } from "@/lib/engine/data";
// and delete tests/backend/stubs/plan.ts.
export { planCandidates, loadActivities, loadBusy, loadForecast } from "@/tests/backend/stubs/plan";
