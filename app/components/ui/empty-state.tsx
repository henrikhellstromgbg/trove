import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./class-names";

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  message: string;
  action?: ReactNode;
}

export function EmptyState({
  message,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cx("flex flex-col items-start gap-3 text-sm text-ink-dim", className)}
      {...props}
    >
      <p>{message}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
