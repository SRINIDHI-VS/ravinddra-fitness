"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    (danger ? cancelRef : confirmRef).current?.focus();
  }, [danger]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="modal-overlay" onClick={() => { if (!busy) onCancel(); }}>
      <motion.div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmDialogTitle"
      >
        <h3 className="modal-title" id="confirmDialogTitle">{title}</h3>
        <p className="modal-sub">{message}</p>
        {error && <p className="submit-error-msg show">{error}</p>}
        <div className="actions">
          <button type="button" className="btn btn-ghost" ref={cancelRef} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={"btn " + (danger ? "btn-danger" : "btn-primary")}
            ref={confirmRef}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <span className="spinner" aria-hidden="true" />}{busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
