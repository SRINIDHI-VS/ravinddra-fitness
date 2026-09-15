// Handles the whole public submission: uploads the payment-proof screenshot
// and writes the enrollment record, both using the Supabase service-role key
// (set as the SUPABASE_SERVICE_ROLE_KEY environment variable in Netlify's
// site settings — never put that key in any file the browser can see).
//
// Doing this server-side, in one place, is what lets the public website have
// ZERO direct access to the storage bucket: with no anon policy on
// storage.objects, nobody can list or download other clients' screenshots
// using the (unavoidably public) anon key, which is exactly the hole this
// replaces. It also means a submission that uploads fine but then fails the
// database write doesn't leave an orphaned file behind — this function
// deletes it again before reporting the error back to the visitor.

const SUPABASE_URL = "https://yjgmknysqqnallpacbyh.supabase.co";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

function sanitizeFileName(name) {
  return (name || "proof").replace(/[^a-zA-Z0-9.]+/g, "-");
}

function randomToken() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { "Content-Type": "application/json" }
  });
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  var n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v) {
  return v === null || v === undefined || v === "" ? null : v;
}

export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set in this site's environment variables.");
    return json(500, { code: "server_not_configured" });
  }

  const url = new URL(req.url);
  const params = url.searchParams;
  const phone = (params.get("phone") || "").trim();
  const fileName = params.get("filename") || "proof";
  const contentType = req.headers.get("content-type") || "";

  if (!/^[6-9]\d{9}$/.test(phone)) {
    return json(400, { code: "invalid_phone" });
  }
  if (ALLOWED_TYPES.indexOf(contentType) === -1) {
    return json(400, { code: "invalid_file_type" });
  }

  let bytes;
  try {
    bytes = await req.arrayBuffer();
  } catch (err) {
    return json(400, { code: "upload_failed" });
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
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
        "x-upsert": "false"
      },
      body: bytes
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
    p_name: params.get("name") || "",
    p_phone: phone,
    p_client_type: params.get("client_type") || "",
    p_screenshot_path: path,
    p_age: numOrNull(params.get("age")),
    p_height_cm: numOrNull(params.get("height_cm")),
    p_weight_kg: numOrNull(params.get("weight_kg")),
    p_diet: strOrNull(params.get("diet")),
    p_tc_agreed_at: strOrNull(params.get("tc_agreed_at")),
    p_tc_version: strOrNull(params.get("tc_version")),
    p_amount: numOrNull(params.get("amount")),
    p_transaction_ref: strOrNull(params.get("transaction_ref"))
  };

  let rpcRes;
  try {
    rpcRes = await fetch(SUPABASE_URL + "/rest/v1/rpc/submit_enrollment", {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(rpcBody)
    });
  } catch (err) {
    console.error("submit_enrollment request failed:", err);
    await deleteObject(path, serviceKey);
    return json(502, { code: "network_error" });
  }

  if (!rpcRes.ok) {
    const detail = await rpcRes.json().catch(function () { return {}; });
    console.error("submit_enrollment rejected:", rpcRes.status, detail);
    await deleteObject(path, serviceKey);
    return json(400, { code: (detail && detail.message) || "submission_failed" });
  }

  return json(200, { ok: true });
};

async function deleteObject(path, serviceKey) {
  try {
    await fetch(SUPABASE_URL + "/storage/v1/object/payment-proofs/" + path, {
      method: "DELETE",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey
      }
    });
  } catch (err) {
    console.error("Cleanup delete failed for", path, err);
  }
}
