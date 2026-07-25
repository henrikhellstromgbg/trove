"use client"

import * as React from "react"
import {
  DayPicker,
  DayButton,
  getDefaultClassNames,
  type Locale,
} from "react-day-picker"

import { cn } from "@/lib/cn"
import { buttonVariants, type ButtonProps } from "@/components/ui/button"
import { ChevronDown, ChevronLeft, ChevronRight } from "@/components/icons"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: ButtonProps["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "group/calendar bg-[var(--color-surface)] p-[var(--space-2)] text-[var(--color-text-primary)]",
        "[--cell-radius:var(--radius-sm)] [--cell-size:var(--touch-target-min)]",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString(locale?.code, { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-[var(--space-4)] md:flex-row",
          defaultClassNames.months
        ),
        month: cn("flex w-full flex-col gap-[var(--space-4)]", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-[var(--space-1)]",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant, size: "icon" }),
          "size-(--cell-size) min-h-(--cell-size) cursor-pointer p-0 select-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant, size: "icon" }),
          "size-(--cell-size) min-h-(--cell-size) cursor-pointer p-0 select-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-[var(--space-2)] text-[length:var(--text-sm)] font-medium",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative rounded-[var(--cell-radius)]",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "absolute inset-0 cursor-pointer bg-[var(--color-surface-raised)] opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "font-medium select-none text-[var(--color-text-primary)]",
          captionLayout === "label"
            ? "text-[length:var(--text-sm)]"
            : "flex min-h-[var(--touch-target-min)] items-center gap-[var(--space-1)] rounded-[var(--cell-radius)] px-[var(--space-2)] text-[length:var(--text-sm)] [&>svg]:size-4 [&>svg]:text-[var(--color-text-tertiary)]",
          defaultClassNames.caption_label
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 rounded-[var(--cell-radius)] text-[length:var(--text-sm)] font-normal text-[var(--color-text-secondary)] select-none",
          defaultClassNames.weekday
        ),
        week: cn("mt-[var(--space-2)] flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-(--cell-size) select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-[length:var(--text-sm)] text-[var(--color-text-secondary)] select-none",
          defaultClassNames.week_number
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full rounded-[var(--cell-radius)] p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-[var(--cell-radius)]",
          props.showWeekNumber
            ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-[var(--cell-radius)]"
            : "[&:first-child[data-selected=true]_button]:rounded-l-[var(--cell-radius)]",
          defaultClassNames.day
        ),
        range_start: cn(
          "relative isolate rounded-l-[var(--cell-radius)] bg-[var(--color-brand-subtle)] after:absolute after:inset-y-0 after:right-0 after:w-[var(--space-4)] after:bg-[var(--color-brand-subtle)]",
          defaultClassNames.range_start
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn(
          "relative isolate rounded-r-[var(--cell-radius)] bg-[var(--color-brand-subtle)] after:absolute after:inset-y-0 after:left-0 after:w-[var(--space-4)] after:bg-[var(--color-brand-subtle)]",
          defaultClassNames.range_end
        ),
        today: cn(
          "rounded-[var(--cell-radius)] bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] data-[selected=true]:rounded-none",
          defaultClassNames.today
        ),
        outside: cn(
          "text-[var(--color-text-tertiary)] aria-selected:text-[var(--color-text-secondary)]",
          defaultClassNames.outside
        ),
        disabled: cn(
          "cursor-not-allowed text-[var(--color-text-disabled)] opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeft className={cn("size-4", className)} aria-hidden="true" {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRight className={cn("size-4", className)} aria-hidden="true" {...props} />
            )
          }

          return (
            <ChevronDown className={cn("size-4", className)} aria-hidden="true" {...props} />
          )
        },
        DayButton: ({ ...props }) => (
          <CalendarDayButton locale={locale} {...props} />
        ),
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "relative isolate flex aspect-square size-auto min-h-(--cell-size) w-full min-w-(--cell-size) cursor-pointer flex-col gap-[var(--space-1)] border-0 leading-none font-normal",
        "rounded-[var(--cell-radius)] text-[length:var(--text-sm)] text-[var(--color-text-primary)] transition-colors duration-[var(--duration-fast)]",
        "hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] disabled:cursor-not-allowed disabled:opacity-50",
        "group-data-[focused=true]/day:ring-2 group-data-[focused=true]/day:ring-[var(--color-focus-ring)]",
        "data-[range-end=true]:rounded-[var(--cell-radius)] data-[range-end=true]:rounded-r-[var(--cell-radius)] data-[range-end=true]:bg-[var(--color-action)] data-[range-end=true]:text-[var(--color-action-text)]",
        "data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-[var(--color-brand-subtle)] data-[range-middle=true]:text-[var(--color-text-primary)]",
        "data-[range-start=true]:rounded-[var(--cell-radius)] data-[range-start=true]:rounded-l-[var(--cell-radius)] data-[range-start=true]:bg-[var(--color-action)] data-[range-start=true]:text-[var(--color-action-text)]",
        "data-[selected-single=true]:bg-[var(--color-action)] data-[selected-single=true]:text-[var(--color-action-text)] [&>span]:text-[length:var(--text-sm)] [&>span]:opacity-70",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
