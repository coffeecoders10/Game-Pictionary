"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** In-page dialog (native <dialog>): Escape, backdrop click and focus trapping come for free. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="modal-body">
        <h2 id={titleId} className="modal-title">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
