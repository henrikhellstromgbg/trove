import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';
import { ErrorFilled } from '@/components/icons';
import { cn } from '@/lib/cn';

// Label + control + error field controls, on base-ds tokens. Controls rely on
// the global :focus-visible ring. Error text uses --color-status-*-text (clears
// the 75 APCA text tier) and pairs colour with an icon and text (N9).

export interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  htmlFor: string;
  children: ReactNode;
}

export function FieldLabel({ className, children, ...props }: FieldLabelProps) {
  return (
    <label
      className={cn(
        'block text-[length:var(--text-sm)] font-medium text-[var(--color-text-primary)]',
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}

export interface FieldErrorProps {
  id?: string;
  message?: string | null;
  className?: string;
}

export function FieldError({ id, message, className }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5 text-[length:var(--text-sm)] text-[var(--color-status-error-text)]',
        className,
      )}
    >
      <ErrorFilled size={16} aria-hidden="true" />
      {message}
    </p>
  );
}

const fieldBase =
  'w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--color-border-strong)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-[var(--color-status-error)]';

function describedBy(error: string | null | undefined, errorId: string, ariaDescribedBy?: string) {
  return cn(error ? errorId : undefined, ariaDescribedBy) || undefined;
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label?: string;
  error?: string | null;
  containerClassName?: string;
}

export function TextField({
  id,
  label,
  error,
  className,
  containerClassName,
  'aria-describedby': ariaDescribedBy,
  ...props
}: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      <input
        id={id}
        className={cn(fieldBase, 'h-11', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(error, errorId, ariaDescribedBy)}
        {...props}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id: string;
  label?: string;
  error?: string | null;
  containerClassName?: string;
}

export function TextArea({
  id,
  label,
  error,
  className,
  containerClassName,
  'aria-describedby': ariaDescribedBy,
  ...props
}: TextAreaProps) {
  const errorId = `${id}-error`;
  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      <textarea
        id={id}
        className={cn(fieldBase, 'min-h-24', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(error, errorId, ariaDescribedBy)}
        {...props}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}
