"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Show, SignInButton } from "@clerk/nextjs";
import { AskOverlay } from "./ask-overlay";
import { UserMenu } from "./user-menu";

const MODULES = [
  { href: "/", label: "capture" },
  { href: "/wiki", label: "wiki" },
  { href: "/digest", label: "digest" },
  { href: "/pipelines", label: "pipelines" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const activeHref =
    MODULES.find((m) =>
      m.href === "/" ? pathname === "/" : pathname.startsWith(m.href)
    )?.href ?? "/";

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-4 md:px-10">
        <Link href="/" className="flex items-center">
          <img src="/logo.svg" alt="Trove" className="h-6 w-auto" />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {MODULES.map((m) => {
            const active = m.href === activeHref;
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`text-sm transition-colors ${
                  active ? "text-ink" : "text-ink-faint hover:text-ink-dim"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton>
              <button className="text-sm text-ink-dim hover:text-ink transition-colors">
                sign in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserMenu />
          </Show>
        </div>
      </header>

      <AskOverlay />

      <main className="relative flex w-full flex-col pt-20">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
            transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1] }}
            className="flex w-full flex-1 flex-col pb-24"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
