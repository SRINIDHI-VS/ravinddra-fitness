// Public self-serve status check: a client enters their phone number and
// sees the factual record we actually have — member-since date, how many
// payments they've made, and their last payment's status. Deliberately does
// NOT compute or guess a "next payment due" date: the T&C's 4-week blocks
// are counted by classes actually attended/made-up, and this app only
// tracks payments, not attendance, so any date we computed here could be
// wrong and cause a real dispute. Message Ravi directly for that instead.

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
    console.error("client-status query failed:", err);
    return json(502, { code: "lookup_failed" });
  }

  if (!record || record.agreedPayments.length === 0) {
    return json(200, { found: false });
  }

  const last = record.agreedPayments[record.agreedPayments.length - 1];
  return json(200, {
    found: true,
    name: record.name,
    memberSince: record.agreedPayments[0].submitted_at,
    totalPayments: record.agreedPayments.length,
    lastPayment: {
      status: last.status,
      submittedAt: last.submitted_at,
      confirmedAt: last.confirmed_at,
    },
  });
}
