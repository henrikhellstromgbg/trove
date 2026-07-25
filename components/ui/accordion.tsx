'use client';

import * as React from 'react';
import { Accordion as AccordionPrimitive } from 'radix-ui';
import { ChevronDown } from '@/components/icons';
import { cn } from '@/lib/cn';

function Accordion({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root className={cn('flex w-full flex-col', className)} {...props} />;
}

function AccordionItem({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    /* design-check-exempt: Accordion Item is a structural container; its nested Trigger owns interaction. */
    <AccordionPrimitive.Item
      className={cn('border-b border-[var(--color-border)] last:border-b-0', className)}
      {...props}
    />
  );
}

function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          'group flex min-h-[var(--touch-target-min)] flex-1 cursor-pointer items-center justify-between',
          'gap-[var(--space-3)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-2)] text-left',
          'text-[length:var(--text-sm)] font-medium text-[var(--color-text-primary)]',
          'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
          'hover:bg-[var(--color-surface-hover)]',
          'active:bg-[var(--color-surface-active)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="shrink-0 text-[var(--color-text-secondary)] transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] group-data-[state=open]:rotate-180"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className="overflow-hidden text-[length:var(--text-sm)] text-[var(--color-text-secondary)]"
      {...props}
    >
      <div className={cn('px-[var(--space-2)] pb-[var(--space-4)] pt-[var(--space-1)]', className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
