"use client";

import { Fragment, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { mergeClientsWithStats } from "@/app/lib/clients";
import { exportClientsCsv } from "./csv";
import LogPaymentModal from "./LogPaymentModal";
import AddClientModal from "./AddClientModal";
import EditClientModal from "./EditClientModal";
import ConfirmDialog from "./ConfirmDialog";

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function ClientsView({ clients, rows, onReload }) {
  const [expandedId, setExpandedId] = useState(null);
  const [logClient, setLogClient] = useState(null);
  const [addingClient, setAddingClient] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientFilter, setClientFilter] = useState("active");
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState(null);

  const allClients = mergeClientsWithStats(clients, rows);
  const filtered = allClients.filter((c) => {
    if (clientFilter === "active") return !c.archived;
    if (clientFilter === "archived") return c.archived;
    return true;
  });
  const logPaymentClients = allClients.filter((c) => !c.archived);

  function askArchive(client) {
    setArchiveTarget({ client, archiving: true });
    setArchiveError(null);
  }

  function askUnarchive(client) {
    setArchiveTarget({ client, archiving: false });
    setArchiveError(null);
  }

  function cancelArchive() {
    if (archiveBusy) return;
    setArchiveTarget(null);
    setArchiveError(null);
  }

  async function confirmArchiveToggle() {
    const { client, archiving } = archiveTarget;
    setArchiveBusy(true);
    setArchiveError(null);
    const { error } = await supabase
      .from("clients")
      .update({ archived: archiving, archived_at: archiving ? new Date().toISOString() : null })
      .eq("id", client.id);
    setArchiveBusy(false);
    if (error) {
      setArchiveError("Could not update. Try again.");
      return;
    }
    setArchiveTarget(null);
    onReload();
  }

  return (
    <>
      <div className="toolbar">
        <div className="filter-tabs">
          {["active", "archived", "all"].map((f) => (
            <button key={f} className={"filter-tab" + (clientFilter === f ? " active" : "")} onClick={() => setClientFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" type="button" onClick={() => setAddingClient(true)}>+ Add Client</button>
          <button className="btn btn-ghost" type="button" onClick={() => exportClientsCsv(allClients, rows)}>Export CSV</button>
        </div>
      </div>
      <p className="renewals-note">Every client on file — including anyone you've added directly, with everything they gave you.</p>

      {allClients.length === 0 ? (
        <div className="table-wrap">
          <table className="payments-table">
            <tbody><tr><td className="loading-cell">No clients yet.</td></tr></tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="payments-table">
            <thead>
              <tr><th>Client</th><th>Details</th><th>Payments</th><th>T&amp;C Agreed</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="loading-cell">No matching clients.</td></tr>
              )}
              {filtered.map((c) => {
                const isOpen = expandedId === c.id;
                const history = rows
                  .filter((r) => r.clients && r.clients.id === c.id)
                  .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
                const details = [c.age != null ? c.age + " yrs" : null, c.height_cm != null ? c.height_cm + " cm" : null, c.weight_kg != null ? c.weight_kg + " kg" : null, c.diet]
                  .filter(Boolean)
                  .join(" · ") || "—";
                return (
                  <Fragment key={c.id}>
                    <tr className="client-row" onClick={() => setExpandedId(isOpen ? null : c.id)}>
                      <td data-label="Client">
                        <button className="expand-btn" type="button" aria-expanded={isOpen} onClick={(e) => { e.stopPropagation(); setExpandedId(isOpen ? null : c.id); }}>
                          {isOpen ? "▾" : "▶"}
                        </button>
                        <div className="cell-name">{c.name || "—"}{c.archived && <span className="badge badge-type" style={{ marginLeft: 6 }}>Archived</span>}{c.paymentCount === 0 && <span className="badge badge-type" style={{ marginLeft: 6 }}>No payment yet</span>}</div>
                        <div className="cell-sub">{c.phone || ""}</div>
                      </td>
                      <td className="cell-sub" data-label="Details">{details}</td>
                      <td data-label="Payments">{c.paymentCount}</td>
                      <td data-label="T&C Agreed">
                        <div className="cell-sub" style={{ marginBottom: 8 }}>{c.tcAgreedAt ? formatDate(c.tcAgreedAt) : "—"}</div>
                        <div className="actions-cell">
                          <button className="row-btn" type="button" onClick={(e) => { e.stopPropagation(); setEditingClient(c); }}>Edit</button>
                          {!c.archived && (
                            <button className="row-btn" type="button" onClick={(e) => { e.stopPropagation(); setLogClient(c); }}>Log renewal</button>
                          )}
                          {c.archived ? (
                            <button className="row-btn" type="button" onClick={(e) => { e.stopPropagation(); askUnarchive(c); }}>Unarchive</button>
                          ) : (
                            <button className="row-btn" type="button" onClick={(e) => { e.stopPropagation(); askArchive(c); }}>Archive</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="client-history-row">
                        <td colSpan={4}>
                          {(c.medical_condition || c.fitness_goal) && (
                            <div style={{ marginBottom: 14, display: "grid", gap: 8 }}>
                              {c.medical_condition && (
                                <div className="cell-sub"><strong style={{ color: "var(--text)" }}>Medical: </strong>{c.medical_condition}</div>
                              )}
                              {c.fitness_goal && (
                                <div className="cell-sub"><strong style={{ color: "var(--text)" }}>Goal: </strong>{c.fitness_goal}</div>
                              )}
                            </div>
                          )}
                          {history.length === 0 ? (
                            <p className="cell-sub">No payments logged yet.</p>
                          ) : (
                            <table className="payments-table history-table">
                              <thead><tr><th>Submitted</th><th>Type</th><th>Status</th></tr></thead>
                              <tbody>
                                {history.map((r) => (
                                  <tr key={r.id}>
                                    <td data-label="Submitted">{formatDate(r.submitted_at)}</td>
                                    <td data-label="Type"><span className="badge badge-type">{r.client_type}</span></td>
                                    <td data-label="Status">
                                      {r.status === "confirmed" && <span className="badge badge-confirmed">Confirmed</span>}
                                      {r.status === "rejected" && <span className="badge badge-rejected">Rejected</span>}
                                      {r.status === "skipped" && <span className="badge badge-type">No payment</span>}
                                      {r.status === "submitted" && <span className="badge badge-pending">Pending</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {addingClient && (
        <AddClientModal
          onClose={() => setAddingClient(false)}
          onSaved={onReload}
        />
      )}

      {logClient && (
        <LogPaymentModal
          clients={logPaymentClients}
          rows={rows}
          initialClient={logClient}
          onClose={() => setLogClient(null)}
          onLogged={onReload}
        />
      )}

      {editingClient && (
        <EditClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSaved={onReload}
        />
      )}

      {archiveTarget && (
        <ConfirmDialog
          title={archiveTarget.archiving ? "Archive this client?" : "Unarchive this client?"}
          message={
            archiveTarget.archiving
              ? `${archiveTarget.client.name || "This client"} will be hidden from your active list and from client search when logging new payments or sessions. Their payment and attendance history stays exactly as it is, and you can unarchive them anytime.`
              : `${archiveTarget.client.name || "This client"} will reappear in your active client list and become searchable again when logging payments or sessions.`
          }
          confirmLabel={archiveTarget.archiving ? "Archive" : "Unarchive"}
          danger={false}
          busy={archiveBusy}
          error={archiveError}
          onConfirm={confirmArchiveToggle}
          onCancel={cancelArchive}
        />
      )}
    </>
  );
}
