import { isValidPhone } from "@/app/lib/validators";
import { findClientByPhone } from "@/app/lib/server/clientRecord";

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

  let record;
  try {
    record = await findClientByPhone(phone, serviceKey);
  } catch (err) {
    console.error("lookup-client query failed:", err);
    return json(502, { code: "lookup_failed" });
  }

  if (!record || record.agreedPayments.length === 0) {
    return json(200, { clientType: "New" });
  }

  const lastWithAmount = [...record.payments].reverse().find((p) => p.amount != null);

  return json(200, {
    clientType: "Existing",
    name: record.name,
    paymentCount: record.payments.length,
    lastAmount: lastWithAmount ? lastWithAmount.amount : null,
  });
}
