'use client';

// FormField wires label, hint, and error to the control with correct
// htmlFor/id and aria-describedby (rules A4, N8, N9, A11).
// Always use FormField for form inputs; never a bare <Input> with placeholder-as-label.

import * as React from 'react';
import { ErrorFilled } from '@carbon/icons-react';
import { cn } from '@/lib/cn';

/* ---------- Label ---------- */
const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'text-[length:var(--text-sm)] font-medium text-[var(--color-text-primary)]',
        'peer-disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Label.displayName = 'Label';

/* ---------- Input ---------- */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      {...props}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={cn(
        'flex h-11 w-full rounded-[var(--radius-sm)] px-3',
        'bg-[var(--color-surface)] text-[length:var(--text-sm)] text-[var(--color-text-primary)]',
        'border border-[var(--color-border)]',
        'placeholder:text-[var(--color-text-tertiary)]',
        'transition-colors duration-[var(--duration-fast)]',
        'hover:border-[var(--color-border-strong)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-[var(--color-status-error)]',
        className
      )}
    />
  )
);
Input.displayName = 'Input';

/* ---------- Textarea ---------- */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    {...props}
    aria-invalid={invalid || props['aria-invalid'] || undefined}
    className={cn(
      'flex min-h-24 w-full rounded-[var(--radius-sm)] px-3 py-2',
      'bg-[var(--color-surface)] text-[length:var(--text-sm)] text-[var(--color-text-primary)]',
      'border border-[var(--color-border)]',
      'placeholder:text-[var(--color-text-tertiary)]',
      'transition-colors duration-[var(--duration-fast)]',
      'hover:border-[var(--color-border-strong)]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      invalid && 'border-[var(--color-status-error)]',
      className
    )}
  />
));
Textarea.displayName = 'Textarea';

/* ---------- FormField ---------- */
export interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactElement;
  className?: string;
}

function FormField({ label, hint, error, required, children, className }: FormFieldProps) {
  const id = React.useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const childProps = (children as React.ReactElement<Record<string, unknown>>).props;
  const existingDescribedBy = childProps['aria-describedby'] as string | undefined;
  const describedBy = [existingDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-[var(--space-2)]', className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-[var(--color-status-error-text)]">*</span>
        )}
      </Label>
      {hint && (
        <p id={hintId} className="text-[length:var(--text-sm)] text-[var(--color-text-tertiary)]">
          {hint}
        </p>
      )}
      {React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id,
        'aria-describedby': describedBy,
        invalid: Boolean(error) || undefined,
        required: required || undefined,
      })}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-[length:var(--text-sm)] text-[var(--color-status-error-text)]"
        >
          <ErrorFilled size={16} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export { Label, Input, Textarea, FormField };
