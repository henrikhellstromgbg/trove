// Light coloured-text status label, not a filled badge. Use Badge when the
// status needs to read as a discrete chip; use StatusIndicator inside dense
// lists and tables where a filled chip per row would be visual noise.
//
// Colour is always paired with the text label, so N9 holds. Error and review
// use the darker --color-status-*-text tokens so the label clears the Lc 75
// body-text tier; the lighter --color-status-* base tier is icon-only (Lc 45).

import * as React from 'react';
import { cn } from '@/lib/cn';

export type Status =
  | 'active'
  | 'paused'
  | 'error'
  | 'review'
  | 'success'
  | 'approved';

export interface StatusIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
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

function StatusIndicator({ status, label, count, className, ...props }: StatusIndicatorProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[length:var(--text-sm)]',
        statusText[status],
        className
      )}
      {...props}
    >
      {count !== undefined && (
        <span className="font-mono tabular-nums text-[length:var(--text-sm)]">{count}</span>
      )}
      <span>{label}</span>
    </span>
  );
}

export { StatusIndicator };
