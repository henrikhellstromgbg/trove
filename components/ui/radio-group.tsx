'use client';

import * as React from 'react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { cn } from '@/lib/cn';

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn('grid w-full gap-[var(--space-2)]', className)} {...props} />;
}

function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        'group inline-flex size-[var(--touch-target-min)] shrink-0 cursor-pointer items-center justify-center',
        'rounded-[var(--radius-full)] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-[var(--space-5)] items-center justify-center rounded-[var(--radius-full)]',
          'border border-[var(--color-border-strong)] bg-[var(--color-surface)]',
          'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
          'group-hover:border-[var(--color-action)] group-active:bg-[var(--color-surface-active)]',
          'group-data-[state=checked]:border-[var(--color-action)]',
          'group-aria-invalid:border-[var(--color-status-error)]'
        )}
      >
        <RadioGroupPrimitive.Indicator className="size-[var(--space-2)] rounded-[var(--radius-full)] bg-[var(--color-action)]" />
      </span>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
