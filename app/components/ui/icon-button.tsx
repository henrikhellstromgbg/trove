import type { ButtonHTMLAttributes, Ref } from "react";
import { cx } from "./class-names";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "aria-label"> {
  label: string;
  title?: string;
}

export function IconButton({
  label,
  title,
  className,
  children,
  ref,
  ...props
}: IconButtonProps & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={title ?? label}
      className={cx(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-ink/[0.05] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-dim focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:w-9",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
