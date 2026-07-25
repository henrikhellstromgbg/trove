import * as React from 'react';
import { cn } from '@/lib/cn';

// Empty states are an invitation to act: icon, one-line explanation, one action.
// Copy rules: sentence case, plain verbs, no mood-only messaging (A11).

interface EmptyStateBaseProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
}

export type EmptyStateProps = EmptyStateBaseProps & (
  | { title: string; message?: never }
  | { message: string; title?: never }
);

function EmptyState({ icon, title, message, description, action, className, ...props }: EmptyStateProps) {
  const compact = message !== undefined;
  const primaryText = title ?? message;

  return (
    <div
      className={cn(
        'flex flex-col gap-[var(--space-3)]',
        compact
          ? 'items-start text-left'
          : 'items-center justify-center p-[var(--space-12)] text-center',
        className
      )}
      {...props}
    >
      {icon && <div aria-hidden="true" className="text-[var(--color-text-tertiary)]">{icon}</div>}
      <p
        className={cn(
          compact
            ? 'text-[length:var(--text-sm)] text-[var(--color-text-secondary)]'
            : 'text-[length:var(--text-lg)] font-semibold text-[var(--color-text-primary)]'
        )}
      >
        {primaryText}
      </p>
      {description && (
        <p className="max-w-sm text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">{description}</p>
      )}
      {action && <div className="mt-[var(--space-2)]">{action}</div>}
    </div>
  );
}

export { EmptyState };
