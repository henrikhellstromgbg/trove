import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cx } from "./class-names";

export type DataListProps = HTMLAttributes<HTMLDivElement>;

export function DataList({ className, ...props }: DataListProps) {
  return <div role="list" className={cx("divide-y divide-line", className)} {...props} />;
}

interface DataRowCommonProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  leading?: ReactNode;
  trailing?: ReactNode;
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
  /** Accessible name for the overlay control — the visible text sits outside it. */
  selectLabel: string;
}

interface ButtonDataRowProps extends DataRowCommonProps {
  href?: undefined;
  /** Makes the row a button; the row content becomes the click target via a stretched overlay. */
  onSelect: () => void;
  /** Accessible name for the overlay control — the visible text sits outside it. */
  selectLabel: string;
}

export type DataRowProps = StaticDataRowProps | LinkDataRowProps | ButtonDataRowProps;

export function DataRow({
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
      className={cx(
        "relative flex items-center gap-3 py-3 first:pt-0 last:pb-0",
        interactive && "transition-colors hover:bg-ink/[0.03]",
        className,
      )}
      {...props}
    >
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <div className="min-w-0 flex-1 text-sm text-ink">{children}</div>
      {trailing ? <span className="relative z-10 shrink-0">{trailing}</span> : null}
      {href ? (
        <Link
          href={href}
          className="absolute inset-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-dim"
        >
          <span className="sr-only">{selectLabel}</span>
        </Link>
      ) : onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-label={selectLabel}
          className="absolute inset-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-dim"
        />
      ) : null}
    </div>
  );
}
