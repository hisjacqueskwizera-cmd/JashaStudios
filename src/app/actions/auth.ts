"use server";
import { getPublicAppUrl } from "@/lib/app-url";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

export async function login(formData: FormData) {
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) redirect("/login?error=invalid");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?error=configuration");
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=invalid");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const parsed = credentialsSchema.extend({ fullName: z.string().trim().min(2).max(100) }).safeParse({
    email: formData.get("email"), password: formData.get("password"), fullName: formData.get("fullName"),
  });
  if (!parsed.success) redirect("/signup?error=invalid");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/signup?error=configuration");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email, password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName }, emailRedirectTo: `${getPublicAppUrl()}/auth/callback` },
  });
  if (error) redirect("/signup?error=signup");
  if (!data.session) redirect("/login?notice=confirm-email");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}
