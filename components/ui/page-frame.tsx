import * as React from 'react';
import { cn } from '@/lib/cn';

export type PageFrameMaxWidth = '4xl' | '5xl';

export interface PageFrameProps extends React.HTMLAttributes<HTMLElement> {
  maxWidth?: PageFrameMaxWidth;
}

const maxWidthClasses: Record<PageFrameMaxWidth, string> = {
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
};

function PageFrame({ maxWidth = '4xl', className, ...props }: PageFrameProps) {
  return (
    <main
      className={cn(
        'mx-auto flex w-full flex-col gap-[var(--space-8)]',
        'px-[var(--space-6)] py-[var(--space-12)] md:px-[var(--space-10)] md:py-[var(--space-16)]',
        maxWidthClasses[maxWidth],
        className
      )}
      {...props}
    />
  );
}

export { PageFrame };
