import * as React from 'react';
import { cn } from '@/lib/cn';

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  action?: React.ReactNode;
  headingId?: string;
}

function SectionHeader({ title, action, headingId, className, ...props }: SectionHeaderProps) {
  return (
    <header
      className={cn('flex items-center justify-between gap-[var(--space-4)]', className)}
      {...props}
    >
      <h2 id={headingId} className="text-[length:var(--text-lg)] font-semibold leading-[var(--leading-md)] text-[var(--color-text-primary)]">
        {title}
      </h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export { SectionHeader };
