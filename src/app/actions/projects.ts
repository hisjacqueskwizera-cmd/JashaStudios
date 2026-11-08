"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const projectNameSchema = z.string().trim().min(1).max(120);
const projectIdSchema = z.string().uuid();

async function getAuthenticatedClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/dashboard?setup=supabase");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  return { supabase, user };
}

export async function createProject(formData: FormData) {
  const parsed = z.object({ name: projectNameSchema, category: z.string().trim().max(60).optional() }).safeParse({
    name: formData.get("name"), category: formData.get("category") || undefined,
  });
  if (!parsed.success) redirect("/dashboard?error=project-name");
  const { supabase, user } = await getAuthenticatedClient();
  const { error } = await supabase.from("projects").insert({
    user_id: user.id, name: parsed.data.name, category: parsed.data.category || null, status: "draft",
  });
  if (error) redirect("/dashboard?error=project-create");
  revalidatePath("/dashboard");
}

export async function renameProject(formData: FormData) {
  const parsed = z.object({ id: projectIdSchema, name: projectNameSchema }).safeParse({
    id: formData.get("id"), name: formData.get("name"),
  });
  if (!parsed.success) redirect("/dashboard?error=project-name");
  const { supabase, user } = await getAuthenticatedClient();
  const { error } = await supabase.from("projects").update({ name: parsed.data.name })
    .eq("id", parsed.data.id).eq("user_id", user.id);
  if (error) redirect("/dashboard?error=project-update");
  revalidatePath("/dashboard");
}

export async function archiveProject(formData: FormData) {
  const parsed = projectIdSchema.safeParse(formData.get("id"));
  if (!parsed.success) redirect("/dashboard?error=project-update");
  const { supabase, user } = await getAuthenticatedClient();
  const { error } = await supabase.from("projects").update({
    status: "archived", archived_at: new Date().toISOString(),
  }).eq("id", parsed.data).eq("user_id", user.id);
  if (error) redirect("/dashboard?error=project-update");
  revalidatePath("/dashboard");
}

export async function restoreProject(formData: FormData) {
  const parsed = projectIdSchema.safeParse(formData.get("id"));
  if (!parsed.success) redirect("/dashboard?error=project-update");
  const { supabase, user } = await getAuthenticatedClient();
  const { error } = await supabase.from("projects").update({
    status: "draft", archived_at: null,
  }).eq("id", parsed.data).eq("user_id", user.id);
  if (error) redirect("/dashboard?error=project-update");
  revalidatePath("/dashboard");
}
