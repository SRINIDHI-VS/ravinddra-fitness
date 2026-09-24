"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export default function PromptDialog({
  title,
  message,
  label,
  type = "text",
  inputMode,
  initialValue = "",
  placeholder,
  optional = false,
  validate,
  errorMessage,
  confirmLabel = "Save",
  busy = false,
  submitError = null,
  onSubmit,
  onCancel,
}) {
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const valid = validate ? ((optional && value.trim() === "") || validate(value)) : true;

  function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!valid || busy) return;
    onSubmit(value.trim());
  }

  return (
    <div className="modal-overlay" onClick={() => { if (!busy) onCancel(); }}>
      <motion.div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="promptDialogTitle"
      >
        <h3 className="modal-title" id="promptDialogTitle">{title}</h3>
        {message && <p className="modal-sub">{message}</p>}
        <form onSubmit={handleSubmit}>
          <div className={"field" + (touched && !valid ? " error" : "")}>
            <label htmlFor="promptDialogInput">{label}</label>
            <input
              id="promptDialogInput"
              ref={inputRef}
              type={type}
              inputMode={inputMode}
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setTouched(true)}
              disabled={busy}
            />
            {errorMessage && <p className="error-msg">{errorMessage}</p>}
          </div>
          {submitError && <p className="submit-error-msg show">{submitError}</p>}
          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy || !valid}>
              {busy && <span className="spinner" aria-hidden="true" />}{busy ? "Saving…" : confirmLabel}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
