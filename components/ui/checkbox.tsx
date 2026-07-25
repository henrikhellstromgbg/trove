'use client';

import * as React from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Checkmark } from '@/components/icons';
import { cn } from '@/lib/cn';

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'group inline-flex size-[var(--touch-target-min)] shrink-0 cursor-pointer items-center justify-center',
        'rounded-[var(--radius-sm)] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-[var(--space-5)] items-center justify-center rounded-[var(--radius-sm)]',
          'border border-[var(--color-border-strong)] bg-[var(--color-surface)]',
          'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
          'group-hover:border-[var(--color-action)] group-active:bg-[var(--color-surface-active)]',
          'group-data-[state=checked]:border-[var(--color-action)] group-data-[state=checked]:bg-[var(--color-action)]',
          'group-aria-invalid:border-[var(--color-status-error)]'
        )}
      >
        <CheckboxPrimitive.Indicator className="flex text-[var(--color-action-text)]">
          <Checkmark size={16} />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
