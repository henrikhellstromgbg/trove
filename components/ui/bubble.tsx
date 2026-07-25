import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/cn"

function BubbleGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-group"
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...props}
    />
  )
}

const bubbleVariants = cva(
  "group/bubble relative flex w-fit max-w-[80%] min-w-0 flex-col gap-1 group-data-[align=end]/message:self-end data-[align=end]:self-end data-[variant=ghost]:max-w-full",
  {
    variants: {
      variant: {
        default:
          "*:data-[slot=bubble-content]:bg-[var(--color-action)] *:data-[slot=bubble-content]:text-[var(--color-action-text)] [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[var(--color-action-hover)]",
        secondary:
          "*:data-[slot=bubble-content]:bg-[var(--color-surface)] *:data-[slot=bubble-content]:text-[var(--color-text-primary)] [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[var(--color-surface-hover)]",
        muted:
          "*:data-[slot=bubble-content]:bg-[var(--color-surface-sunken)] *:data-[slot=bubble-content]:text-[var(--color-text-secondary)] [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[var(--color-surface-hover)]",
        tinted:
          "*:data-[slot=bubble-content]:bg-[var(--color-brand-subtle)] *:data-[slot=bubble-content]:text-[var(--color-text-primary)] [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[var(--color-surface-hover)]",
        outline:
          "*:data-[slot=bubble-content]:border-[var(--color-border)] *:data-[slot=bubble-content]:bg-[var(--color-surface)] [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[var(--color-surface-hover)] [&>[data-slot=bubble-content]:is(button,a):hover]:text-[var(--color-text-primary)]",
        ghost:
          "border-none *:data-[slot=bubble-content]:rounded-none *:data-[slot=bubble-content]:bg-transparent *:data-[slot=bubble-content]:p-0 [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[var(--color-surface-hover)] [&>[data-slot=bubble-content]:is(button,a):hover]:text-[var(--color-text-primary)]",
        destructive:
          "*:data-[slot=bubble-content]:border-[var(--color-status-error-border)] *:data-[slot=bubble-content]:bg-[var(--color-status-error-bg)] *:data-[slot=bubble-content]:text-[var(--color-status-error-text)] [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[var(--color-surface-hover)] [&>[data-slot=bubble-content]:is(button,a):hover]:text-[var(--color-text-primary)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Bubble({
  variant = "default",
  align = "start",
  className,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof bubbleVariants> & {
    align?: "start" | "end"
  }) {
  return (
    <div
      data-slot="bubble"
      data-variant={variant}
      data-align={align}
      className={cn(bubbleVariants({ variant }), className)}
      {...props}
    />
  )
}

function BubbleContent({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : "div"

  return (
    <Comp
      data-slot="bubble-content"
      className={cn(
        "w-fit max-w-full min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-transparent px-3 py-2 text-sm leading-relaxed wrap-break-word group-data-[align=end]/bubble:self-end [button]:min-h-[var(--touch-target-min)] [button]:cursor-pointer [button]:text-left [button,a]:transition-colors [button,a]:duration-[var(--duration-fast)]",
        className
      )}
      {...props}
    />
  )
}

const bubbleReactionsVariants = cva(
  "absolute z-[var(--z-dropdown)] flex w-fit shrink-0 items-center justify-center gap-1 rounded-[var(--radius-full)] bg-[var(--color-surface-sunken)] px-1.5 py-0.5 text-sm text-[var(--color-text-secondary)] ring-3 ring-[var(--color-surface)] has-[button]:p-0",
  {
    variants: {
      side: {
        top: "top-0 -translate-y-3/4",
        bottom: "bottom-0 translate-y-3/4",
      },
      align: {
        start: "left-3",
        end: "right-3",
      },
    },
    defaultVariants: {
      side: "bottom",
      align: "end",
    },
  }
)

function BubbleReactions({
  side = "bottom",
  align = "end",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  align?: "start" | "end"
  side?: "top" | "bottom"
}) {
  return (
    <div
      data-slot="bubble-reactions"
      data-align={align}
      data-side={side}
      className={cn(bubbleReactionsVariants({ side, align }), className)}
      {...props}
    />
  )
}

export { BubbleGroup, Bubble, BubbleContent, BubbleReactions }
