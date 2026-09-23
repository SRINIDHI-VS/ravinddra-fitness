"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { exportPaymentsCsv } from "./csv";
import { dedupeClients } from "@/app/lib/clients";
import LogPaymentModal from "./LogPaymentModal";

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ row }) {
  if (row.status === "confirmed") return <span className="badge badge-confirmed">Confirmed</span>;
  if (row.status === "rejected") return <span className="badge badge-rejected" title={row.rejection_reason || undefined}>Rejected</span>;
  return <span className="badge badge-pending">Pending</span>;
}

async function viewProof(path, setBusyPath) {
  setBusyPath(path);
  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 120);
  setBusyPath(null);
  if (error || !data) {
    alert("Could not load screenshot.");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener");
}

const DUPLICATE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

// A pending (unconfirmed) submission is worth a second look if the same
// client already has a CONFIRMED payment within a few days of it — the
// likely case being Ravi logged it manually and the client also uploaded a
// screenshot for the same real-world payment. This only flags it; nothing
// here merges or auto-rejects, since it's a guess, not a certainty.
function findPossibleDuplicate(row, allRows) {
  if (row.status !== "submitted") return null;
  const clientId = row.clients?.id;
  if (!clientId) return null;
  const rowTime = new Date(row.submitted_at).getTime();
  return (
    allRows.find(
      (other) =>
        other.id !== row.id &&
        other.clients?.id === clientId &&
        other.status === "confirmed" &&
        Math.abs(new Date(other.submitted_at).getTime() - rowTime) <= DUPLICATE_WINDOW_MS
    ) || null
  );
}

export default function PaymentsView({ rows, onReload }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [busyPath, setBusyPath] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);

  const filtered = rows
    .filter((r) => (filter === "all" ? true : filter === "pending" ? r.status === "submitted" : filter === "confirmed" ? r.status === "confirmed" : r.status === "rejected"))
    .filter((r) => {
      if (!search) return true;
      const c = r.clients || {};
      const name = (c.name || "").toLowerCase();
      const phone = c.phone || "";
      return name.includes(search.toLowerCase()) || phone.includes(search);
    });

  async function setStatus(id, fields) {
    setBusyId(id);
    const { error } = await supabase.from("payments").update(fields).eq("id", id);
    setBusyId(null);
    if (error) {
      alert("Could not update. Try again.");
      return;
    }
    onReload();
  }

  function reject(id) {
    const reason = prompt("Reason for rejecting this payment (shown only in the admin view):", "");
    if (reason === null) return;
    setStatus(id, { status: "rejected", rejection_reason: reason.trim() || null, confirmed_at: null });
  }

  // Scoped to manually-logged rows only (enforced again at the DB level via
  // RLS) — a client-submitted row keeps "Reject" instead, since deleting it
  // would throw away the one record of what they actually sent, screenshot
  // included.
  async function deleteManual(id) {
    if (!window.confirm("Delete this manually-logged payment? This can't be undone.")) return;
    setBusyId(id);
    const { error } = await supabase.from("payments").delete().eq("id", id);
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
          {["all", "pending", "confirmed", "rejected"].map((f) => (
            <button key={f} className={"filter-tab" + (filter === f ? " active" : "")} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => exportPaymentsCsv(rows)}>Export CSV</button>
        <button className="btn btn-primary log-payment-btn" type="button" onClick={() => setShowLogModal(true)}>+ Log Payment</button>
      </div>

      <div className="table-wrap">
        <table className="payments-table">
          <thead>
            <tr>
              <th>Submitted</th><th>Client</th><th>Type</th><th>Details</th><th>Amount</th><th>Txn Ref</th><th>Proof</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="loading-cell">No matching records.</td></tr>
            )}
            {filtered.map((r) => {
              const c = r.clients || {};
              const details = [c.age ? c.age + " yrs" : null, c.height_cm ? c.height_cm + " cm" : null, c.weight_kg ? c.weight_kg + " kg" : null, c.diet]
                .filter(Boolean)
                .join(" · ") || "—";
              const dup = findPossibleDuplicate(r, rows);
              return (
                <tr key={r.id}>
                  <td>{formatDate(r.submitted_at)}</td>
                  <td><div className="cell-name">{c.name || "—"}</div><div className="cell-sub">{c.phone || ""}</div></td>
                  <td>
                    <span className="badge badge-type">{r.client_type}</span>
                    {r.source === "admin_manual" && <span className="badge badge-manual">Manual</span>}
                  </td>
                  <td className="cell-sub">{details}</td>
                  <td>{r.amount != null ? "₹" + r.amount : "—"}</td>
                  <td className="cell-sub">{r.transaction_ref || "—"}</td>
                  <td>
                    {r.screenshot_path ? (
                      <button className="row-btn view-btn" disabled={busyPath === r.screenshot_path} onClick={() => viewProof(r.screenshot_path, setBusyPath)}>
                        {busyPath === r.screenshot_path ? "…" : "View"}
                      </button>
                    ) : (
                      <span className="cell-sub">—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge row={r} />
                    {dup && (
                      <span className="badge badge-soon" title={`Possibly a duplicate — this client already has a confirmed payment on ${formatDate(dup.confirmed_at || dup.submitted_at)}`}>
                        ⚠ Possible dup
                      </span>
                    )}
                    {r.status === "submitted" && (
                      <>
                        <button className="row-btn confirm-btn" disabled={busyId === r.id} onClick={() => setStatus(r.id, { status: "confirmed", confirmed_at: new Date().toISOString() })}>Mark confirmed</button>
                        <button className="row-btn reject-btn" disabled={busyId === r.id} onClick={() => reject(r.id)}>Reject</button>
                      </>
                    )}
                    {r.status === "confirmed" && (
                      <button className="row-btn undo-btn" disabled={busyId === r.id} onClick={() => setStatus(r.id, { status: "submitted", confirmed_at: null, rejection_reason: null })}>Undo</button>
                    )}
                    {r.status === "rejected" && (
                      <button className="row-btn undo-btn" disabled={busyId === r.id} onClick={() => setStatus(r.id, { status: "submitted", confirmed_at: null, rejection_reason: null })}>Restore</button>
                    )}
                    {r.source === "admin_manual" && (
                      <button className="row-btn reject-btn" disabled={busyId === r.id} onClick={() => deleteManual(r.id)}>Delete</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showLogModal && (
        <LogPaymentModal
          clients={dedupeClients(rows)}
          rows={rows}
          initialClient={null}
          onClose={() => setShowLogModal(false)}
          onLogged={onReload}
        />
      )}
    </div>
  );
}
