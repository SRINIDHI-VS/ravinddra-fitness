import {
  isValidName,
  isValidPhone,
  isInRange,
  isValidDiet,
  isValidClientType,
  MAX_FILE_BYTES,
  ALLOWED_FILE_TYPES,
} from "@/app/lib/validators";
import { checkSubmitRateLimit } from "@/app/lib/server/rateLimit";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function sanitizeFileName(name) {
  return (name || "proof").replace(/[^a-zA-Z0-9.]+/g, "-");
}

function randomToken() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

function json(status, body) {
  return Response.json(body, { status });
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v) {
  return v === null || v === undefined || v === "" ? null : v;
}

export async function POST(req) {
  const { allowed } = await checkSubmitRateLimit(req);
  if (!allowed) {
    return json(429, { code: "rate_limited" });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set in this project's environment variables.");
    return json(500, { code: "server_not_configured" });
  }

  const url = new URL(req.url);
  const params = url.searchParams;
  const phone = (params.get("phone") || "").trim();
  const fileName = params.get("filename") || "proof";
  const contentType = req.headers.get("content-type") || "";

  if (!isValidPhone(phone)) {
    return json(400, { code: "invalid_phone" });
  }
  if (!ALLOWED_FILE_TYPES.includes(contentType)) {
    return json(400, { code: "invalid_file_type" });
  }

  const clientType = params.get("client_type") || "";
  if (!isValidClientType(clientType)) {
    return json(400, { code: "invalid_client_type" });
  }
  const name = (params.get("name") || "").trim();
  if (!isValidName(name)) {
    return json(400, { code: "invalid_name" });
  }
  if (clientType === "New") {
    const diet = params.get("diet") || "";
    if (!isInRange(params.get("age"), "age")) return json(400, { code: "invalid_age" });
    if (!isInRange(params.get("height_cm"), "height_cm")) return json(400, { code: "invalid_height" });
    if (!isInRange(params.get("weight_kg"), "weight_kg")) return json(400, { code: "invalid_weight" });
    if (!isValidDiet(diet)) return json(400, { code: "invalid_diet" });
  }

  let bytes;
  try {
    bytes = await req.arrayBuffer();
  } catch {
    return json(400, { code: "upload_failed" });
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_FILE_BYTES) {
    return json(400, { code: "invalid_file_size" });
  }

  const path = phone + "/" + Date.now() + "-" + randomToken() + "-" + sanitizeFileName(fileName);

  let uploadRes;
  try {
    uploadRes = await fetch(SUPABASE_URL + "/storage/v1/object/payment-proofs/" + path, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: bytes,
    });
  } catch (err) {
    console.error("Storage upload request failed:", err);
    return json(502, { code: "upload_failed" });
  }

  if (!uploadRes.ok) {
    const detail = await uploadRes.text();
    console.error("Storage upload rejected:", uploadRes.status, detail);
    return json(502, { code: "upload_failed" });
  }

  const rpcBody = {
    p_name: name,
    p_phone: phone,
    p_client_type: clientType,
    p_screenshot_path: path,
    p_age: numOrNull(params.get("age")),
    p_height_cm: numOrNull(params.get("height_cm")),
    p_weight_kg: numOrNull(params.get("weight_kg")),
    p_diet: strOrNull(params.get("diet")),
    p_tc_agreed_at: strOrNull(params.get("tc_agreed_at")),
    p_tc_version: strOrNull(params.get("tc_version")),
    p_amount: numOrNull(params.get("amount")),
    p_transaction_ref: strOrNull(params.get("transaction_ref")),
  };

  let rpcRes;
  try {
    rpcRes = await fetch(SUPABASE_URL + "/rest/v1/rpc/submit_enrollment", {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(rpcBody),
    });
  } catch (err) {
    console.error("submit_enrollment request failed:", err);
    await deleteObject(path, serviceKey);
    return json(502, { code: "network_error" });
  }

  if (!rpcRes.ok) {
    const detail = await rpcRes.json().catch(() => ({}));
    console.error("submit_enrollment rejected:", rpcRes.status, detail);
    await deleteObject(path, serviceKey);
    return json(400, { code: detail?.message || "submission_failed" });
  }

  return json(200, { ok: true });
}

async function deleteObject(path, serviceKey) {
  try {
    await fetch(SUPABASE_URL + "/storage/v1/object/payment-proofs/" + path, {
      method: "DELETE",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
      },
    });
  } catch (err) {
    console.error("Cleanup delete failed for", path, err);
  }
}
