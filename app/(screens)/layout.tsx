import type { ReactNode } from "react";
import { MemberProvider } from "@/components/MemberProvider";
import { Nav } from "@/components/Nav";

// Shell for the five screens: top navigation plus the shared "current member" context.
export default function ScreensLayout({ children }: { children: ReactNode }) {
  return (
    <MemberProvider>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </MemberProvider>
  );
}
