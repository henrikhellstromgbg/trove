import * as React from 'react';
import { ChevronDown } from '@/components/icons';
import { cn } from '@/lib/cn';

type NativeSelectProps = Omit<React.ComponentProps<'select'>, 'size'> & {
  size?: 'sm' | 'default';
};

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, size = 'default', ...props }, ref) => (
    <div className={cn('relative w-fit min-w-0', className)}>
      <select
        ref={ref}
        data-size={size}
        className={cn(
          'h-[var(--touch-target-min)] w-full min-w-0 cursor-pointer appearance-none select-none',
          'rounded-[var(--radius-sm)] border border-[var(--color-border)]',
          'bg-[var(--color-surface)] py-[var(--space-2)] pl-[var(--space-3)] pr-[var(--space-10)]',
          'text-[length:var(--text-sm)] text-[var(--color-text-primary)]',
          'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]',
          'hover:border-[var(--color-border-strong)] active:bg-[var(--color-surface-active)]',
          'disabled:cursor-not-allowed disabled:bg-[var(--color-surface-sunken)] disabled:text-[var(--color-text-disabled)]',
          'aria-invalid:border-[var(--color-status-error)]'
        )}
        {...props}
      />
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-[var(--space-3)] top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
      />
    </div>
  )
);
NativeSelect.displayName = 'NativeSelect';

function NativeSelectOption(props: React.ComponentProps<'option'>) {
  return <option {...props} />;
}

function NativeSelectOptGroup(props: React.ComponentProps<'optgroup'>) {
  return <optgroup {...props} />;
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
