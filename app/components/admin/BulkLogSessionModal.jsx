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

export default function BulkLogSessionModal({ clients, onClose, onLogged }) {
  const [date, setDate] = useState(() => toLocalDateValue(new Date()));
  const [status, setStatus] = useState("completed");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const visibleClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.trim().toLowerCase();
    return clients.filter((c) => (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q));
  }, [clients, search]);

  const allVisibleSelected = visibleClients.length > 0 && visibleClients.every((c) => selectedIds.has(c.id));

  function toggleClient(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleClients.forEach((c) => next.delete(c.id));
      } else {
        visibleClients.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

  const canSubmit = selectedIds.size > 0 && !!date;

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    const rows = Array.from(selectedIds).map((id) => ({
      client_id: id,
      class_date: date,
      status,
      notes: notes.trim() || null,
    }));

    const { error: insertErr } = await supabase.from("class_sessions").insert(rows);

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
        <h3 className="modal-title">Bulk Mark Attendance</h3>
        <p className="modal-sub">Log the same result for a whole class in one go.</p>

        <form onSubmit={handleSubmit}>
          <div className="row2">
            <div className="field">
              <label htmlFor="bulkDate">Date</label>
              <input id="bulkDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="bulkStatus">Status</label>
              <select id="bulkStatus" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={"field" + (touched && selectedIds.size === 0 ? " error" : "")}>
            <label htmlFor="bulkSearch">Clients</label>
            <input
              id="bulkSearch"
              type="text"
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
            <div className="checklist-toolbar">
              <button type="button" className="row-btn" onClick={toggleSelectAllVisible} disabled={visibleClients.length === 0}>
                {allVisibleSelected ? "Unselect all" : "Select all"}
              </button>
              <span className="checklist-count">{selectedIds.size} selected</span>
            </div>
            <div className="client-checklist">
              {visibleClients.length === 0 && <p className="cell-sub" style={{ padding: "12px" }}>No matching clients.</p>}
              {visibleClients.map((c) => (
                <label className="chk-row" key={c.id}>
                  <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleClient(c.id)} />
                  <span className="chk-row-meta">
                    <span className="cell-name">{c.name}</span>
                    <span className="cell-sub"> · {c.phone}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="error-msg">Pick at least one client.</p>
          </div>

          <div className="field">
            <label htmlFor="bulkNotes">Note (optional, applies to all)</label>
            <input id="bulkNotes" type="text" placeholder="e.g. reason for cancellation" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <p className="submit-error-msg show">{error}</p>}

          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <span className="spinner" aria-hidden="true" />}
              {saving ? "Saving…" : "Mark " + selectedIds.size + (selectedIds.size === 1 ? " Client" : " Clients")}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
