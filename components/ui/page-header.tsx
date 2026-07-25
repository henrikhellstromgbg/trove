import * as React from 'react';
import { cn } from '@/lib/cn';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

function PageHeader({ title, description, action, className, ...props }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-[var(--space-4)] sm:flex-row sm:items-end sm:justify-between',
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-[var(--space-2)]">
        <h1 className="text-[length:var(--text-3xl)] font-semibold leading-[var(--leading-tight)] tracking-[var(--tracking-tight)] text-[var(--color-text-primary)]">
          {title}
        </h1>
        {description ? (
          <div className="text-[length:var(--text-base)] leading-[var(--leading-sm)] text-[var(--color-text-secondary)]">
            {description}
          </div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export { PageHeader };
