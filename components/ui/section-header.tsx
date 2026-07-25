import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  action?: ReactNode;
}

export function SectionHeader({ title, action, className, ...props }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)} {...props}>
      <h2 className="text-base font-medium text-[var(--color-text-primary)]">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
