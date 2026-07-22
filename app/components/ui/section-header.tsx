import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./class-names";

export interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  action?: ReactNode;
}

export function SectionHeader({
  title,
  action,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cx("flex items-center justify-between gap-4", className)}
      {...props}
    >
      <h2 className="text-base font-medium text-ink">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
