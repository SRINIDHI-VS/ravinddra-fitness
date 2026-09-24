"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { dedupeClients } from "@/app/lib/clients";
import { exportSessionsCsv } from "./csv";
import LogSessionModal from "./LogSessionModal";

const STATUS_META = {
  completed: { label: "Completed", badge: "badge-confirmed" },
  makeup: { label: "Makeup", badge: "badge-ok" },
  cancelled_notice: { label: "Cancelled — notice given", badge: "badge-pending" },
  cancelled_trainer: { label: "Cancelled by trainer", badge: "badge-pending" },
  cancelled_no_notice: { label: "Cancelled — no notice", badge: "badge-type" },
  no_show: { label: "No-show", badge: "badge-rejected" },
};

function formatDateOnly(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AttendanceView({ rows, paymentRows, onReload }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);

  const clients = dedupeClients(paymentRows);

  const filtered = rows
    .filter((r) => {
      if (filter === "all") return true;
      if (filter === "cancelled") return r.status.startsWith("cancelled");
      return r.status === filter;
    })
    .filter((r) => {
      if (!search) return true;
      const c = r.clients || {};
      const name = (c.name || "").toLowerCase();
      const phone = c.phone || "";
      return name.includes(search.toLowerCase()) || phone.includes(search);
    });

  async function deleteSession(id) {
    if (!window.confirm("Delete this session record? This can't be undone.")) return;
    setBusyId(id);
    const { error } = await supabase.from("class_sessions").delete().eq("id", id);
    setBusyId(null);
    if (error) {
      alert("Could not delete. Try again.");
      return;
    }
    onReload();
  }

  return (
    <div>
      <div className="toolbar">
        <input type="text" className="search-input" placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="filter-tabs">
          {["all", "completed", "cancelled", "no_show", "makeup"].map((f) => (
            <button key={f} className={"filter-tab" + (filter === f ? " active" : "")} onClick={() => setFilter(f)}>
              {f === "no_show" ? "No-show" : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => exportSessionsCsv(rows)}>Export CSV</button>
        <button className="btn btn-primary log-payment-btn" type="button" onClick={() => setShowLogModal(true)}>+ Log Session</button>
      </div>

      <div className="table-wrap">
        <table className="payments-table">
          <thead>
            <tr><th>Date</th><th>Client</th><th>Status</th><th>Notes</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="loading-cell">No matching sessions.</td></tr>
            )}
            {filtered.map((r) => {
              const c = r.clients || {};
              const meta = STATUS_META[r.status] || { label: r.status, badge: "badge-type" };
              return (
                <tr key={r.id}>
                  <td data-label="Date">{formatDateOnly(r.class_date)}</td>
                  <td data-label="Client"><div className="cell-name">{c.name || "—"}</div><div className="cell-sub">{c.phone || ""}</div></td>
                  <td data-label="Status"><span className={"badge " + meta.badge}>{meta.label}</span></td>
                  <td className="cell-sub" data-label="Notes">{r.notes || "—"}</td>
                  <td data-label="Actions">
                    <button className="row-btn reject-btn" disabled={busyId === r.id} onClick={() => deleteSession(r.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showLogModal && (
        <LogSessionModal
          clients={clients}
          initialClient={null}
          onClose={() => setShowLogModal(false)}
          onLogged={onReload}
        />
      )}
    </div>
  );
}
