import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "./class-names";

export interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  htmlFor: string;
  children: ReactNode;
}

export function FieldLabel({ className, children, ...props }: FieldLabelProps) {
  return (
    <label
      className={cx("block text-sm font-medium text-ink", className)}
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
    <p id={id} role="alert" aria-live="polite" className={cx("text-sm text-brand", className)}>
      {message}
    </p>
  );
}

const fieldBase =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-dim disabled:cursor-not-allowed disabled:opacity-50";

function describedBy(error: string | null | undefined, errorId: string, ariaDescribedBy?: string) {
  return cx(error ? errorId : undefined, ariaDescribedBy) || undefined;
}

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
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
  "aria-describedby": ariaDescribedBy,
  ...props
}: TextFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className={cx("flex flex-col gap-1.5", containerClassName)}>
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      <input
        id={id}
        className={cx(fieldBase, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(error, errorId, ariaDescribedBy)}
        {...props}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
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
  "aria-describedby": ariaDescribedBy,
  ...props
}: TextAreaProps) {
  const errorId = `${id}-error`;

  return (
    <div className={cx("flex flex-col gap-1.5", containerClassName)}>
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      <textarea
        id={id}
        className={cx(fieldBase, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(error, errorId, ariaDescribedBy)}
        {...props}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  id: string;
  label?: string;
  error?: string | null;
  containerClassName?: string;
}

export function Select({
  id,
  label,
  error,
  className,
  containerClassName,
  children,
  "aria-describedby": ariaDescribedBy,
  ...props
}: SelectProps) {
  const errorId = `${id}-error`;

  return (
    <div className={cx("flex flex-col gap-1.5", containerClassName)}>
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      <select
        id={id}
        className={cx(fieldBase, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(error, errorId, ariaDescribedBy)}
        {...props}
      >
        {children}
      </select>
      <FieldError id={errorId} message={error} />
    </div>
  );
}
