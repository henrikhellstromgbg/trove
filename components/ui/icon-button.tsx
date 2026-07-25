import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/cn';

// Icon-only button on the base-ds ghost/icon pattern. Requires an accessible
// label. 44px touch target (A3, tightening to 36 on md), token colours, and
// the global :focus-visible ring (no outline suppression).

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'aria-label'> {
  label: string;
  title?: string;
}

export function IconButton({
  label,
  title,
  className,
  children,
  ref,
  ...props
}: IconButtonProps & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={title ?? label}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)]',
        'text-[var(--color-text-secondary)] transition-colors duration-[var(--duration-fast)]',
        'hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
        'disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:w-9',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
