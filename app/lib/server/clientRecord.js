const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function findClientByPhone(phone, serviceKey) {
  const headers = {
    apikey: serviceKey,
    Authorization: "Bearer " + serviceKey,
  };

  const clientRes = await fetch(
    SUPABASE_URL + "/rest/v1/clients?phone=eq." + encodeURIComponent(phone) + "&select=id,name&limit=1",
    { headers }
  );
  if (!clientRes.ok) {
    throw new Error("clients_query_failed");
  }
  const clients = await clientRes.json();
  if (clients.length === 0) {
    return null;
  }

  const client = clients[0];
  const paymentsRes = await fetch(
    SUPABASE_URL + "/rest/v1/payments?client_id=eq." + encodeURIComponent(client.id) +
      "&select=id,status,tc_agreed_at,submitted_at,confirmed_at,amount&order=submitted_at.asc",
    { headers }
  );
  if (!paymentsRes.ok) {
    throw new Error("payments_query_failed");
  }
  const payments = await paymentsRes.json();
  const agreedPayments = payments.filter((p) => p.tc_agreed_at);

  let sessions = [];
  try {
    const sessionsRes = await fetch(
      SUPABASE_URL + "/rest/v1/class_sessions?client_id=eq." + encodeURIComponent(client.id) +
        "&select=id,class_date,status&order=class_date.desc&limit=10",
      { headers }
    );
    if (sessionsRes.ok) {
      sessions = await sessionsRes.json();
    }
  } catch {
    sessions = [];
  }

  return {
    id: client.id,
    name: client.name,
    payments,
    agreedPayments,
    sessions,
  };
}
