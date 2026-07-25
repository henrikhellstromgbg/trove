import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckmarkFilled, ErrorFilled, InformationFilled, WarningFilled } from '@carbon/icons-react';
import { cn } from '@/lib/cn';

// Status badges always pair color with an icon (rule N9).

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1.5 rounded-[var(--radius-full)] px-2.5 py-0.5',
    'text-[length:var(--text-sm)] font-medium',
  ],
  {
    variants: {
      variant: {
        neutral: 'bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]',
        error: 'bg-[var(--color-status-error-bg)] text-[var(--color-status-error-text)] border border-[var(--color-status-error-border)]',
        warning: 'bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)] border border-[var(--color-status-warning-border)]',
        success: 'bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)] border border-[var(--color-status-success-border)]',
        info: 'bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)] border border-[var(--color-status-info-border)]',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
);

const STATUS_ICON = {
  error: ErrorFilled,
  warning: WarningFilled,
  success: CheckmarkFilled,
  info: InformationFilled,
  neutral: null,
} as const;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  showIcon?: boolean;
}

function Badge({ className, variant = 'neutral', showIcon = true, children, ...props }: BadgeProps) {
  const Icon = variant ? STATUS_ICON[variant] : null;
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {showIcon && Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
