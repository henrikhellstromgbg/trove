"use client";

import { useEffect, useRef, useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";

export function UserMenu() {
  const { user, isLoaded } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!isLoaded || !user) return null;

  const email = user.primaryEmailAddress?.emailAddress ?? "";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex size-8 items-center justify-center rounded-full border border-ink-faint text-ink-dim transition-colors hover:border-ink hover:text-ink"
        aria-label="user menu"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-50 w-56 overflow-hidden rounded-2xl border border-line-strong bg-paper shadow-lg">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-xs text-ink-faint">signed in as</p>
            <p className="truncate text-sm text-ink">{email}</p>
          </div>
          <button
            onClick={() => {
              openUserProfile();
              setOpen(false);
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-ink-dim transition-colors hover:bg-canvas-deep hover:text-ink"
          >
            account settings
          </button>
          <button
            onClick={() => signOut()}
            className="w-full border-t border-line px-4 py-2.5 text-left text-sm text-ink-dim transition-colors hover:bg-canvas-deep hover:text-ink"
          >
            sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
