import * as React from 'react';
import { cn } from '@/lib/cn';

export type AsyncStateStatus = 'loading' | 'error' | 'empty' | 'ready';

export interface AsyncStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  status: AsyncStateStatus;
  loading: React.ReactNode;
  error: React.ReactNode;
  empty: React.ReactNode;
  children: React.ReactNode;
}

function AsyncState({ status, loading, error, empty, children, className, ...props }: AsyncStateProps) {
  const content = {
    loading,
    error,
    empty,
    ready: children,
  }[status];

  return (
    <div
      className={cn('min-w-0', className)}
      aria-busy={status === 'loading' || undefined}
      {...props}
    >
      {content}
    </div>
  );
}

export { AsyncState };
