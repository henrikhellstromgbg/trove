'use client';

import * as React from 'react';
import { Upload } from '@/components/icons';
import { cn } from '@/lib/cn';

interface FileUploadProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label: string;
  description?: string;
  error?: string;
  onFilesChange?: (files: File[]) => void;
}

const FileUpload = React.forwardRef<HTMLInputElement, FileUploadProps>(
  ({ label, description, error, onFilesChange, className, disabled, id, ...props }, forwardedRef) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const descriptionId = description ? `${inputId}-description` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;
    const [dragging, setDragging] = React.useState(false);

    const emitFiles = (list: FileList | null) => onFilesChange?.(Array.from(list ?? []));

    return (
      <div className={cn('flex flex-col gap-[var(--space-2)]', className)}>
        <label htmlFor={inputId} className="text-[length:var(--text-sm)] font-medium text-[var(--color-text-primary)]">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-[length:var(--text-sm)] text-[var(--color-text-tertiary)]">
            {description}
          </p>
        )}
        <label
          htmlFor={inputId}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!disabled) emitFiles(event.dataTransfer.files);
          }}
          className={cn(
            'relative flex min-h-32 cursor-pointer flex-col items-center justify-center gap-[var(--space-2)]',
            'rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] p-[var(--space-6)]',
            'bg-[var(--color-surface)] text-center transition-colors duration-[var(--duration-fast)]',
            'hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]',
            'focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)] focus-within:ring-offset-2',
            dragging && 'bg-[var(--color-brand-subtle)]',
            disabled && 'cursor-not-allowed opacity-50',
            error && 'border-[var(--color-status-error)]',
          )}
        >
          <Upload size={24} aria-hidden="true" />
          <span className="text-[length:var(--text-sm)] font-medium text-[var(--color-text-primary)]">
            Choose files or drop them here
          </span>
          <input
            ref={forwardedRef}
            id={inputId}
            type="file"
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            onChange={(event) => emitFiles(event.currentTarget.files)}
            {...props}
          />
        </label>
        {error && (
          <p id={errorId} role="alert" className="text-[length:var(--text-sm)] text-[var(--color-status-error-text)]">
            {error}
          </p>
        )}
      </div>
    );
  },
);
FileUpload.displayName = 'FileUpload';

export { FileUpload };
export type { FileUploadProps };
