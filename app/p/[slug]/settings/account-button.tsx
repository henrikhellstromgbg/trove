"use client";

import { useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui";

// Account and security (email, sign-in) live in Clerk's own modal. This just
// opens it, so settings keeps one home while the sensitive bits stay in Clerk.
export function AccountButton() {
  const { openUserProfile } = useClerk();

  return (
    <Button onClick={() => openUserProfile()} variant="secondary">
      Manage account and security
    </Button>
  );
}
