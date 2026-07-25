import * as React from 'react';
import { cn } from '@/lib/cn';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface AvatarGroupItem {
  src?: string;
  alt: string;
  fallback: string;
}

interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  items: AvatarGroupItem[];
  max?: number;
}

function AvatarGroup({ items, max = 4, className, ...props }: AvatarGroupProps) {
  const visible = items.slice(0, Math.max(0, max));
  const remaining = Math.max(0, items.length - visible.length);

  return (
    <div className={cn('flex items-center', className)} aria-label={`${items.length} people`} {...props}>
      {visible.map((item, index) => (
        <Avatar
          key={`${item.alt}-${index}`}
          className={cn('border-2 border-[var(--color-surface)]', index > 0 && '-ml-[var(--space-2)]')}
        >
          {item.src && <AvatarImage src={item.src} alt={item.alt} />}
          <AvatarFallback aria-label={item.alt}>{item.fallback}</AvatarFallback>
        </Avatar>
      ))}
      {remaining > 0 && (
        <span className="-ml-[var(--space-2)] inline-flex size-10 items-center justify-center rounded-[var(--radius-full)] border-2 border-[var(--color-surface)] bg-[var(--color-surface-sunken)] px-[var(--space-2)] text-[length:var(--text-sm)] font-medium text-[var(--color-text-secondary)]">
          +{remaining}
        </span>
      )}
    </div>
  );
}

export { AvatarGroup };
export type { AvatarGroupItem, AvatarGroupProps };
