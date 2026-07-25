import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckmarkFilled, ErrorFilled, InformationFilled, WarningFilled } from '@carbon/icons-react';
import { cn } from '@/lib/cn';

// Inline alert / banner. Color always paired with icon and text (N9).
// Error/warning alerts get role=alert so they are announced.

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

const ICON = { error: ErrorFilled, warning: WarningFilled, success: CheckmarkFilled, info: InformationFilled } as const;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string;
}

function Alert({ className, variant = 'info', title, children, ...props }: AlertProps) {
  const Icon = ICON[variant ?? 'info'];
  const role = variant === 'error' || variant === 'warning' ? 'alert' : 'status';
  return (
    <div role={role} className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="[&_a]:underline">{children}</div>}
      </div>
    </div>
  );
}

export { Alert };
