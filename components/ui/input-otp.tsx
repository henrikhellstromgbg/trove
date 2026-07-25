"use client"

import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"

import { cn } from "@/lib/cn"

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "cn-input-otp flex items-center has-disabled:opacity-50",
        containerClassName
      )}
      spellCheck={false}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn(
        "flex items-center rounded-[var(--radius-sm)] has-aria-invalid:ring-2 has-aria-invalid:ring-[var(--color-status-error)]",
        className
      )}
      {...props}
    />
  )
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number
}) {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "relative flex size-11 items-center justify-center border-y border-r border-[var(--color-border)]",
        "bg-[var(--color-surface)] text-[length:var(--text-sm)] text-[var(--color-text-primary)]",
        "transition-colors duration-[var(--duration-fast)] first:rounded-l-[var(--radius-sm)] first:border-l last:rounded-r-[var(--radius-sm)]",
        "aria-invalid:border-[var(--color-status-error)] data-[active=true]:border-[var(--color-focus-ring)] data-[active=true]:ring-2 data-[active=true]:ring-[var(--color-focus-ring)]",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-[var(--color-text-primary)] duration-[var(--duration-slow)]" />
        </div>
      )}
    </div>
  )
}

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-separator"
      className="flex items-center px-[var(--space-2)]"
      role="separator"
      {...props}
    >
      <span aria-hidden="true" className="h-px w-3 bg-[var(--color-border-strong)]" />
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
