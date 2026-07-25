'use client';

import * as React from 'react';
import { Avatar as AvatarPrimitive } from 'radix-ui';

import { cn } from '@/lib/cn';

function Avatar({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: 'default' | 'sm' | 'lg';
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        'group/avatar relative flex size-8 shrink-0 select-none rounded-[var(--radius-full)]',
        'border border-[var(--color-border-subtle)]',
        'data-[size=lg]:size-10 data-[size=sm]:size-6',
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        'aspect-square size-full rounded-[var(--radius-full)] object-cover',
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-[var(--radius-full)]',
        'bg-[var(--color-surface-sunken)] text-[length:var(--text-sm)] text-[var(--color-text-secondary)]',
        className
      )}
      {...props}
    />
  )
}

type AvatarBadgeProps = Omit<
  React.ComponentProps<'span'>,
  'aria-label' | 'role'
> & {
  label: string;
};

function AvatarBadge({
  className,
  children,
  label,
  ...props
}: AvatarBadgeProps) {
  return (
    <span
      data-slot="avatar-badge"
      role="status"
      className={cn(
        'absolute bottom-0 right-0 inline-flex items-center justify-center select-none',
        'rounded-[var(--radius-full)] bg-[var(--color-status-success)] text-[var(--color-text-on-status)]',
        'ring-2 ring-[var(--color-surface)]',
        'group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden',
        'group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2',
        'group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2',
        className
      )}
      {...props}
    >
      {children}
      <span className="sr-only">{label}</span>
    </span>
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        'group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-[var(--color-surface)]',
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        'relative flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-full)]',
        'bg-[var(--color-surface-sunken)] text-[length:var(--text-sm)] text-[var(--color-text-secondary)]',
        'ring-2 ring-[var(--color-surface)]',
        'group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6',
        '[&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3',
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}
