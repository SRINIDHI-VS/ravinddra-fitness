export const RENEWAL_CYCLE_DAYS = 28;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeRenewals(rows, cycleDays = RENEWAL_CYCLE_DAYS) {
  const byClient = {};
  rows.forEach((r) => {
    if (r.status !== "confirmed" || !r.confirmed_at) return;
    const c = r.clients;
    if (!c) return;
    const existing = byClient[c.id];
    if (!existing || new Date(r.confirmed_at) > new Date(existing.confirmed_at)) {
      byClient[c.id] = { id: c.id, name: c.name, phone: c.phone, confirmed_at: r.confirmed_at };
    }
  });
  const now = new Date();
  const list = Object.values(byClient).map((entry) => {
    const lastDate = new Date(entry.confirmed_at);
    const nextDue = new Date(lastDate.getTime() + cycleDays * MS_PER_DAY);
    const daysUntil = Math.ceil((nextDue - now) / MS_PER_DAY);
    const status = daysUntil < 0 ? "overdue" : daysUntil <= 3 ? "soon" : "ok";
    return { id: entry.id, name: entry.name, phone: entry.phone, lastDate, nextDue, daysUntil, status };
  });
  list.sort((a, b) => a.nextDue - b.nextDue);
  return list;
}
