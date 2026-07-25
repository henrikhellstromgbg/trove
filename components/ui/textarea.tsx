import * as React from 'react';
import { cn } from '@/lib/cn';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'field-sizing-content min-h-[var(--space-24)] w-full rounded-[var(--radius-sm)]',
        'border border-[var(--color-border)] bg-[var(--color-surface)]',
        'px-[var(--space-3)] py-[var(--space-2)]',
        'text-[length:var(--text-sm)] text-[var(--color-text-primary)]',
        'placeholder:text-[var(--color-text-tertiary)]',
        'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
        'hover:border-[var(--color-border-strong)]',
        'disabled:cursor-not-allowed disabled:bg-[var(--color-surface-sunken)] disabled:text-[var(--color-text-disabled)]',
        'aria-invalid:border-[var(--color-status-error)]',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };
