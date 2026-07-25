'use client';

import * as React from 'react';
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { toggleVariants } from '@/components/ui/toggle';

type ToggleContextValue = VariantProps<typeof toggleVariants> & { spacing: 'none' | 'sm' };
const ToggleGroupContext = React.createContext<ToggleContextValue>({ variant: 'default', size: 'default', spacing: 'sm' });

function ToggleGroup({ className, variant, size, spacing = 'sm', children, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & VariantProps<typeof toggleVariants> & { spacing?: 'none' | 'sm' }) {
  return (
    <ToggleGroupPrimitive.Root
      data-spacing={spacing}
      className={cn(
        'group/toggle-group flex w-fit items-center gap-[var(--space-1)] rounded-[var(--radius-md)]',
        'data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch',
        'data-[spacing=none]:gap-0',
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, spacing }}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({ className, variant, size, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext);
  const resolvedVariant = context.variant ?? variant;
  const resolvedSize = context.size ?? size;

  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        toggleVariants({ variant: resolvedVariant, size: resolvedSize }),
        'shrink-0 cursor-pointer',
        context.spacing === 'none' && [
          'rounded-none',
          'group-data-[orientation=horizontal]/toggle-group:first:rounded-l-[var(--radius-md)]',
          'group-data-[orientation=horizontal]/toggle-group:last:rounded-r-[var(--radius-md)]',
          'group-data-[orientation=vertical]/toggle-group:first:rounded-t-[var(--radius-md)]',
          'group-data-[orientation=vertical]/toggle-group:last:rounded-b-[var(--radius-md)]',
          resolvedVariant === 'outline' && [
            'group-data-[orientation=horizontal]/toggle-group:border-l-0 group-data-[orientation=horizontal]/toggle-group:first:border-l',
            'group-data-[orientation=vertical]/toggle-group:border-t-0 group-data-[orientation=vertical]/toggle-group:first:border-t',
          ],
        ],
        className
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
