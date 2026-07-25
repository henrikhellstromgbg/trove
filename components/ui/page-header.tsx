import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ title, description, action, className, ...props }: PageHeaderProps) {
  return (
    <div
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}
      {...props}
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)] md:text-[length:var(--text-3xl)]">
          {title}
        </h1>
        {description ? (
          <div className="text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">{description}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
