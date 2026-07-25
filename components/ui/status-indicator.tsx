import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

// Light coloured-text status label (not a filled badge — Phase 3 decision).
// Colour is always paired with the text label, so N9 holds. Reds use the
// darker --color-status-*-text tokens so the label clears the 75 APCA text
// tier; brand red #E4130E as text would only reach ~70.

export type Status =
  | 'active'
  | 'paused'
  | 'error'
  | 'review'
  | 'success'
  | 'approved';

export interface StatusIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  status: Status;
  label: string;
  count?: number;
}

const statusText: Record<Status, string> = {
  active: 'text-[var(--color-text-secondary)]',
  paused: 'text-[var(--color-text-tertiary)]',
  error: 'text-[var(--color-status-error-text)]',
  review: 'text-[var(--color-status-error-text)]',
  success: 'text-[var(--color-status-success-text)]',
  approved: 'text-[var(--color-status-success-text)]',
};

export function StatusIndicator({
  status,
  label,
  count,
  className,
  ...props
}: StatusIndicatorProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[length:var(--text-sm)]',
        statusText[status],
        className,
      )}
      {...props}
    >
      {count !== undefined ? (
        <span className="font-mono tabular-nums text-[length:var(--text-sm)]">{count}</span>
      ) : null}
      <span>{label}</span>
    </span>
  );
}
