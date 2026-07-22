import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./class-names";

export interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({
  title,
  description,
  action,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cx(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-medium tracking-normal text-ink md:text-[30px]">
          {title}
        </h1>
        {description ? (
          <div className="text-sm text-ink-dim">{description}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
