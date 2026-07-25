'use client';

import * as React from 'react';
import { DropdownMenu as Primitive } from 'radix-ui';

import { Checkmark, ChevronRight } from '@/components/icons';
import { cn } from '@/lib/cn';

const DropdownMenu = Primitive.Root;
const DropdownMenuPortal = Primitive.Portal;
const DropdownMenuTrigger = Primitive.Trigger;
const DropdownMenuGroup = Primitive.Group;
const DropdownMenuRadioGroup = Primitive.RadioGroup;
const DropdownMenuSub = Primitive.Sub;

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

function DropdownMenuContent({ className, align = 'start', sideOffset = 4, ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        className={cn(contentStyles, 'max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto', className)}
        {...props}
      />
    </Primitive.Portal>
  );
}

function DropdownMenuItem({ className, inset, variant = 'default', ...props }: React.ComponentProps<typeof Primitive.Item> & { inset?: boolean; variant?: 'default' | 'destructive' }) {
  return (
    <Primitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(itemStyles, 'data-[variant=destructive]:text-[var(--color-status-error-text)] data-[variant=destructive]:data-[highlighted]:bg-[var(--color-status-error-bg)] data-[variant=destructive]:data-[highlighted]:text-[var(--color-status-error-text)]', className)}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({ className, children, checked, inset, ...props }: React.ComponentProps<typeof Primitive.CheckboxItem> & { inset?: boolean }) {
  return (
    <Primitive.CheckboxItem data-slot="dropdown-menu-checkbox-item" data-inset={inset} className={cn(itemStyles, 'pr-[var(--space-10)]', className)} checked={checked} {...props}>
      <span className="pointer-events-none absolute right-[var(--space-3)] flex items-center"><Primitive.ItemIndicator><Checkmark size={16} aria-hidden="true" /></Primitive.ItemIndicator></span>{children}
    </Primitive.CheckboxItem>
  );
}

function DropdownMenuRadioItem({ className, children, inset, ...props }: React.ComponentProps<typeof Primitive.RadioItem> & { inset?: boolean }) {
  return (
    <Primitive.RadioItem data-slot="dropdown-menu-radio-item" data-inset={inset} className={cn(itemStyles, 'pr-[var(--space-10)]', className)} {...props}>
      <span className="pointer-events-none absolute right-[var(--space-3)] flex items-center"><Primitive.ItemIndicator><Checkmark size={16} aria-hidden="true" /></Primitive.ItemIndicator></span>{children}
    </Primitive.RadioItem>
  );
}

function DropdownMenuLabel({ className, inset, ...props }: React.ComponentProps<typeof Primitive.Label> & { inset?: boolean }) {
  return <Primitive.Label data-slot="dropdown-menu-label" data-inset={inset} className={cn('px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-sm)] font-medium text-[var(--color-text-secondary)] data-[inset=true]:pl-[var(--space-8)]', className)} {...props} />;
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator data-slot="dropdown-menu-separator" className={cn('my-[var(--space-1)] h-px bg-[var(--color-border-subtle)]', className)} {...props} />;
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return <span data-slot="dropdown-menu-shortcut" className={cn('ml-auto text-[length:var(--text-sm)] text-[var(--color-text-secondary)]', className)} {...props} />;
}

function DropdownMenuSubTrigger({ className, inset, children, ...props }: React.ComponentProps<typeof Primitive.SubTrigger> & { inset?: boolean }) {
  return <Primitive.SubTrigger data-slot="dropdown-menu-sub-trigger" data-inset={inset} className={cn(itemStyles, className)} {...props}>{children}<ChevronRight size={16} className="ml-auto" aria-hidden="true" /></Primitive.SubTrigger>;
}

function DropdownMenuSubContent({ className, ...props }: React.ComponentProps<typeof Primitive.SubContent>) {
  return <Primitive.SubContent data-slot="dropdown-menu-sub-content" className={cn(contentStyles, className)} {...props} />;
}

export { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent };
