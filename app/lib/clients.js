export function dedupeClients(rows) {
  const byClient = {};
  rows.forEach((r) => {
    const c = r.clients;
    if (!c) return;
    if (!byClient[c.id]) {
      byClient[c.id] = {
        id: c.id,
        name: c.name,
        phone: c.phone,
        age: c.age,
        height_cm: c.height_cm,
        weight_kg: c.weight_kg,
        diet: c.diet,
        paymentCount: 0,
        tcAgreedAt: null,
      };
    }
    const entry = byClient[c.id];
    entry.paymentCount++;
    if (r.tc_agreed_at && (!entry.tcAgreedAt || new Date(r.tc_agreed_at) > new Date(entry.tcAgreedAt))) {
      entry.tcAgreedAt = r.tc_agreed_at;
    }
  });
  return Object.values(byClient).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export function lastPaymentAmount(rows, clientId) {
  const forClient = rows
    .filter((r) => r.clients && r.clients.id === clientId && r.amount != null)
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  return forClient.length ? String(forClient[0].amount) : "";
}
