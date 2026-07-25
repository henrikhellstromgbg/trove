import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

// Compact, left-aligned empty state: a short explanation and an optional
// action. Matches Trove's established inline "nothing here yet" pattern rather
// than base-ds's large centred variant, which Trove does not use.

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  message: string;
  action?: ReactNode;
}

export function EmptyState({ message, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 text-[length:var(--text-sm)] text-[var(--color-text-secondary)]',
        className,
      )}
      {...props}
    >
      <p>{message}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
