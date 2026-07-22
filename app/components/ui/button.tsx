import type { ButtonHTMLAttributes, Ref } from "react";
import { cx } from "./class-names";

export type ButtonVariant = "primary" | "secondary" | "destructive";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const base =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-dim focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-ink text-canvas hover:bg-ink-dim",
  secondary:
    "border border-line-strong bg-paper text-ink hover:border-ink",
  destructive: "text-brand hover:bg-ink/[0.03]",
};

export function Button({
  variant = "primary",
  type = "button",
  className,
  ref,
  ...props
}: ButtonProps & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(base, variantClasses[variant], className)}
      {...props}
    />
  );
}
