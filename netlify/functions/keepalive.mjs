const SUPABASE_URL = "https://yjgmknysqqnallpacbyh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZ21rbnlzcXFuYWxscGFjYnloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NzAxMzEsImV4cCI6MjEwNTA0NjEzMX0.NdwPHZF0SbcnaHDL8g-uucIHSINVfVyUE8_8akuxUKI";

export default async () => {
  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/clients?select=id&limit=1", {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY
      }
    });
    console.log("Supabase keep-alive ping:", res.status);
  } catch (err) {
    console.error("Supabase keep-alive ping failed:", err);
  }
  return new Response("ok");
};

// Daily, not weekly: Supabase's free tier auto-pauses a project after 7 days
// with no API activity. A weekly ping sits right at that edge — one slightly
// late run and the whole backend pauses silently. Daily leaves real margin.
export const config = {
  schedule: "@daily"
};
