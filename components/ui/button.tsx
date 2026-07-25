'use client';

// Reference component: this file establishes the pattern all components follow.
// - cva for variants, cn() for merging
// - semantic tokens only, via arbitrary-value classes bound to CSS vars
// - all states: hover, focus-visible (global ring), active, disabled, loading
// - min touch target 44px (A3)

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap select-none',
    'rounded-[var(--radius-md)] font-medium',
    'transition-colors duration-[var(--duration-fast)]',
    'disabled:pointer-events-none disabled:opacity-50',
    'min-h-[var(--touch-target-min)]',
    '[&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-[var(--color-primary)] text-[var(--color-primary-text)]',
          'hover:bg-[var(--color-primary-hover)]',
          'active:opacity-90',
        ],
        secondary: [
          'bg-[var(--color-surface)] text-[var(--color-text-primary)]',
          'border border-[var(--color-border)]',
          'hover:bg-[var(--color-surface-hover)]',
          'active:bg-[var(--color-surface-active)]',
        ],
        ghost: [
          'text-[var(--color-text-primary)]',
          'hover:bg-[var(--color-surface-hover)]',
          'active:bg-[var(--color-surface-active)]',
        ],
        destructive: [
          'bg-[var(--color-status-error)] text-[var(--color-text-on-status)]',
          'hover:opacity-90 active:opacity-80',
        ],
      },
      size: {
        sm: 'h-9 min-h-9 px-3 text-[length:var(--text-sm)]',
        md: 'h-11 px-4 text-[length:var(--text-sm)]',
        lg: 'h-12 px-6 text-[length:var(--text-base)]',
        icon: 'h-11 w-11 p-0', // requires aria-label (A5)
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {children}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
