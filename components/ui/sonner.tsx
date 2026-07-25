"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CheckmarkFilled,
  ErrorFilled,
  InformationFilled,
  WarningFilled,
} from "@/components/icons"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CheckmarkFilled className="size-4 text-[var(--color-status-success)]" aria-hidden="true" />
        ),
        info: (
          <InformationFilled className="size-4 text-[var(--color-status-info)]" aria-hidden="true" />
        ),
        warning: (
          <WarningFilled className="size-4 text-[var(--color-status-warning)]" aria-hidden="true" />
        ),
        error: (
          <ErrorFilled className="size-4 text-[var(--color-status-error)]" aria-hidden="true" />
        ),
        loading: (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-[var(--radius-full)] border-2 border-[var(--color-border-strong)] border-t-[var(--color-text-primary)]"
          />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--color-surface-raised)",
          "--normal-text": "var(--color-text-primary)",
          "--normal-border": "var(--color-border)",
          "--border-radius": "var(--radius-md)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast text-[length:var(--text-sm)] shadow-[var(--shadow-md)]",
          description: "text-[var(--color-text-secondary)]",
          actionButton: "cursor-pointer bg-[var(--color-action)] text-[var(--color-action-text)]",
          cancelButton: "cursor-pointer bg-[var(--color-surface)] text-[var(--color-text-primary)]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
