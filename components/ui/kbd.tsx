import { cn } from "@/lib/cn"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-6 w-fit min-w-6 items-center justify-center gap-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] px-1 font-sans text-sm font-medium text-[var(--color-text-secondary)] select-none in-data-[slot=tooltip-content]:bg-[var(--color-surface)] in-data-[slot=tooltip-content]:text-[var(--color-text-primary)] [&_svg:not([class*='size-'])]:size-3",
        className
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup }
