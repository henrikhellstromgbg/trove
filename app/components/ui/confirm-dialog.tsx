"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { Close } from "@carbon/icons-react";
import { trapFocus } from "../../focus-trap";
import { Button } from "./button";
import { IconButton } from "./icon-button";
import { cx } from "./class-names";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  className,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    (destructive || confirmDisabled ? cancelRef : confirmRef).current?.focus();
    return () => previousFocusRef.current?.focus();
  }, [open, destructive, confirmDisabled]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 px-4"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => trapFocus(event, dialogRef.current!)}
        className={cx(
          "w-full max-w-sm rounded-lg border border-line bg-paper p-6",
          className,
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-base font-medium text-ink">
            {title}
          </h2>
          <IconButton label="Close" onClick={onCancel} className="-mr-2 -mt-2">
            <Close size={16} />
          </IconButton>
        </div>
        {description ? (
          <p id={descriptionId} className="mb-6 text-sm text-ink-dim">
            {description}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-3">
          <Button ref={cancelRef} type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant={destructive ? "destructive" : "primary"}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
