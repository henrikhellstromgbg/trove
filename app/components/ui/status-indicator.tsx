import type { HTMLAttributes } from "react";
import { cx } from "./class-names";

export type Status =
  | "active"
  | "paused"
  | "error"
  | "review"
  | "success"
  | "approved";

export interface StatusIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  status: Status;
  label: string;
  count?: number;
}

const statusClasses: Record<Status, string> = {
  active: "text-ink-dim",
  paused: "text-ink-ghost",
  error: "text-brand",
  review: "text-brand",
  success: "text-capture",
  approved: "text-capture",
};

export function StatusIndicator({
  status,
  label,
  count,
  className,
  ...props
}: StatusIndicatorProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 text-sm",
        statusClasses[status],
        className,
      )}
      {...props}
    >
      {count !== undefined ? (
        <span className="font-mono tabular-nums text-xs">{count}</span>
      ) : null}
      <span>{label}</span>
    </span>
  );
}
