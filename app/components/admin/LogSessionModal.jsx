"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/app/lib/supabaseClient";

const STATUS_OPTIONS = [
  { value: "completed", label: "Completed" },
  { value: "cancelled_notice", label: "Client cancelled — notice given" },
  { value: "cancelled_no_notice", label: "Client cancelled — no notice" },
  { value: "cancelled_trainer", label: "Cancelled by you" },
  { value: "no_show", label: "No-show" },
  { value: "makeup", label: "Makeup class" },
];

function toLocalDateValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

export default function LogSessionModal({ clients, initialClient, onClose, onLogged }) {
  const [query, setQuery] = useState(initialClient ? initialClient.name || initialClient.phone : "");
  const [selected, setSelected] = useState(initialClient || null);
  const [date, setDate] = useState(() => toLocalDateValue(new Date()));
  const [status, setStatus] = useState("completed");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const suggestions = useMemo(() => {
    if (selected || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    return clients.filter((c) => (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q)).slice(0, 6);
  }, [clients, query, selected]);

  function pickClient(c) {
    setSelected(c);
    setQuery(c.name || c.phone);
  }

  function changeClient() {
    setSelected(null);
    setQuery("");
  }

  const canSubmit = !!selected && !!date;

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    const { error: insertErr } = await supabase.from("class_sessions").insert({
      client_id: selected.id,
      class_date: date,
      status,
      notes: notes.trim() || null,
    });

    if (insertErr) {
      setError("Could not save — try again.");
      setSaving(false);
      return;
    }

    onLogged();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <h3 className="modal-title">Log a Session</h3>
        <p className="modal-sub">Record what happened in a client&apos;s class.</p>

        <form onSubmit={handleSubmit}>
          <div className={"field" + (touched && !selected ? " error" : "")}>
            <label htmlFor="sessionClientSearch">Client</label>
            {selected ? (
              <div className="picked-client">
                <div>
                  <div className="cell-name">{selected.name}</div>
                  <div className="cell-sub">{selected.phone}</div>
                </div>
                <button type="button" className="row-btn" onClick={changeClient}>Change</button>
              </div>
            ) : (
              <>
                <input
                  id="sessionClientSearch"
                  type="text"
                  placeholder="Search by name or phone…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                />
                {suggestions.length > 0 && (
                  <div className="client-suggest">
                    {suggestions.map((c) => (
                      <button type="button" key={c.id} className="client-suggest-row" onClick={() => pickClient(c)}>
                        <span className="cell-name">{c.name}</span>
                        <span className="cell-sub">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <p className="error-msg">Pick a client first.</p>
          </div>

          <div className="row2" style={{ marginTop: 16 }}>
            <div className="field">
              <label htmlFor="sessionDate">Date</label>
              <input id="sessionDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="sessionStatus">Status</label>
              <select id="sessionStatus" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="sessionNotes">Note (optional)</label>
            <input id="sessionNotes" type="text" placeholder="e.g. reason for cancellation" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <p className="submit-error-msg show">{error}</p>}

          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <span className="spinner" aria-hidden="true" />}{saving ? "Saving…" : "Log Session"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
