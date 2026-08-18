import { supabase } from "./supabaseClient";

// Guarantees a profiles row exists for the given auth user. Runs on every
// login (cheap no-op if the row already exists and is unchanged). This is
// the permanent fix for: admin deletes a profile row -> that user logs in
// again -> the DB trigger only fires on NEW signups, so without this the
// profile would never reappear and admin could never manage that user again.
//
// Uses upsert with only identity fields in the payload, so it NEVER
// overwrites role/editor_status/contact_number etc. on an existing row —
// it only fills those in with defaults when the row is first created.
export async function ensureProfileExists(user) {
  if (!user) return;
  try {
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || null
      },
      { onConflict: "id" }
    );
  } catch (err) {
    // Non-fatal — worst case the row is missing and admin can investigate,
    // but this should not block the user from using the app.
    console.error("ensureProfileExists failed:", err);
  }
}
