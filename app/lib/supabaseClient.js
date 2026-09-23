"use client";

import { createClient } from "@supabase/supabase-js";

// Only the admin dashboard uses this — it needs a real, persisted login session.
// The public enrollment form never talks to Supabase directly; every submission
// goes through /api/submit-enrollment, which holds the service-role key server-side.
// That's also why this file is safe to ship to the browser at all: it only ever
// carries the public anon key, which is meant to be public and is protected by
// Supabase's Row Level Security on the other end.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
