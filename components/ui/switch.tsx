'use client';

import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from '@/lib/cn';

function Switch({ className, size = 'default', ...props }: React.ComponentProps<typeof SwitchPrimitive.Root> & { size?: 'sm' | 'default' }) {
  return (
    <SwitchPrimitive.Root
      data-size={size}
      className={cn(
        'group relative inline-flex h-[var(--touch-target-min)] w-[var(--touch-target-min)] shrink-0 cursor-pointer items-center',
        'rounded-[var(--radius-full)] disabled:cursor-not-allowed disabled:opacity-50',
        'before:absolute before:left-1/2 before:-translate-x-1/2',
        'before:h-[var(--space-6)] before:w-[var(--space-10)]',
        'data-[size=sm]:before:h-[var(--space-5)] data-[size=sm]:before:w-[var(--space-8)]',
        'before:rounded-[var(--radius-full)] before:bg-[var(--color-border-strong)]',
        'before:transition-colors before:duration-[var(--duration-fast)] before:ease-[var(--ease-out)]',
        'hover:before:bg-[var(--color-text-secondary)] active:before:bg-[var(--color-surface-active)]',
        'data-[state=checked]:before:bg-[var(--color-action)] aria-invalid:before:bg-[var(--color-status-error-bg)]',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none absolute left-[var(--space-1)] block size-[var(--space-4)] cursor-pointer',
          'group-data-[size=sm]:left-[var(--space-2)] group-data-[size=sm]:size-[var(--space-3)]',
          'rounded-[var(--radius-full)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]',
          'transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)]',
          'group-data-[state=checked]:translate-x-[var(--space-5)]',
          'group-data-[size=sm]:group-data-[state=checked]:translate-x-[var(--space-4)]'
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
