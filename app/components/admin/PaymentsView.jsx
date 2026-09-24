"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { exportPaymentsCsv } from "./csv";
import { dedupeClients } from "@/app/lib/clients";
import { waLinkTo } from "@/app/lib/siteConfig";
import { isValidAmount } from "@/app/lib/validators";
import LogPaymentModal from "./LogPaymentModal";
import EditPaymentModal from "./EditPaymentModal";
import ConfirmDialog from "./ConfirmDialog";
import PromptDialog from "./PromptDialog";
import { useToast } from "./Toast";

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

function rejectionMessage(row) {
  const firstName = (row.clients?.name || "").trim().split(" ")[0] || "there";
  const reasonPart = row.rejection_reason ? ` (${row.rejection_reason})` : "";
  return `Hi ${firstName}, this is Ravi — I couldn't confirm your last payment screenshot${reasonPart}. Could you send it again, or a fresh one? Thanks!`;
}

async function viewProof(path, setBusyPath, showToast) {
  setBusyPath(path);
  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 120);
  setBusyPath(null);
  if (error || !data) {
    showToast("Could not load screenshot. Try again.", "error");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener");
}

const DUPLICATE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function findPossibleDuplicate(row, allRows) {
  if (row.status !== "submitted" && row.status !== "confirmed") return null;
  const clientId = row.clients?.id;
  if (!clientId) return null;
  const rowTime = new Date(row.status === "confirmed" ? row.confirmed_at || row.submitted_at : row.submitted_at).getTime();
  return (
    allRows.find((other) => {
      if (other.id === row.id) return false;
      if (other.clients?.id !== clientId) return false;
      if (other.status !== "confirmed") return false;
      const otherTime = new Date(other.confirmed_at || other.submitted_at).getTime();
      return Math.abs(otherTime - rowTime) <= DUPLICATE_WINDOW_MS;
    }) || null
  );
}

