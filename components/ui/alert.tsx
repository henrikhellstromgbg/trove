import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckmarkFilled, ErrorFilled, InformationFilled, WarningFilled } from '@/components/icons';
import { cn } from '@/lib/cn';

// Inline alert / banner. Color is always paired with an icon and text (N9).
// Error and warning alerts use role=alert so they are announced immediately.

const alertVariants = cva(
  'flex gap-3 rounded-[var(--radius-md)] border p-[var(--space-4)] text-[length:var(--text-sm)]',
  {
    variants: {
      variant: {
        error: 'bg-[var(--color-status-error-bg)] border-[var(--color-status-error-border)] text-[var(--color-status-error-text)]',
        warning: 'bg-[var(--color-status-warning-bg)] border-[var(--color-status-warning-border)] text-[var(--color-status-warning-text)]',
        success: 'bg-[var(--color-status-success-bg)] border-[var(--color-status-success-border)] text-[var(--color-status-success-text)]',
        info: 'bg-[var(--color-status-info-bg)] border-[var(--color-status-info-border)] text-[var(--color-status-info-text)]',
      },
    },
    defaultVariants: { variant: 'info' },
  }
);

const ICON = {
  error: ErrorFilled,
  warning: WarningFilled,
  success: CheckmarkFilled,
  info: InformationFilled,
} as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

function Alert({ className, variant = 'info', title, children, role, ...props }: AlertProps) {
  const Icon = ICON[variant ?? 'info'];
  const defaultRole = variant === 'error' || variant === 'warning' ? 'alert' : 'status';
  const hasComposableChild = React.Children.toArray(children).some(
    (child) =>
      React.isValidElement(child) &&
      (child.type === AlertTitle || child.type === AlertDescription || child.type === AlertAction)
  );

  return (
    <div
      data-slot="alert"
      role={role ?? defaultRole}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <AlertTitle>{title}</AlertTitle>}
        {hasComposableChild ? children : children && <AlertDescription>{children}</AlertDescription>}
      </div>
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn('font-semibold', className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn('[&_a]:underline', className)}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-action"
      className={cn('mt-[var(--space-2)] flex items-center gap-[var(--space-2)]', className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction, alertVariants };
