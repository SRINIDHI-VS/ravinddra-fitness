const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET() {
  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/clients?select=id&limit=1", {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
      },
    });
    console.log("Supabase keep-alive ping:", res.status);
  } catch (err) {
    console.error("Supabase keep-alive ping failed:", err);
  }
  return new Response("ok");
}
