import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_URL } from "$env/static/public";
import { SUPABASE_SECRET_KEY } from "$env/static/private";

// SERVER-ONLY client. Uses the secret (service_role) key — bypasses RLS.
// Never import this from client-side code: SvelteKit blocks $lib/server/* in the browser.
export const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
