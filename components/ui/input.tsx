import * as React from 'react';
import { cn } from '@/lib/cn';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-[var(--touch-target-min)] w-full min-w-0 rounded-[var(--radius-sm)]',
        'border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)]',
        'text-[length:var(--text-sm)] text-[var(--color-text-primary)]',
        'placeholder:text-[var(--color-text-tertiary)]',
        'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
        'hover:border-[var(--color-border-strong)]',
        'disabled:cursor-not-allowed disabled:bg-[var(--color-surface-sunken)] disabled:text-[var(--color-text-disabled)]',
        'aria-invalid:border-[var(--color-status-error)]',
        'file:mr-[var(--space-3)] file:border-0 file:bg-transparent file:text-[length:var(--text-sm)] file:font-medium file:text-[var(--color-text-primary)]',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
