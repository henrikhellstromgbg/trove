"use client";

import { useClerk } from "@clerk/nextjs";

// Account and security (email, sign-in) live in Clerk's own modal. This just
// opens it, so settings keeps one home while the sensitive bits stay in Clerk.
export function AccountButton() {
  const { openUserProfile } = useClerk();
  return (
    <button
      onClick={() => openUserProfile()}
      className="self-start rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
    >
      manage account &amp; security
    </button>
  );
}
