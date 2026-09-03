import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';
import { acquireViewportScrollLock } from '../lib/viewportScrollLock';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm
}) => {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onCancel);
  const confirmClickRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  closeRef.current = onCancel;

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    confirmClickRef.current = false;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseScrollLock = acquireViewportScrollLock(document);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(element => element.getAttribute('aria-hidden') !== 'true');
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (!dialog.contains(activeElement) || (!event.shiftKey && activeElement === lastFocusable) || (event.shiftKey && (activeElement === firstFocusable || activeElement === dialog))) {
        event.preventDefault();
        (event.shiftKey ? lastFocusable : firstFocusable).focus({ preventScroll: true });
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    cancelButtonRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      releaseScrollLock();
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleConfirm = () => {
    if (confirmClickRef.current) return;
    confirmClickRef.current = true;
    onConfirm();
  };

  return createPortal(
    <div
      className="cv-modal-backdrop cv-confirm-dialog-backdrop fixed inset-0 z-[150] overflow-y-auto animate-in fade-in duration-200"
      role="presentation"
      data-confirmation-backdrop
      onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="cv-modal-panel relative flex w-full max-w-md flex-col animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-confirmation-dialog
      >
        <header className="cv-modal-heading flex items-center justify-between gap-3 p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="cv-modal-icon cv-confirm-dialog-icon"><Trash2 className="h-4 w-4" /></div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-bold text-slate-800 dark:text-white">{title}</h2>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="cv-modal-close" aria-label="ปิดหน้าต่างยืนยัน"><X className="h-4 w-4" /></button>
        </header>

        <div className="p-4 sm:p-5">
          <p id={descriptionId} className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{description}</p>
        </div>

        <footer className="cv-modal-footer flex items-center justify-end gap-2 p-4">
          <button ref={cancelButtonRef} type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" data-confirmation-cancel>ยกเลิก</button>
          <button type="button" onClick={handleConfirm} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400/60 dark:bg-rose-700 dark:hover:bg-rose-600" data-confirmation-confirm><Trash2 className="h-3.5 w-3.5" />{confirmLabel}</button>
        </footer>
      </section>
    </div>,
    document.body
  );
};
