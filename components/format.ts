import type { Category } from "@/lib/types";

export const CATEGORY_LABEL: Record<Category, string> = {
  dining: "Dining",
  drinks: "Drinks",
  outdoor: "Outdoor",
  sports: "Sports",
  culture: "Culture",
  games: "Games",
  creative: "Creative",
  wellness: "Wellness",
};

const money = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
export const formatMoney = (n: number) => money.format(n);

/** "Thu 5 Nov, 17:30 to 19:30" in the viewer's time zone. */
export function formatSlot(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Time to be confirmed";
  const day = start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const hm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${hm(start)} to ${hm(end)}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function joinNames(ids: string[], names: Record<string, string>): string {
  return ids.map((id) => names[id] ?? id).join(", ");
}
