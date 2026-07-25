"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"

import { cn } from "@/lib/cn"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkmark, Search } from "@/components/icons"

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface-raised)] p-[var(--space-1)] text-[var(--color-text-primary)]",
        className
      )}
      {...props}
    />
  )
}

function CommandDialog({
  title = "Command palette",
  description = "Search for a command to run",
  children,
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn(
          "top-1/3 translate-y-0 overflow-hidden rounded-[var(--radius-lg)] p-0",
          !showCloseButton && "[&>button]:hidden",
          className
        )}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="p-[var(--space-1)] pb-0">
      <div
        className={cn(
          "flex min-h-[var(--touch-target-min)] items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-3)]",
          "border border-[var(--color-border)] bg-[var(--color-surface)]",
          "transition-colors duration-[var(--duration-fast)] focus-within:border-[var(--color-border-strong)] focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)]"
        )}
      >
        <Search className="size-4 shrink-0 text-[var(--color-text-tertiary)]" aria-hidden="true" />
        <CommandPrimitive.Input
          data-slot="command-input"
          className={cn(
            "min-h-[var(--touch-target-min)] w-full bg-transparent text-[length:var(--text-sm)] text-[var(--color-text-primary)]",
            "placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
      </div>
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn(
        "py-[var(--space-6)] text-center text-[length:var(--text-sm)] text-[var(--color-text-secondary)]",
        className
      )}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-[var(--space-1)] text-[var(--color-text-primary)]",
        "**:[[cmdk-group-heading]]:px-[var(--space-2)] **:[[cmdk-group-heading]]:py-[var(--space-2)]",
        "**:[[cmdk-group-heading]]:text-[length:var(--text-sm)] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-[var(--color-text-secondary)]",
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-[var(--space-1)] h-px bg-[var(--color-border-subtle)]", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "group/command-item relative flex min-h-[var(--touch-target-min)] cursor-pointer items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-2)]",
        "text-[length:var(--text-sm)] text-[var(--color-text-primary)] select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
        "data-selected:bg-[var(--color-surface-hover)] data-selected:text-[var(--color-text-primary)]",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-selected:*:[svg]:text-[var(--color-text-primary)]",
        className
      )}
      {...props}
    >
      {children}
      <Checkmark
        className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100"
        aria-hidden="true"
      />
    </CommandPrimitive.Item>
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto text-[length:var(--text-sm)] text-[var(--color-text-tertiary)] group-data-selected/command-item:text-[var(--color-text-secondary)]",
        className
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
