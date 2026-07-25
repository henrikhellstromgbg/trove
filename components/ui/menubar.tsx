'use client';

import * as React from 'react';
import { Menubar as Primitive } from 'radix-ui';

import { Checkmark, ChevronRight } from '@/components/icons';
import { cn } from '@/lib/cn';

const MenubarMenu = Primitive.Menu;
const MenubarGroup = Primitive.Group;
const MenubarPortal = Primitive.Portal;
const MenubarRadioGroup = Primitive.RadioGroup;
const MenubarSub = Primitive.Sub;

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

function Menubar({ className, ...props }: React.ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      data-slot="menubar"
      className={cn('flex min-h-[var(--touch-target-min)] items-center gap-[var(--space-1)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-1)]', className)}
      {...props}
    />
  );
}

function MenubarTrigger({ className, ...props }: React.ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      data-slot="menubar-trigger"
      className={cn(
        'flex min-h-[var(--touch-target-min)] cursor-pointer select-none items-center rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)]',
        'text-[length:var(--text-sm)] font-medium text-[var(--color-text-primary)] transition-colors duration-[var(--duration-fast)]',
        'hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]',
        'data-[state=open]:bg-[var(--color-surface-active)] data-[state=open]:text-[var(--color-text-primary)]',
        'data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:text-[var(--color-text-disabled)]',
        className
      )}
      {...props}
    />
  );
}

function MenubarContent({ className, align = 'start', alignOffset = -4, sideOffset = 8, ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return <MenubarPortal><Primitive.Content data-slot="menubar-content" align={align} alignOffset={alignOffset} sideOffset={sideOffset} className={cn(contentStyles, className)} {...props} /></MenubarPortal>;
}

function MenubarItem({ className, inset, variant = 'default', ...props }: React.ComponentProps<typeof Primitive.Item> & { inset?: boolean; variant?: 'default' | 'destructive' }) {
  return <Primitive.Item data-slot="menubar-item" data-inset={inset} data-variant={variant} className={cn(itemStyles, 'data-[variant=destructive]:text-[var(--color-status-error-text)] data-[variant=destructive]:data-[highlighted]:bg-[var(--color-status-error-bg)] data-[variant=destructive]:data-[highlighted]:text-[var(--color-status-error-text)]', className)} {...props} />;
}

function MenubarCheckboxItem({ className, children, checked, inset, ...props }: React.ComponentProps<typeof Primitive.CheckboxItem> & { inset?: boolean }) {
  return <Primitive.CheckboxItem data-slot="menubar-checkbox-item" data-inset={inset} className={cn(itemStyles, 'pl-[var(--space-8)]', className)} checked={checked} {...props}><span className="pointer-events-none absolute left-[var(--space-3)] flex items-center"><Primitive.ItemIndicator><Checkmark size={16} aria-hidden="true" /></Primitive.ItemIndicator></span>{children}</Primitive.CheckboxItem>;
}

function MenubarRadioItem({ className, children, inset, ...props }: React.ComponentProps<typeof Primitive.RadioItem> & { inset?: boolean }) {
  return <Primitive.RadioItem data-slot="menubar-radio-item" data-inset={inset} className={cn(itemStyles, 'pl-[var(--space-8)]', className)} {...props}><span className="pointer-events-none absolute left-[var(--space-3)] flex items-center"><Primitive.ItemIndicator><Checkmark size={16} aria-hidden="true" /></Primitive.ItemIndicator></span>{children}</Primitive.RadioItem>;
}

function MenubarLabel({ className, inset, ...props }: React.ComponentProps<typeof Primitive.Label> & { inset?: boolean }) {
  return <Primitive.Label data-slot="menubar-label" data-inset={inset} className={cn('px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-sm)] font-medium text-[var(--color-text-secondary)] data-[inset=true]:pl-[var(--space-8)]', className)} {...props} />;
}

function MenubarSeparator({ className, ...props }: React.ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator data-slot="menubar-separator" className={cn('my-[var(--space-1)] h-px bg-[var(--color-border-subtle)]', className)} {...props} />;
}

function MenubarShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return <span data-slot="menubar-shortcut" className={cn('ml-auto text-[length:var(--text-sm)] text-[var(--color-text-secondary)]', className)} {...props} />;
}

function MenubarSubTrigger({ className, inset, children, ...props }: React.ComponentProps<typeof Primitive.SubTrigger> & { inset?: boolean }) {
  return <Primitive.SubTrigger data-slot="menubar-sub-trigger" data-inset={inset} className={cn(itemStyles, className)} {...props}>{children}<ChevronRight size={16} className="ml-auto" aria-hidden="true" /></Primitive.SubTrigger>;
}

function MenubarSubContent({ className, ...props }: React.ComponentProps<typeof Primitive.SubContent>) {
  return <Primitive.SubContent data-slot="menubar-sub-content" className={cn(contentStyles, className)} {...props} />;
}

export { Menubar, MenubarPortal, MenubarMenu, MenubarTrigger, MenubarContent, MenubarGroup, MenubarSeparator, MenubarLabel, MenubarItem, MenubarShortcut, MenubarCheckboxItem, MenubarRadioGroup, MenubarRadioItem, MenubarSub, MenubarSubTrigger, MenubarSubContent };
