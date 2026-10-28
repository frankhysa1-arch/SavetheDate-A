import Link from "next/link";

const SCREENS = [
  { href: "/me", title: "Me", description: "Pick your name, set your preferences, rate past events." },
  { href: "/settings", title: "Settings", description: "Team budget, time windows and planning rules." },
  { href: "/plan", title: "Plan", description: "Run planning and review the candidate events." },
  { href: "/vote", title: "Vote", description: "Rank your top 3 candidates and watch the live tally." },
  { href: "/result", title: "Result", description: "See the winner and add it to your calendar." },
] as const;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">SavetheDate</h1>
      <p className="mt-2 text-sm opacity-70">Team social event planner</p>
      <ul className="mt-8 grid gap-3">
        {SCREENS.map((screen) => (
          <li key={screen.href}>
            <Link
              href={screen.href}
              className="block rounded-lg border border-black/10 px-4 py-3 transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
            >
              <span className="font-medium">{screen.title}</span>
              <span className="mt-0.5 block text-sm opacity-70">{screen.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
