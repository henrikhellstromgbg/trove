'use client';

import * as React from 'react';
import { ContextMenu as Primitive } from 'radix-ui';

import { Checkmark, ChevronRight } from '@/components/icons';
import { cn } from '@/lib/cn';

const ContextMenu = Primitive.Root;
const ContextMenuGroup = Primitive.Group;
const ContextMenuPortal = Primitive.Portal;
const ContextMenuSub = Primitive.Sub;
const ContextMenuRadioGroup = Primitive.RadioGroup;

function ContextMenuTrigger({ className, ...props }: React.ComponentProps<typeof Primitive.Trigger>) {
  return <Primitive.Trigger data-slot="context-menu-trigger" className={cn('cursor-pointer select-none', className)} {...props} />;
}

const contentStyles = [
  'z-[var(--z-dropdown)] min-w-40 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]',
  'bg-[var(--color-surface-raised)] p-[var(--space-1)] text-[var(--color-text-primary)] shadow-[var(--shadow-md)]',
  'duration-[var(--duration-base)] ease-[var(--ease-out)]',
  'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
];

const itemStyles = [
  'relative flex min-h-[var(--touch-target-min)] cursor-pointer select-none items-center gap-[var(--space-2)]',
  'rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--color-text-primary)]',
  'data-[highlighted]:bg-[var(--color-surface-hover)] data-[highlighted]:text-[var(--color-text-primary)]',
  'data-[state=open]:bg-[var(--color-surface-active)] data-[state=open]:text-[var(--color-text-primary)]',
  'data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:text-[var(--color-text-disabled)]',
  'data-[inset=true]:pl-[var(--space-8)]',
];

function ContextMenuContent({ className, ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        data-slot="context-menu-content"
        className={cn(contentStyles, 'max-h-[var(--radix-context-menu-content-available-height)] overflow-y-auto', className)}
        {...props}
      />
    </Primitive.Portal>
  );
}

function ContextMenuItem({ className, inset, variant = 'default', ...props }: React.ComponentProps<typeof Primitive.Item> & { inset?: boolean; variant?: 'default' | 'destructive' }) {
  return (
    <Primitive.Item
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        itemStyles,
        'data-[variant=destructive]:text-[var(--color-status-error-text)] data-[variant=destructive]:data-[highlighted]:bg-[var(--color-status-error-bg)] data-[variant=destructive]:data-[highlighted]:text-[var(--color-status-error-text)]',
        className
      )}
      {...props}
    />
  );
}

function ContextMenuSubTrigger({ className, inset, children, ...props }: React.ComponentProps<typeof Primitive.SubTrigger> & { inset?: boolean }) {
  return (
    <Primitive.SubTrigger data-slot="context-menu-sub-trigger" data-inset={inset} className={cn(itemStyles, className)} {...props}>
      {children}<ChevronRight size={16} className="ml-auto" aria-hidden="true" />
    </Primitive.SubTrigger>
  );
}

function ContextMenuSubContent({ className, ...props }: React.ComponentProps<typeof Primitive.SubContent>) {
  return <Primitive.SubContent data-slot="context-menu-sub-content" className={cn(contentStyles, className)} {...props} />;
}

function ContextMenuCheckboxItem({ className, children, checked, inset, ...props }: React.ComponentProps<typeof Primitive.CheckboxItem> & { inset?: boolean }) {
  return (
    <Primitive.CheckboxItem data-slot="context-menu-checkbox-item" data-inset={inset} className={cn(itemStyles, 'pr-[var(--space-10)]', className)} checked={checked} {...props}>
      <span className="pointer-events-none absolute right-[var(--space-3)] flex items-center"><Primitive.ItemIndicator><Checkmark size={16} aria-hidden="true" /></Primitive.ItemIndicator></span>
      {children}
    </Primitive.CheckboxItem>
  );
}

function ContextMenuRadioItem({ className, children, inset, ...props }: React.ComponentProps<typeof Primitive.RadioItem> & { inset?: boolean }) {
  return (
    <Primitive.RadioItem data-slot="context-menu-radio-item" data-inset={inset} className={cn(itemStyles, 'pr-[var(--space-10)]', className)} {...props}>
      <span className="pointer-events-none absolute right-[var(--space-3)] flex items-center"><Primitive.ItemIndicator><Checkmark size={16} aria-hidden="true" /></Primitive.ItemIndicator></span>
      {children}
    </Primitive.RadioItem>
  );
}

function ContextMenuLabel({ className, inset, ...props }: React.ComponentProps<typeof Primitive.Label> & { inset?: boolean }) {
  return <Primitive.Label data-slot="context-menu-label" data-inset={inset} className={cn('px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-sm)] font-medium text-[var(--color-text-secondary)] data-[inset=true]:pl-[var(--space-8)]', className)} {...props} />;
}

function ContextMenuSeparator({ className, ...props }: React.ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator data-slot="context-menu-separator" className={cn('my-[var(--space-1)] h-px bg-[var(--color-border-subtle)]', className)} {...props} />;
}

function ContextMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return <span data-slot="context-menu-shortcut" className={cn('ml-auto text-[length:var(--text-sm)] text-[var(--color-text-secondary)]', className)} {...props} />;
}

export { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuCheckboxItem, ContextMenuRadioItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuGroup, ContextMenuPortal, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuRadioGroup };
