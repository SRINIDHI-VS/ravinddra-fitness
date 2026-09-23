"use client";

import { Fragment, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { isValidPhone } from "@/app/lib/validators";
import { dedupeClients } from "@/app/lib/clients";
import LogPaymentModal from "./LogPaymentModal";

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function ClientsView({ rows, onReload }) {
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [logClient, setLogClient] = useState(null);
  const clients = dedupeClients(rows);

  async function editClient(client) {
    let newName = prompt("Client name:", client.name || "");
    if (newName === null) return;
    newName = newName.trim();
    if (newName.length < 2) { alert("Name must be at least 2 letters."); return; }
    let newPhone = prompt("Phone number (10 digits, starting 6-9):", client.phone || "");
    if (newPhone === null) return;
    newPhone = newPhone.trim();
    if (!isValidPhone(newPhone)) { alert("That doesn't look like a valid 10-digit phone number."); return; }
    setBusyId(client.id);
    const { error } = await supabase.from("clients").update({ name: newName, phone: newPhone }).eq("id", client.id);
    setBusyId(null);
    if (error) {
      alert(error.message && error.message.includes("duplicate") ? "Another client already has that phone number." : "Could not update. Try again.");
      return;
    }
    onReload();
  }

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
      <p className="renewals-note">Every client who has ever submitted, with everything they gave you — no need to dig through email or WhatsApp.</p>
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
                    <td>
                      <button className="expand-btn" type="button" aria-expanded={isOpen} onClick={(e) => { e.stopPropagation(); setExpandedId(isOpen ? null : c.id); }}>
                        {isOpen ? "▾" : "▶"}
                      </button>
                      <div className="cell-name">{c.name || "—"}</div>
                      <div className="cell-sub">{c.phone || ""}</div>
                    </td>
                    <td>{c.age != null ? c.age + " yrs" : "—"}</td>
                    <td>{c.height_cm != null ? c.height_cm + " cm" : "—"}</td>
                    <td>{c.weight_kg != null ? c.weight_kg + " kg" : "—"}</td>
                    <td>{c.diet || "—"}</td>
                    <td>{c.paymentCount}</td>
                    <td>
                      {c.tcAgreedAt ? formatDate(c.tcAgreedAt) : "—"}
                      <button className="row-btn edit-client-btn" type="button" disabled={busyId === c.id} onClick={(e) => { e.stopPropagation(); editClient(c); }}>Edit</button>
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
                                <td>{formatDate(r.submitted_at)}</td>
                                <td><span className="badge badge-type">{r.client_type}</span></td>
                                <td>{r.status === "confirmed" ? <span className="badge badge-confirmed">Confirmed</span> : <span className="badge badge-pending">Pending</span>}</td>
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
    </>
  );
}
