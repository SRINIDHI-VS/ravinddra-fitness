"use client";

import { CONTACT, waLinkTo } from "@/app/lib/siteConfig";

const CYCLE_DAYS = 28;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function computeRenewals(rows) {
  // Based on the last CONFIRMED payment, not merely submitted — a screenshot
  // sitting in "pending" hasn't actually been verified yet, so it shouldn't
  // reset anyone's cycle.
  const byClient = {};
  rows.forEach((r) => {
    if (r.status !== "confirmed" || !r.confirmed_at) return;
    const c = r.clients;
    if (!c) return;
    const existing = byClient[c.id];
    if (!existing || new Date(r.confirmed_at) > new Date(existing.confirmed_at)) {
      byClient[c.id] = { name: c.name, phone: c.phone, confirmed_at: r.confirmed_at };
    }
  });
  const now = new Date();
  const list = Object.values(byClient).map((entry) => {
    const lastDate = new Date(entry.confirmed_at);
    const nextDue = new Date(lastDate.getTime() + CYCLE_DAYS * MS_PER_DAY);
    const daysUntil = Math.ceil((nextDue - now) / MS_PER_DAY);
    const status = daysUntil < 0 ? "overdue" : daysUntil <= 3 ? "soon" : "ok";
    return { name: entry.name, phone: entry.phone, lastDate, nextDue, daysUntil, status };
  });
  list.sort((a, b) => a.nextDue - b.nextDue);
  return list;
}

function statusLabel(row) {
  if (row.status === "overdue") return "Overdue by " + Math.abs(row.daysUntil) + (Math.abs(row.daysUntil) === 1 ? " day" : " days");
  if (row.daysUntil === 0) return "Due today";
  if (row.status === "soon") return "Due in " + row.daysUntil + (row.daysUntil === 1 ? " day" : " days");
  return "Due in " + row.daysUntil + " days";
}

// One tap opens WhatsApp with this pre-filled — Ravi still has to hit send
// himself. Real automation (no tap required) needs WhatsApp Business API,
// which isn't set up yet.
function reminderMessage(row) {
  const firstName = (row.name || "").trim().split(" ")[0] || "there";
  if (row.status === "overdue") {
    const days = Math.abs(row.daysUntil);
    return `Hi ${firstName}, this is Ravi — just checking in, your payment for the next training block was due ${days} ${days === 1 ? "day" : "days"} ago. Let me know if you'd like to continue — you can pay via UPI (${CONTACT.upiId}) whenever you're ready.`;
  }
  if (row.daysUntil === 0) {
    return `Hi ${firstName}, this is Ravi — your next payment is due today. You can pay via UPI (${CONTACT.upiId}) whenever convenient.`;
  }
  return `Hi ${firstName}, this is Ravi — heads up, your next payment is due in ${row.daysUntil} ${row.daysUntil === 1 ? "day" : "days"}. You can pay via UPI (${CONTACT.upiId}) whenever convenient.`;
}

export default function RenewalsView({ rows }) {
  const renewals = computeRenewals(rows);
  const msg = rows.length ? "No confirmed payments yet — renewals appear here once you confirm one." : "No clients yet.";

  return (
    <>
      <p className="renewals-note">Next due date is estimated as each client&apos;s last submitted payment + 4 weeks (the week-wise cycle from your terms). Overdue means that estimate has already passed.</p>
      <div className="table-wrap">
        <table className="payments-table">
          <thead>
            <tr><th>Client</th><th>Last Payment</th><th>Next Due (est.)</th><th>Status</th></tr>
          </thead>
          <tbody>
            {renewals.length === 0 && <tr><td colSpan={4} className="loading-cell">{msg}</td></tr>}
            {renewals.map((r) => {
              const badgeClass = r.status === "overdue" ? "badge-overdue" : r.status === "soon" ? "badge-soon" : "badge-ok";
              return (
                <tr key={r.phone}>
                  <td><div className="cell-name">{r.name}</div><div className="cell-sub">{r.phone}</div></td>
                  <td>{formatDate(r.lastDate.toISOString())}</td>
                  <td>{formatDate(r.nextDue.toISOString())}</td>
                  <td>
                    <span className={"badge " + badgeClass}>{statusLabel(r)}</span>
                    {r.status !== "ok" && (
                      <a className="row-btn" href={waLinkTo(r.phone, reminderMessage(r))} target="_blank" rel="noopener">Remind</a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
