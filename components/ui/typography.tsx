import * as React from 'react';
import { cn } from '@/lib/cn';

type HeadingLevel = 1 | 2 | 3 | 4;

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel;
}

const headingSizes: Record<HeadingLevel, string> = {
  1: 'text-[length:var(--text-3xl)]',
  2: 'text-[length:var(--text-2xl)]',
  3: 'text-[length:var(--text-xl)]',
  4: 'text-[length:var(--text-lg)]',
};

function Heading({ level = 2, className, ...props }: HeadingProps) {
  const Component = `h${level}` as const;
  return (
    <Component
      className={cn(
        'font-semibold tracking-[var(--tracking-tight)] text-[var(--color-text-primary)]',
        headingSizes[level],
        className,
      )}
      {...props}
    />
  );
}

const Text = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-[length:var(--text-base)] leading-relaxed text-[var(--color-text-secondary)]', className)}
      {...props}
    />
  ),
);
Text.displayName = 'Text';

const Link = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className, ...props }, ref) => (
    <a
      ref={ref}
      className={cn(
        'cursor-pointer text-[var(--color-text-link)] underline decoration-transparent underline-offset-4',
        'transition-colors duration-[var(--duration-fast)] hover:decoration-current active:opacity-80',
        className,
      )}
      {...props}
    />
  ),
);
Link.displayName = 'Link';

const InlineCode = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <code
      ref={ref}
      className={cn(
        'rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] px-[var(--space-2)] py-[var(--space-1)]',
        'font-mono text-[length:var(--text-sm)] text-[var(--color-text-primary)]',
        className,
      )}
      {...props}
    />
  ),
);
InlineCode.displayName = 'InlineCode';

export { Heading, Text, Link, InlineCode };
export type { HeadingProps };