export default function PaymentsView({ rows, onReload }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [busyPath, setBusyPath] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const toast = useToast();

  const [rejectId, setRejectId] = useState(null);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectError, setRejectError] = useState(null);

  const [confirmRow, setConfirmRow] = useState(null);
  const [confirmAmountBusy, setConfirmAmountBusy] = useState(false);
  const [confirmAmountError, setConfirmAmountError] = useState(null);

  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const [editRow, setEditRow] = useState(null);

  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

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
      toast("Could not update. Try again.", "error");
      return;
    }
    onReload();
  }

  function openReject(id) {
    setRejectId(id);
    setRejectError(null);
  }

  function cancelReject() {
    if (rejectBusy) return;
    setRejectId(null);
    setRejectError(null);
  }

  async function submitReject(reason) {
    setRejectBusy(true);
    setRejectError(null);
    const { error } = await supabase
      .from("payments")
      .update({ status: "rejected", rejection_reason: reason || null, confirmed_at: null })
      .eq("id", rejectId);
    setRejectBusy(false);
    if (error) {
      setRejectError("Could not update. Try again.");
      return;
    }
    setRejectId(null);
    onReload();
  }

  function confirmPayment(row) {
    const dup = findPossibleDuplicate(row, rows);
    if (dup) {
      setDuplicateWarning({ row, dup });
      return;
    }
    proceedConfirm(row);
  }

  function proceedConfirm(row) {
    if (row.amount == null) {
      setConfirmRow(row);
      setConfirmAmountError(null);
      return;
    }
    setStatus(row.id, { status: "confirmed", confirmed_at: new Date().toISOString() });
  }

  function confirmDespiteDuplicate() {
    const row = duplicateWarning.row;
    setDuplicateWarning(null);
    proceedConfirm(row);
  }

  function cancelDuplicateWarning() {
    setDuplicateWarning(null);
  }

  function cancelConfirmAmount() {
    if (confirmAmountBusy) return;
    setConfirmRow(null);
    setConfirmAmountError(null);
  }

  async function submitConfirmAmount(value) {
    const fields = { status: "confirmed", confirmed_at: new Date().toISOString() };
    if (value !== "") fields.amount = Number(value);
    setConfirmAmountBusy(true);
    setConfirmAmountError(null);
    const { error } = await supabase.from("payments").update(fields).eq("id", confirmRow.id);
    setConfirmAmountBusy(false);
    if (error) {
      setConfirmAmountError("Could not update. Try again.");
      return;
    }
    setConfirmRow(null);
    onReload();
  }

  function askDeleteManual(id) {
    setPendingDeleteId(id);
    setDeleteError(null);
  }

  function cancelDeleteManual() {
    if (deleteBusy) return;
    setPendingDeleteId(null);
    setDeleteError(null);
  }

  async function confirmDeleteManual() {
    setDeleteBusy(true);
    setDeleteError(null);
    const { error } = await supabase.from("payments").delete().eq("id", pendingDeleteId);
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
              <th>Submitted</th><th>Client</th><th>Type</th><th>Details</th><th>Amount</th><th>Txn Ref</th><th>Proof</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="loading-cell">No matching records.</td></tr>
            )}
            {filtered.map((r) => {
              const c = r.clients || {};
              const details = [c.age ? c.age + " yrs" : null, c.height_cm ? c.height_cm + " cm" : null, c.weight_kg ? c.weight_kg + " kg" : null, c.diet]
                .filter(Boolean)
                .join(" · ") || "—";
              const dup = findPossibleDuplicate(r, rows);
              return (
                <tr key={r.id}>
                  <td data-label="Submitted">{formatDate(r.submitted_at)}</td>
                  <td data-label="Client"><div className="cell-name">{c.name || "—"}</div><div className="cell-sub">{c.phone || ""}</div></td>
                  <td data-label="Type">
                    <span className="badge badge-type">{r.client_type}</span>
                    {r.source === "admin_manual" && <span className="badge badge-manual">Manual</span>}
                  </td>
                  <td className="cell-sub" data-label="Details">{details}</td>
                  <td data-label="Amount">{r.amount != null ? "₹" + r.amount : "—"}</td>
                  <td className="cell-sub" data-label="Txn Ref">{r.transaction_ref || "—"}</td>
                  <td data-label="Proof">
                    {r.screenshot_path ? (
                      <button className="row-btn view-btn" disabled={busyPath === r.screenshot_path} onClick={() => viewProof(r.screenshot_path, setBusyPath, toast)}>
                        {busyPath === r.screenshot_path ? "…" : "View"}
                      </button>
                    ) : (
                      <span className="cell-sub">—</span>
                    )}
                  </td>
                  <td data-label="Status">
                    <div className="status-cell">
                      <StatusBadge row={r} />
                      {dup && (
                        <span className="badge badge-soon" title={`Possibly a duplicate — this client already has a confirmed payment on ${formatDate(dup.confirmed_at || dup.submitted_at)}`}>
                          ⚠ Possible dup
                        </span>
                      )}
                    </div>
                  </td>
                  <td data-label="Actions">
                    <div className="actions-cell">
                      {r.status === "submitted" && (
                        <>
                          <button className="row-btn confirm-btn" disabled={busyId === r.id} onClick={() => confirmPayment(r)}>Mark confirmed</button>
                          <button className="row-btn reject-btn" disabled={busyId === r.id} onClick={() => openReject(r.id)}>Reject</button>
                        </>
                      )}
                      {r.status === "confirmed" && (
                        <>
                          <button className="row-btn edit-client-btn" disabled={busyId === r.id} onClick={() => setEditRow(r)}>Edit</button>
                          <button className="row-btn undo-btn" disabled={busyId === r.id} onClick={() => setStatus(r.id, { status: "submitted", confirmed_at: null, rejection_reason: null })}>Undo</button>
                        </>
                      )}
                      {r.status === "rejected" && (
                        <>
                          <button className="row-btn undo-btn" disabled={busyId === r.id} onClick={() => setStatus(r.id, { status: "submitted", confirmed_at: null, rejection_reason: null })}>Restore</button>
                          {c.phone && (
                            <a className="row-btn" href={waLinkTo(c.phone, rejectionMessage(r))} target="_blank" rel="noopener">Notify</a>
                          )}
                        </>
                      )}
                      {r.source === "admin_manual" && (
                        <button className="row-btn reject-btn" disabled={busyId === r.id} onClick={() => askDeleteManual(r.id)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showLogModal && (
        <LogPaymentModal
          clients={dedupeClients(rows).filter((c) => !c.archived)}
          rows={rows}
          initialClient={null}
          onClose={() => setShowLogModal(false)}
          onLogged={onReload}
        />
      )}

      {rejectId && (
        <PromptDialog
          title="Reject this payment"
          message="Shown only in the admin view — the client won't see this."
          label="Reason (optional)"
          type="text"
          placeholder="e.g. blurry screenshot, wrong amount"
          optional
          confirmLabel="Reject"
          busy={rejectBusy}
          submitError={rejectError}
          onSubmit={submitReject}
          onCancel={cancelReject}
        />
      )}

      {confirmRow && (
        <PromptDialog
          title="Confirm this payment"
          message="Enter the amount you received, or leave it blank if you're not sure yet."
          label="Amount (₹)"
          type="number"
          inputMode="decimal"
          placeholder="e.g. 1500"
          optional
          validate={isValidAmount}
          errorMessage="Enter an amount between ₹1 and ₹1,00,000, or leave it blank."
          confirmLabel="Confirm"
          busy={confirmAmountBusy}
          submitError={confirmAmountError}
          onSubmit={submitConfirmAmount}
          onCancel={cancelConfirmAmount}
        />
      )}

      {pendingDeleteId && (
        <ConfirmDialog
          title="Delete this payment?"
          message="This manually-logged payment record will be permanently removed."
          confirmLabel="Delete"
          danger
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDeleteManual}
          onCancel={cancelDeleteManual}
        />
      )}

      {editRow && (
        <EditPaymentModal
          payment={editRow}
          onClose={() => setEditRow(null)}
          onSaved={onReload}
        />
      )}

      {duplicateWarning && (
        <ConfirmDialog
          title="Possible duplicate payment"
          message={`${duplicateWarning.row.clients?.name || "This client"} already has a confirmed payment on ${formatDate(duplicateWarning.dup.confirmed_at || duplicateWarning.dup.submitted_at)}. Confirm this one too?`}
          confirmLabel="Confirm anyway"
          danger={false}
          onConfirm={confirmDespiteDuplicate}
          onCancel={cancelDuplicateWarning}
        />
      )}
    </div>
  );
}
