'use client';

import * as React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';
import { cn } from '@/lib/cn';

function Slider({ className, defaultValue, value, min = 0, max = 100, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min]),
    [defaultValue, min, value]
  );

  return (
    <SliderPrimitive.Root
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        'relative flex w-full touch-none select-none items-center',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        'data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-[var(--space-20)]',
        'data-[orientation=vertical]:w-[var(--touch-target-min)] data-[orientation=vertical]:flex-col',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn(
          'relative grow overflow-hidden rounded-[var(--radius-full)] bg-[var(--color-surface-sunken)]',
          'data-[orientation=horizontal]:h-[var(--space-1)] data-[orientation=horizontal]:w-full',
          'data-[orientation=vertical]:h-full data-[orientation=vertical]:w-[var(--space-1)]'
        )}
      >
        <SliderPrimitive.Range className="absolute bg-[var(--color-action)] data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full" />
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className={cn(
            'relative block size-[var(--touch-target-min)] shrink-0 cursor-pointer rounded-[var(--radius-full)] bg-transparent',
            'after:absolute after:left-1/2 after:top-1/2 after:size-[var(--space-4)]',
            'after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-[var(--radius-full)]',
            'after:border after:border-[var(--color-action)] after:bg-[var(--color-surface)] after:shadow-[var(--shadow-sm)]',
            'after:transition-colors after:duration-[var(--duration-fast)]',
            'hover:after:bg-[var(--color-surface-hover)] active:cursor-grabbing active:after:bg-[var(--color-surface-active)]',
            'disabled:cursor-not-allowed'
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
