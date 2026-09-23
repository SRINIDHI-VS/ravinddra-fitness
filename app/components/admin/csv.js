// A client's name or transaction reference isn't validated for spreadsheet-safe
// characters server-side, so a value starting with =, +, - or @ could be read as
// a formula by Excel/Sheets when this file is opened there. Prefixing it with a
// quote keeps it as inert text without changing what's shown.
function csvField(v) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export function exportPaymentsCsv(rows) {
  const header = ["Submitted", "Client", "Phone", "Type", "Amount", "Transaction Ref", "Status", "Confirmed At", "Rejection Reason", "Logged By"];
  const lines = [header.map(csvField).join(",")];
  rows.forEach((r) => {
    const c = r.clients || {};
    lines.push(
      [r.submitted_at, c.name, c.phone, r.client_type, r.amount, r.transaction_ref, r.status, r.confirmed_at, r.rejection_reason, r.source === "admin_manual" ? "Ravi (manual)" : "Client"]
        .map(csvField)
        .join(",")
    );
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ravi-fitness-payments-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
