// Builds { paymentCount, tcAgreedAt } per client id from the payments rows (payments joined
// with clients, as loaded by AdminDashboard). Used to lay payment history on top of the master
// client list below — a client with zero payments simply gets the zero/null defaults.
function statsFromRows(rows) {
  const stats = {};
  rows.forEach((r) => {
    const c = r.clients;
    if (!c) return;
    if (!stats[c.id]) stats[c.id] = { paymentCount: 0, tcAgreedAt: null };
    const s = stats[c.id];
    s.paymentCount++;
    if (r.tc_agreed_at && (!s.tcAgreedAt || new Date(r.tc_agreed_at) > new Date(s.tcAgreedAt))) {
      s.tcAgreedAt = r.tc_agreed_at;
    }
  });
  return stats;
}

// The master client list (every row in `clients`, including ones with no payment yet — added
// directly from the admin dashboard) with payment stats layered on from the payments rows.
// This is the source of truth for anything that needs "every client", as opposed to
// deriving the list from payment rows alone (which misses clients with no payment on file).
export function mergeClientsWithStats(clients, rows) {
  const stats = statsFromRows(rows);
  return (clients || [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      age: c.age,
      height_cm: c.height_cm,
      weight_kg: c.weight_kg,
      diet: c.diet,
      medical_condition: c.medical_condition,
      fitness_goal: c.fitness_goal,
      archived: !!c.archived,
      archivedAt: c.archived_at || null,
      paymentCount: stats[c.id]?.paymentCount || 0,
      tcAgreedAt: stats[c.id]?.tcAgreedAt || null,
    }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export function lastPaymentAmount(rows, clientId) {
  const forClient = rows
    .filter((r) => r.clients && r.clients.id === clientId && r.amount != null)
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  return forClient.length ? String(forClient[0].amount) : "";
}
