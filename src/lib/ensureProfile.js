import { supabase } from "./supabaseClient";

// Ensures the authenticated user has a matching public.profiles row.
// The actual insert/recovery is done by a SECURITY DEFINER RPC so it also
// works when the profile row was deleted or the normal client-side insert
// is blocked by RLS.
export async function ensureProfileExists(user) {
  if (!user) return;

  const { error } = await supabase.rpc("ensure_my_profile");
  if (error) {
    console.error("ensureProfileExists failed:", error);
  }
}
