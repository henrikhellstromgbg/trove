'use client';

import * as React from 'react';
import type { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DatePickerProps {
  value?: Date;
  onValueChange?: (date: Date | undefined) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function DatePicker({
  value,
  onValueChange,
  label = 'Choose date',
  placeholder = 'Select date',
  disabled,
  className,
}: DatePickerProps) {
  return (
    <div className={cn('w-full', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="secondary" disabled={disabled} aria-label={label}>
            <CalendarIcon size={16} aria-hidden="true" />
            <span className={!value ? 'text-[var(--color-text-tertiary)]' : undefined}>
              {value ? value.toLocaleDateString() : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-[var(--space-2)]" align="start">
          <Calendar mode="single" selected={value} onSelect={onValueChange} autoFocus />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface DateRangePickerProps extends Omit<DatePickerProps, 'value' | 'onValueChange'> {
  value?: DateRange;
  onValueChange?: (range: DateRange | undefined) => void;
}

function DateRangePicker({ value, onValueChange, label = 'Choose date range', placeholder = 'Select dates', disabled, className }: DateRangePickerProps) {
  const valueLabel = value?.from
    ? value.to
      ? `${value.from.toLocaleDateString()} to ${value.to.toLocaleDateString()}`
      : value.from.toLocaleDateString()
    : placeholder;

  return (
    <div className={cn('w-full', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="secondary" disabled={disabled} aria-label={label}>
            <CalendarIcon size={16} aria-hidden="true" />
            <span className={!value?.from ? 'text-[var(--color-text-tertiary)]' : undefined}>{valueLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-[var(--space-2)]" align="start">
          <Calendar mode="range" selected={value} onSelect={onValueChange} numberOfMonths={2} autoFocus />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { DatePicker, DateRangePicker };
export type { DatePickerProps, DateRangePickerProps };
