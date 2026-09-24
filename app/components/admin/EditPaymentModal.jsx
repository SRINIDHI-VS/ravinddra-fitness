"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/app/lib/supabaseClient";
import { isValidAmount } from "@/app/lib/validators";

export default function EditPaymentModal({ payment, onClose, onSaved }) {
  const [amount, setAmount] = useState(payment.amount != null ? String(payment.amount) : "");
  const [note, setNote] = useState(payment.transaction_ref || "");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const amountOk = isValidAmount(amount);

  function safeClose() {
    if (saving) return;
    onClose();
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!amountOk) return;

    setSaving(true);
    setError(null);
    const { error: updateErr } = await supabase
      .from("payments")
      .update({ amount: amount.trim() === "" ? null : Number(amount), transaction_ref: note.trim() || null })
      .eq("id", payment.id);
    setSaving(false);

    if (updateErr) {
      setError("Could not save. Try again.");
      return;
    }

    onSaved();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={safeClose}>
      <motion.div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editPaymentTitle"
      >
        <h3 className="modal-title" id="editPaymentTitle">Edit Payment</h3>
        <p className="modal-sub">
          {payment.clients?.name ? `For ${payment.clients.name} — ` : ""}fixes the amount or note only; the confirmed date stays as-is.
        </p>

        <form onSubmit={handleSubmit}>
          <div className={"field" + (touched && !amountOk ? " error" : "")}>
            <label htmlFor="editPaymentAmount">Amount (₹)</label>
            <input
              id="editPaymentAmount"
              type="number"
              inputMode="decimal"
              min="1"
              max="100000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => setTouched(true)}
              disabled={saving}
              autoFocus
            />
            <p className="error-msg">Enter an amount between ₹1 and ₹1,00,000, or leave it blank.</p>
          </div>
          <div className="field">
            <label htmlFor="editPaymentNote">Note / txn ref (optional)</label>
            <input
              id="editPaymentNote"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={saving}
            />
          </div>

          {error && <p className="submit-error-msg show">{error}</p>}

          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={safeClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || (touched && !amountOk)}>
              {saving && <span className="spinner" aria-hidden="true" />}{saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
