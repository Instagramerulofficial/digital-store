import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/env";
import type { Profile } from "@/types/db";

/** Returns the current auth user, or null. */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Returns the current user's profile, or null. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as Profile | null) ?? null;
}

/** Redirects to /login if the user isn't signed in. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Redirects to / if the user isn't an admin.
 * Admin access = `profiles.is_admin = true` OR email is in ADMIN_EMAILS.
 * Auto-promotes the profile flag the first time an ADMIN_EMAILS user visits.
 */
export async function requireAdmin() {
  const user = await requireUser();
  const profile = await getCurrentProfile();

  const allowed = profile?.is_admin || isAdminEmail(user.email);
  if (!allowed) redirect("/");

  if (!profile?.is_admin && isAdminEmail(user.email)) {
    const admin = createSupabaseAdminClient();
    await admin.from("profiles").update({ is_admin: true }).eq("id", user.id);
  }

  return user;
}
