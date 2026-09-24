"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/app/lib/supabaseClient";
import { isValidName, isValidPhone } from "@/app/lib/validators";

export default function EditClientModal({ client, onClose, onSaved }) {
  const [name, setName] = useState(client.name || "");
  const [phone, setPhone] = useState(client.phone || "");
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const nameOk = isValidName(name);
  const phoneOk = isValidPhone(phone);
  const canSubmit = nameOk && phoneOk;

  function touch(field) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

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
    setTouched({ name: true, phone: true });
    if (!canSubmit) return;

    setSaving(true);
    setError(null);
    const { error: updateErr } = await supabase
      .from("clients")
      .update({ name: name.trim(), phone: phone.trim() })
      .eq("id", client.id);
    setSaving(false);

    if (updateErr) {
      setError(
        updateErr.message && updateErr.message.includes("duplicate")
          ? "Another client already has that phone number."
          : "Could not update. Try again."
      );
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
        aria-labelledby="editClientTitle"
      >
        <h3 className="modal-title" id="editClientTitle">Edit Client</h3>
        <p className="modal-sub">Update their name or phone number.</p>

        <form onSubmit={handleSubmit}>
          <div className={"field" + (touched.name && !nameOk ? " error" : "")}>
            <label htmlFor="editClientName">Full name</label>
            <input
              id="editClientName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => touch("name")}
              disabled={saving}
              autoFocus
            />
            <p className="error-msg">Enter their full name (at least 2 letters).</p>
          </div>
          <div className={"field" + (touched.phone && !phoneOk ? " error" : "")}>
            <label htmlFor="editClientPhone">Phone number</label>
            <input
              id="editClientPhone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => touch("phone")}
              disabled={saving}
            />
            <p className="error-msg">Enter a valid 10-digit Indian mobile number.</p>
          </div>

          {error && <p className="submit-error-msg show">{error}</p>}

          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={safeClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !canSubmit}>
              {saving && <span className="spinner" aria-hidden="true" />}{saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
