'use client';

import * as React from 'react';
import { Progress as ProgressPrimitive } from 'radix-ui';
import { cn } from '@/lib/cn';

function Progress({ className, value, max = 100, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const numericValue = typeof value === 'number' ? value : 0;
  const percentage = Math.min(100, Math.max(0, (numericValue / max) * 100));

  return (
    <ProgressPrimitive.Root
      value={value}
      max={max}
      className={cn(
        'relative h-[var(--space-2)] w-full overflow-hidden rounded-[var(--radius-full)]',
        'bg-[var(--color-surface-sunken)]',
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full bg-[var(--color-action)] transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)]"
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
