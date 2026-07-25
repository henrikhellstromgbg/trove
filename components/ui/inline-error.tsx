import type { HTMLAttributes } from 'react';
import { ErrorFilled } from '@/components/icons';
import { cn } from '@/lib/cn';

// Standalone inline error line. Colour pairs with an icon and text (N9), and
// uses --color-status-error-text so it clears the 75 APCA text tier.

export interface InlineErrorProps extends HTMLAttributes<HTMLParagraphElement> {
  message?: string | null;
}

export function InlineError({ message, className, ...props }: InlineErrorProps) {
  if (!message) return null;
  return (
    <p
      role="alert"
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5 text-[length:var(--text-sm)] text-[var(--color-status-error-text)]',
        className,
      )}
      {...props}
    >
      <ErrorFilled size={16} aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
