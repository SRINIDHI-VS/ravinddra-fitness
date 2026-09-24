"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { dedupeClients } from "@/app/lib/clients";
import { exportSessionsCsv } from "./csv";
import LogSessionModal from "./LogSessionModal";
import ConfirmDialog from "./ConfirmDialog";
import AttendanceCalendar from "./AttendanceCalendar";

export const STATUS_META = {
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
  const [view, setView] = useState("table");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showLogModal, setShowLogModal] = useState(false);
  const [logInitialDate, setLogInitialDate] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

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

  function openLogModal(dateStr) {
    setLogInitialDate(dateStr || null);
    setShowLogModal(true);
  }

  function askDeleteSession(id) {
    setPendingDeleteId(id);
    setDeleteError(null);
  }

  function cancelDeleteSession() {
    if (deleteBusy) return;
    setPendingDeleteId(null);
    setDeleteError(null);
  }

  async function confirmDeleteSession() {
    setDeleteBusy(true);
    setDeleteError(null);
    const { error } = await supabase.from("class_sessions").delete().eq("id", pendingDeleteId);
    setDeleteBusy(false);
    if (error) {
      setDeleteError("Could not delete. Try again.");
      return;
    }
    setPendingDeleteId(null);
    onReload();
  }

  return (
    <div>
      <div className="toolbar">
        <div className="filter-tabs">
          <button className={"filter-tab" + (view === "table" ? " active" : "")} onClick={() => setView("table")}>Table</button>
          <button className={"filter-tab" + (view === "calendar" ? " active" : "")} onClick={() => setView("calendar")}>Calendar</button>
        </div>
        {view === "table" && (
          <>
            <input type="text" className="search-input" placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="filter-tabs">
              {["all", "completed", "cancelled", "no_show", "makeup"].map((f) => (
                <button key={f} className={"filter-tab" + (filter === f ? " active" : "")} onClick={() => setFilter(f)}>
                  {f === "no_show" ? "No-show" : f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </>
        )}
        <button className="btn btn-ghost" type="button" onClick={() => exportSessionsCsv(rows)}>Export CSV</button>
        <button className="btn btn-primary log-payment-btn" type="button" onClick={() => openLogModal(null)}>+ Log Session</button>
      </div>

      {view === "table" && (
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
                      <button className="row-btn reject-btn" onClick={() => askDeleteSession(r.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === "calendar" && (
        <AttendanceCalendar
          sessions={rows}
          paymentRows={paymentRows}
          onDeleteSession={askDeleteSession}
          onRequestLogSession={openLogModal}
        />
      )}

      {showLogModal && (
        <LogSessionModal
          clients={clients}
          initialClient={null}
          initialDate={logInitialDate}
          onClose={() => setShowLogModal(false)}
          onLogged={onReload}
        />
      )}

      {pendingDeleteId && (
        <ConfirmDialog
          title="Delete session record?"
          message="This can't be undone."
          confirmLabel="Delete"
          danger
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDeleteSession}
          onCancel={cancelDeleteSession}
        />
      )}
    </div>
  );
}
