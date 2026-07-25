'use client';

// Confirmation dialog on Radix AlertDialog: role=alertdialog, focus trap, focus
// return, Escape, and no dismiss-on-outside-click, so a destructive action
// cannot be confirmed or lost by a stray click (U1, N9).
//
// Controlled: the consumer owns `open` and flips it in the handlers. onCancel
// fires on Cancel, Escape, and programmatic close, but never after onConfirm.

import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

export interface AlertDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

function AlertDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  className,
}: AlertDialogProps) {
  const confirming = React.useRef(false);

  return (
    <AlertDialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          if (!confirming.current) onCancel();
          confirming.current = false;
        }
      }}
    >
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[var(--z-overlay)] bg-[var(--color-overlay)]',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
          )}
        />
        <AlertDialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[var(--z-dialog)] w-full max-w-sm -translate-x-1/2 -translate-y-1/2',
            'rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-raised)]',
            'p-[var(--space-6)] shadow-[var(--shadow-lg)] duration-[var(--duration-slow)]',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            className
          )}
        >
          <AlertDialogPrimitive.Title className="text-[length:var(--text-base)] font-semibold text-[var(--color-text-primary)]">
            {title}
          </AlertDialogPrimitive.Title>
          {description && (
            <AlertDialogPrimitive.Description className="mt-[var(--space-2)] text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
              {description}
            </AlertDialogPrimitive.Description>
          )}
          <div className="mt-[var(--space-6)] flex items-center justify-end gap-[var(--space-3)]">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary">{cancelLabel}</Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button
                variant={destructive ? 'destructive' : 'primary'}
                disabled={confirmDisabled}
                onClick={() => {
                  confirming.current = true;
                  onConfirm();
                }}
              >
                {confirmLabel}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

export { AlertDialog };
