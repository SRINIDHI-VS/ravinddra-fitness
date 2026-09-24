import { isValidPhone } from "@/app/lib/validators";
import { findClientByPhone } from "@/app/lib/server/clientRecord";
import { checkLookupRateLimit } from "@/app/lib/server/rateLimit";

function json(status, body) {
  return Response.json(body, { status });
}

export async function GET(req) {
  const { allowed } = await checkLookupRateLimit(req);
  if (!allowed) {
    return json(429, { code: "rate_limited" });
  }

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
    console.error("client-status query failed:", err);
    return json(502, { code: "lookup_failed" });
  }

  if (!record || record.agreedPayments.length === 0) {
    return json(200, { found: false });
  }

  const last = record.payments[record.payments.length - 1];
  return json(200, {
    found: true,
    name: record.name,
    memberSince: record.agreedPayments[0].submitted_at,
    totalPayments: record.payments.length,
    lastPayment: {
      status: last.status,
      submittedAt: last.submitted_at,
      confirmedAt: last.confirmed_at,
    },
    recentSessions: (record.sessions || []).map((s) => ({ date: s.class_date, status: s.status })),
  });
}
