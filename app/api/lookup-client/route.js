import { isValidPhone } from "@/app/lib/validators";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function json(status, body) {
  return Response.json(body, { status });
}

export async function GET(req) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set in this project's environment variables.");
    return json(500, { code: "server_not_configured" });
  }

  const phone = (new URL(req.url).searchParams.get("phone") || "").trim();
  if (!isValidPhone(phone)) {
    return json(400, { code: "invalid_phone" });
  }

  const headers = {
    apikey: serviceKey,
    Authorization: "Bearer " + serviceKey,
  };
  
  let clientRes;
  try {
    clientRes = await fetch(
      SUPABASE_URL + "/rest/v1/clients?phone=eq." + encodeURIComponent(phone) + "&select=id&limit=1",
      { headers }
    );
  } catch (err) {
    console.error("lookup-client (clients) request failed:", err);
    return json(502, { code: "network_error" });
  }
  if (!clientRes.ok) {
    console.error("lookup-client (clients) query rejected:", clientRes.status, await clientRes.text());
    return json(502, { code: "lookup_failed" });
  }
  const clients = await clientRes.json();
  if (clients.length === 0) {
    return json(200, { clientType: "New" });
  }

  // Step 2: do they have a payment where they actually agreed to the terms?
  const clientId = clients[0].id;
  let paymentRes;
  try {
    paymentRes = await fetch(
      SUPABASE_URL + "/rest/v1/payments?client_id=eq." + encodeURIComponent(clientId) +
        "&tc_agreed_at=not.is.null&select=id&limit=1",
      { headers }
    );
  } catch (err) {
    console.error("lookup-client (payments) request failed:", err);
    return json(502, { code: "network_error" });
  }
  if (!paymentRes.ok) {
    console.error("lookup-client (payments) query rejected:", paymentRes.status, await paymentRes.text());
    return json(502, { code: "lookup_failed" });
  }
  const payments = await paymentRes.json();
  return json(200, { clientType: payments.length > 0 ? "Existing" : "New" });
}
