// Looks a phone number up against the clients/payments tables so the enroll
// form can decide New vs Existing itself, instead of asking the visitor to
// pick — and, for an Existing client, also hands back their name and how
// many payments they've completed, so the form can greet them by name
// instead of asking them to retype it. Read-only, and — like every other
// route here — uses the service-role key server-side so the public form
// still never touches Supabase directly.
//
// "Existing" means: this phone belongs to a client who has at least one
// payment on file where they agreed to the terms (tc_agreed_at is set). That
// is the exact same definition submit_enrollment already uses to accept or
// reject client_type=Existing at submit time, so this can never tell someone
// they're "New" here and then get rejected as unenrolled at the end, or the
// other way round.
//
// Trade-off worth knowing: anyone who knows or guesses a valid-format phone
// number can now learn whether it belongs to one of Ravi's clients, and if
// so, that client's name. There's no OTP or login here — see the New/Existing
// lookup this route already did before. For a personal trainer's client
// list this is a low-stakes trade for a much less annoying enrollment form.

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

  return json(200, {
    clientType: "Existing",
    name: record.name,
    paymentCount: record.agreedPayments.length,
  });
}
