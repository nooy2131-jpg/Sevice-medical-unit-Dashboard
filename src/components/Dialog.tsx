"use client";

import { useEffect, useRef, type ReactNode } from "react";

type DialogProps = Readonly<{
  open: boolean;
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}>;

export function Dialog({
  open,
  labelledBy,
  onClose,
  children,
  className = "",
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
      const initialFocus =
        dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]") ??
        dialog.querySelector<HTMLElement>(
          "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
        );
      initialFocus?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }

    return () => {
      if (dialog.open) dialog.close();
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
      previousFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    const restoreFocus = () => {
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
      previousFocusRef.current = null;
    };
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", restoreFocus);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", restoreFocus);
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      className={`fixed m-auto max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl border-0 bg-white p-5 shadow-xl backdrop:bg-slate-950/30 ${className}`}
    >
      {children}
    </dialog>
  );
}
