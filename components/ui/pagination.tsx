import * as React from 'react';

import { ChevronLeft, ChevronRight, OverflowMenuHorizontal } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="Pagination"
      data-slot="pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex items-center gap-[var(--space-1)]', className)}
      {...props}
    />
  );
}

function PaginationItem(props: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, 'size'> &
  React.ComponentProps<'a'>;

function PaginationLink({ className, isActive, size = 'icon', ...props }: PaginationLinkProps) {
  return (
    <Button asChild variant={isActive ? 'secondary' : 'ghost'} size={size}>
      <a className={className} aria-current={isActive ? 'page' : undefined} data-slot="pagination-link" data-active={isActive} {...props} />
    </Button>
  );
}

function PaginationPrevious({ className, text = 'Previous', ...props }: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  return (
    <PaginationLink aria-label="Go to previous page" size="md" className={cn('gap-[var(--space-2)]', className)} {...props}>
      <ChevronLeft size={16} aria-hidden="true" />
      <span className="hidden sm:block">{text}</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, text = 'Next', ...props }: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  return (
    <PaginationLink aria-label="Go to next page" size="md" className={cn('gap-[var(--space-2)]', className)} {...props}>
      <span className="hidden sm:block">{text}</span>
      <ChevronRight size={16} aria-hidden="true" />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden="true"
      data-slot="pagination-ellipsis"
      className={cn(
        'flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center',
        'text-[var(--color-text-tertiary)]',
        className
      )}
      {...props}
    >
      <OverflowMenuHorizontal size={16} aria-hidden="true" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious };
