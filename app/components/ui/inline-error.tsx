import type { HTMLAttributes } from "react";
import { cx } from "./class-names";

export interface InlineErrorProps extends HTMLAttributes<HTMLParagraphElement> {
  message?: string | null;
}

export function InlineError({ message, className, ...props }: InlineErrorProps) {
  if (!message) return null;

  return (
    <p
      role="alert"
      aria-live="polite"
      className={cx("text-sm text-brand", className)}
      {...props}
    >
      {message}
    </p>
  );
}
