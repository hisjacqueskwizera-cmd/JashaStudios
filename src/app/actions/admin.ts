"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  if (user.app_metadata?.role !== "admin") redirect("/dashboard");
  return supabase;
}

export async function getAdminOverview() {
  const supabase = await requireAdmin();
  const [summary, users, jobs, audit] = await Promise.all([
    supabase.rpc("admin_dashboard_summary"),
    supabase.rpc("admin_list_users", { p_query: "", p_limit: 50, p_offset: 0 }),
    supabase.rpc("admin_list_jobs", { p_limit: 20 }),
    supabase.rpc("admin_list_audit_logs", { p_limit: 20 }),
  ]);
  if (summary.error || users.error || jobs.error || audit.error) {
    return { error: "Admin database functions are not ready. Apply the security and admin migrations and verify your admin role." as const };
  }
  return {
    success: true as const,
    summary: (summary.data ?? {}) as Record<string, number>,
    users: (users.data ?? []) as Array<{
      user_id: string; email: string | null; full_name: string; account_status: string;
      created_at: string; projects_count: number;
    }>,
    jobs: (jobs.data ?? []) as Array<{
      job_id: string; user_email: string | null; project_id: string; status: string;
      stage: string | null; provider: string | null; model: string | null;
      attempt_count: number; error_code: string | null; created_at: string; completed_at: string | null;
    }>,
    audit: (audit.data ?? []) as Array<{
      id: string; actor_email: string | null; action: string; target_type: string | null;
      target_id: string | null; metadata: Record<string, unknown>; created_at: string;
    }>,
  };
}

export async function setAdminUserStatus(formData: FormData) {
  const supabase = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !["active", "suspended"].includes(status)) {
    redirect("/dashboard/admin?error=invalid-user-action");
  }
  const { data, error } = await supabase.rpc("admin_set_user_status", {
    p_user_id: userId, p_status: status,
  });
  if (error || data !== true) redirect("/dashboard/admin?error=user-update");
  revalidatePath("/dashboard/admin");
}
