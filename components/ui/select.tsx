'use client';

// Styled Radix Select. The trigger deliberately matches the Input control in
// form-field.tsx so a select and a text input sit level in the same form.
//
// FormField clones its child with { id, aria-describedby, invalid, required },
// so Select forwards those onto the trigger and root: label association and
// error wiring work the same as for Input (A4, N8).

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, Checkmark } from '@/components/icons';
import { cn } from '@/lib/cn';

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  invalid?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  className?: string;
  children: React.ReactNode;
}

function Select({
  value,
  defaultValue,
  onValueChange,
  placeholder,
  disabled,
  required,
  name,
  id,
  invalid,
  className,
  children,
  ...aria
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      required={required}
      name={name}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-describedby={aria['aria-describedby']}
        aria-invalid={invalid || aria['aria-invalid'] || undefined}
        className={cn(
          'flex h-11 w-full cursor-pointer items-center justify-between gap-2',
          'rounded-[var(--radius-sm)] px-3',
          'bg-[var(--color-surface)] text-[length:var(--text-sm)] text-[var(--color-text-primary)]',
          'border border-[var(--color-border)]',
          'data-[placeholder]:text-[var(--color-text-tertiary)]',
          'transition-colors duration-[var(--duration-fast)]',
          'hover:border-[var(--color-border-strong)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalid && 'border-[var(--color-status-error)]',
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown size={16} className="shrink-0 text-[var(--color-text-tertiary)]" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-[var(--z-dropdown)] max-h-[var(--radix-select-content-available-height)]',
            'min-w-[var(--radix-select-trigger-width)] overflow-hidden',
            'rounded-[var(--radius-sm)] border border-[var(--color-border)]',
            'bg-[var(--color-surface-raised)] shadow-[var(--shadow-md)]'
          )}
        >
          <SelectPrimitive.Viewport className="p-[var(--space-1)]">{children}</SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export type SelectItemProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center rounded-[var(--radius-sm)]',
      'py-2 pl-8 pr-3',
      'text-[length:var(--text-sm)] text-[var(--color-text-primary)]',
      'data-[highlighted]:bg-[var(--color-surface-hover)]',
      'focus-visible:bg-[var(--color-surface-hover)]',
      'data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 inline-flex items-center">
      <SelectPrimitive.ItemIndicator>
        <Checkmark size={16} aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

export { Select, SelectItem };
