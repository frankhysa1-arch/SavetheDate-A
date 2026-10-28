"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MemberSelect } from "@/components/MemberProvider";

const LINKS = [
  { href: "/me", label: "Preferences" },
  { href: "/settings", label: "Settings" },
  { href: "/plan", label: "Plan" },
  { href: "/vote", label: "Vote" },
  { href: "/result", label: "Result" },
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <svg viewBox="0 0 24 24" className="size-6 text-emerald-700 dark:text-emerald-400" fill="none" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
            <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="m9 15.5 2 2 4-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          SavetheDate
        </Link>
        <nav aria-label="Main" className="order-3 w-full sm:order-none sm:w-auto">
          <ul className="flex flex-wrap gap-1">
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-md px-3 py-1.5 text-sm font-medium ${
                      active
                        ? "bg-emerald-700 text-white dark:bg-emerald-600"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto">
          <MemberSelect id="nav-member" />
        </div>
      </div>
    </header>
  );
}
