import type { HTMLAttributes } from "react";
import { cx } from "./class-names";

export type PageFrameMaxWidth = "4xl" | "5xl";

export interface PageFrameProps extends HTMLAttributes<HTMLElement> {
  maxWidth?: PageFrameMaxWidth;
}

const maxWidthClasses: Record<PageFrameMaxWidth, string> = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
};

export function PageFrame({
  maxWidth = "4xl",
  className,
  ...props
}: PageFrameProps) {
  return (
    <section
      className={cx(
        "relative mx-auto flex w-full flex-col gap-8 px-6 pb-16 pt-16 md:px-10",
        maxWidthClasses[maxWidth],
        className,
      )}
      {...props}
    />
  );
}
