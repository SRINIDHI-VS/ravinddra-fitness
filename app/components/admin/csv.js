import { dedupeClients } from "@/app/lib/clients";

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

export function exportClientsCsv(rows) {
  const clients = dedupeClients(rows);
  const header = ["Name", "Phone", "Age", "Height (cm)", "Weight (kg)", "Diet", "Total Payments", "T&C Agreed", "Last Payment Date", "Last Payment Status"];
  const lines = [header.map(csvField).join(",")];
  clients.forEach((c) => {
    const history = rows
      .filter((r) => r.clients && r.clients.id === c.id)
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    const last = history[0];
    lines.push(
      [c.name, c.phone, c.age, c.height_cm, c.weight_kg, c.diet, c.paymentCount, c.tcAgreedAt, last ? last.submitted_at : "", last ? last.status : ""]
        .map(csvField)
        .join(",")
    );
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ravi-fitness-clients-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSessionsCsv(rows) {
  const header = ["Date", "Client", "Phone", "Status", "Notes"];
  const lines = [header.map(csvField).join(",")];
  rows.forEach((r) => {
    const c = r.clients || {};
    lines.push(
      [r.class_date, c.name, c.phone, r.status, r.notes]
        .map(csvField)
        .join(",")
    );
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ravi-fitness-attendance-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
