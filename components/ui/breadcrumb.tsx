import * as React from 'react';
import { Slot } from 'radix-ui';

import { ChevronRight, OverflowMenuHorizontal } from '@/components/icons';
import { cn } from '@/lib/cn';

function Breadcrumb({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="Breadcrumb" data-slot="breadcrumb" className={cn(className)} {...props} />;
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        'flex flex-wrap items-center gap-[var(--space-2)] break-words',
        'text-[length:var(--text-sm)] text-[var(--color-text-secondary)]',
        className
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn('inline-flex items-center gap-[var(--space-1)]', className)}
      {...props}
    />
  );
}

function BreadcrumbLink({ asChild, className, ...props }: React.ComponentProps<'a'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'a';
  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn(
        'inline-flex min-h-[var(--touch-target-min)] cursor-pointer items-center rounded-[var(--radius-sm)] px-[var(--space-2)]',
        'text-[var(--color-text-secondary)] transition-colors duration-[var(--duration-fast)]',
        'hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
        'active:bg-[var(--color-surface-active)] active:text-[var(--color-text-primary)]',
        'aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:text-[var(--color-text-disabled)]',
        className
      )}
      {...props}
    />
  );
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn('px-[var(--space-2)] font-normal text-[var(--color-text-primary)]', className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn('text-[var(--color-text-tertiary)] [&>svg]:size-4', className)}
      {...props}
    >
      {children ?? <ChevronRight aria-hidden="true" />}
    </li>
  );
}

function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn(
        'flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center',
        'text-[var(--color-text-tertiary)] [&>svg]:size-4',
        className
      )}
      {...props}
    >
      <OverflowMenuHorizontal aria-hidden="true" />
      <span className="sr-only">More</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
