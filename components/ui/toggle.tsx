'use client';

import * as React from 'react';
import { Toggle as TogglePrimitive } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const toggleVariants = cva(
  [
    'inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] cursor-pointer items-center justify-center',
    'gap-[var(--space-2)] whitespace-nowrap rounded-[var(--radius-md)] px-[var(--space-3)]',
    'text-[length:var(--text-sm)] font-medium text-[var(--color-text-primary)]',
    'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
    'hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]',
    'data-[state=on]:bg-[var(--color-brand-subtle)] data-[state=on]:text-[var(--color-text-primary)]',
    'disabled:cursor-not-allowed disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]',
      },
      size: {
        sm: 'px-[var(--space-2)]',
        default: 'px-[var(--space-3)]',
        lg: 'px-[var(--space-4)] text-[length:var(--text-base)]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

function Toggle({ className, variant, size, ...props }: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive.Root className={cn(toggleVariants({ variant, size }), className)} {...props} />;
}

export { Toggle, toggleVariants };
