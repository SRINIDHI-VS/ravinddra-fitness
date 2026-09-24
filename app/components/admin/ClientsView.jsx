"use client";

import { Fragment, useState } from "react";
import { dedupeClients } from "@/app/lib/clients";
import { exportClientsCsv } from "./csv";
import LogPaymentModal from "./LogPaymentModal";
import EditClientModal from "./EditClientModal";

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function ClientsView({ rows, onReload }) {
  const [expandedId, setExpandedId] = useState(null);
  const [logClient, setLogClient] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const clients = dedupeClients(rows);

  if (!clients.length) {
    return (
      <div className="table-wrap">
        <table className="payments-table">
          <tbody><tr><td className="loading-cell">No clients yet.</td></tr></tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar">
        <p className="renewals-note" style={{ margin: 0 }}>Every client who has ever submitted, with everything they gave you — no need to dig through email or WhatsApp.</p>
        <button className="btn btn-ghost" type="button" onClick={() => exportClientsCsv(rows)}>Export CSV</button>
      </div>
      <div className="table-wrap">
        <table className="payments-table">
          <thead>
            <tr><th>Client</th><th>Age</th><th>Height</th><th>Weight</th><th>Diet</th><th>Payments</th><th>T&amp;C Agreed</th></tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const isOpen = expandedId === c.id;
              const history = rows
                .filter((r) => r.clients && r.clients.id === c.id)
                .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
              return (
                <Fragment key={c.id}>
                  <tr className="client-row" onClick={() => setExpandedId(isOpen ? null : c.id)}>
                    <td data-label="Client">
                      <button className="expand-btn" type="button" aria-expanded={isOpen} onClick={(e) => { e.stopPropagation(); setExpandedId(isOpen ? null : c.id); }}>
                        {isOpen ? "▾" : "▶"}
                      </button>
                      <div className="cell-name">{c.name || "—"}</div>
                      <div className="cell-sub">{c.phone || ""}</div>
                    </td>
                    <td data-label="Age">{c.age != null ? c.age + " yrs" : "—"}</td>
                    <td data-label="Height">{c.height_cm != null ? c.height_cm + " cm" : "—"}</td>
                    <td data-label="Weight">{c.weight_kg != null ? c.weight_kg + " kg" : "—"}</td>
                    <td data-label="Diet">{c.diet || "—"}</td>
                    <td data-label="Payments">{c.paymentCount}</td>
                    <td data-label="T&C Agreed">
                      {c.tcAgreedAt ? formatDate(c.tcAgreedAt) : "—"}
                      <button className="row-btn edit-client-btn" type="button" onClick={(e) => { e.stopPropagation(); setEditingClient(c); }}>Edit</button>
                      <button className="row-btn" type="button" onClick={(e) => { e.stopPropagation(); setLogClient(c); }}>Log renewal</button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="client-history-row">
                      <td colSpan={7}>
                        <table className="payments-table history-table">
                          <thead><tr><th>Submitted</th><th>Type</th><th>Status</th></tr></thead>
                          <tbody>
                            {history.map((r) => (
                              <tr key={r.id}>
                                <td data-label="Submitted">{formatDate(r.submitted_at)}</td>
                                <td data-label="Type"><span className="badge badge-type">{r.client_type}</span></td>
                                <td data-label="Status">{r.status === "confirmed" ? <span className="badge badge-confirmed">Confirmed</span> : <span className="badge badge-pending">Pending</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {logClient && (
        <LogPaymentModal
          clients={clients}
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
    </>
  );
}
