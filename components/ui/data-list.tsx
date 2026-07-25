// Vertical list of item rows: the list equivalent of Table, for content that
// is not tabular. A row is static, a link, or a button. When interactive, a
// stretched overlay makes the whole row the click target while trailing
// controls stay clickable (z-10), so a row never nests a button inside a link.
//
// The row owns its own inner padding (A15): the hover surface must not sit
// flush against the text. Views pass content, never row layout (A16).

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export type DataListProps = React.HTMLAttributes<HTMLDivElement>;

function DataList({ className, ...props }: DataListProps) {
  return (
    <div
      role="list"
      className={cn('divide-y divide-[var(--color-border-subtle)]', className)}
      {...props}
    />
  );
}

interface DataRowCommonProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

interface StaticDataRowProps extends DataRowCommonProps {
  href?: undefined;
  onSelect?: undefined;
  selectLabel?: undefined;
}

interface LinkDataRowProps extends DataRowCommonProps {
  /** Makes the row a link; the row content becomes the click target via a stretched overlay. */
  href: string;
  onSelect?: undefined;
  /** Accessible name for the overlay control, since the visible text sits outside it. */
  selectLabel: string;
}

interface ButtonDataRowProps extends DataRowCommonProps {
  href?: undefined;
  /** Makes the row a button; the row content becomes the click target via a stretched overlay. */
  onSelect: () => void;
  /** Accessible name for the overlay control, since the visible text sits outside it. */
  selectLabel: string;
}

export type DataRowProps = StaticDataRowProps | LinkDataRowProps | ButtonDataRowProps;

const overlay = [
  'absolute inset-0 cursor-pointer rounded-[inherit]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
  'focus-visible:ring-[var(--color-focus-ring)]',
].join(' ');

function DataRow({
  href,
  onSelect,
  selectLabel,
  leading,
  trailing,
  children,
  className,
  ...props
}: DataRowProps) {
  const interactive = Boolean(href || onSelect);

  return (
    <div
      role="listitem"
      className={cn(
        'relative flex items-center gap-[var(--space-3)]',
        'px-[var(--space-2)] py-[var(--space-3)]',
        interactive && [
          'rounded-[var(--radius-sm)] transition-colors duration-[var(--duration-fast)]',
          'hover:bg-[var(--color-surface-hover)]',
        ],
        className
      )}
      {...props}
    >
      {leading && <span className="shrink-0">{leading}</span>}
      <div className="min-w-0 flex-1 text-[length:var(--text-sm)] text-[var(--color-text-primary)]">
        {children}
      </div>
      {trailing && <span className="relative z-10 shrink-0">{trailing}</span>}
      {href ? (
        <Link href={href} className={overlay}>
          <span className="sr-only">{selectLabel}</span>
        </Link>
      ) : onSelect ? (
        <button type="button" onClick={onSelect} aria-label={selectLabel} className={overlay} />
      ) : null}
    </div>
  );
}

export { DataList, DataRow };
