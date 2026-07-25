'use client';

import * as React from 'react';
import { Dialog as SheetPrimitive } from 'radix-ui';

import { Close } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-[var(--z-overlay)] bg-[var(--color-overlay)]',
        'duration-[var(--duration-slow)] ease-[var(--ease-out)]',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        className
      )}
      {...props}
    />
  );
}

function SheetContent({ className, children, side = 'right', showCloseButton = true, ...props }: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: 'top' | 'right' | 'bottom' | 'left'; showCloseButton?: boolean }) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          'fixed z-[var(--z-dialog)] flex flex-col gap-[var(--space-4)]',
          'border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[length:var(--text-sm)] text-[var(--color-text-primary)] shadow-[var(--shadow-lg)]',
          'duration-[var(--duration-slow)] ease-[var(--ease-out)]',
          'data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:max-h-[80vh] data-[side=bottom]:rounded-t-[var(--radius-lg)] data-[side=bottom]:border-t',
          'data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:max-h-[80vh] data-[side=top]:rounded-b-[var(--radius-lg)] data-[side=top]:border-b',
          'data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:w-3/4 data-[side=left]:rounded-r-[var(--radius-lg)] data-[side=left]:border-r data-[side=left]:sm:max-w-sm',
          'data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:w-3/4 data-[side=right]:rounded-l-[var(--radius-lg)] data-[side=right]:border-l data-[side=right]:sm:max-w-sm',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0',
          'data-[side=bottom]:data-[state=open]:slide-in-from-bottom data-[side=left]:data-[state=open]:slide-in-from-left data-[side=right]:data-[state=open]:slide-in-from-right data-[side=top]:data-[state=open]:slide-in-from-top',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          'data-[side=bottom]:data-[state=closed]:slide-out-to-bottom data-[side=left]:data-[state=closed]:slide-out-to-left data-[side=right]:data-[state=closed]:slide-out-to-right data-[side=top]:data-[state=closed]:slide-out-to-top',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <div className="absolute right-[var(--space-3)] top-[var(--space-3)]">
            <SheetPrimitive.Close data-slot="sheet-close" asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <Close size={20} aria-hidden="true" />
              </Button>
            </SheetPrimitive.Close>
          </div>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-header" className={cn('flex flex-col gap-[var(--space-1)] p-[var(--space-4)] pr-[var(--space-16)]', className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-footer" className={cn('mt-auto flex flex-col gap-[var(--space-2)] p-[var(--space-4)]', className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={cn('text-[length:var(--text-base)] font-medium text-[var(--color-text-primary)]', className)} {...props} />;
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description data-slot="sheet-description" className={cn('text-[length:var(--text-sm)] text-[var(--color-text-secondary)]', className)} {...props} />;
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };
