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
  const [summary, users, products, payments, jobs, audit] = await Promise.all([
    supabase.rpc("admin_dashboard_summary"),
    supabase.rpc("admin_list_users", { p_query: "", p_limit: 50, p_offset: 0 }),
    supabase.rpc("admin_list_billing_products"),
    supabase.rpc("admin_list_payments", { p_limit: 20 }),
    supabase.rpc("admin_list_jobs", { p_limit: 20 }),
    supabase.rpc("admin_list_audit_logs", { p_limit: 20 }),
  ]);
  if (summary.error || users.error || products.error || payments.error || jobs.error || audit.error) {
    return { error: "Admin database functions are not ready. Apply the Phase 12 migration and verify your admin role." as const };
  }
  return {
    success: true as const,
    summary: (summary.data ?? {}) as Record<string, number>,
    users: (users.data ?? []) as Array<{
      user_id: string; email: string | null; full_name: string; account_status: string;
      created_at: string; projects_count: number; credit_balance: number;
    }>,
    products: (products.data ?? []) as Array<{
      code: string; name: string; description: string; product_type: string;
      amount_minor: number; currency: string; billing_interval: string;
      credits_per_purchase: number | null; is_active: boolean; sort_order: number;
    }>,
    payments: (payments.data ?? []) as Array<{
      payment_id: string; user_email: string | null; product_code: string | null;
      provider: string; amount_rwf: number; currency: string; status: string;
      created_at: string; verified_at: string | null;
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

export async function updateAdminBillingProduct(formData: FormData) {
  const supabase = await requireAdmin();
  const code = String(formData.get("code") ?? "");
  const amount = Number(formData.get("amount_rwf"));
  const rawCredits = String(formData.get("credits") ?? "").trim();
  const credits = rawCredits === "" ? null : Number(rawCredits);
  const isActive = formData.get("is_active") === "on";
  if (!/^[a-z][a-z0-9_]{2,39}$/.test(code) || !Number.isSafeInteger(amount) || amount < 1 ||
    (credits !== null && (!Number.isSafeInteger(credits) || credits < 1))) {
    redirect("/dashboard/admin?error=invalid-product");
  }
  const { data, error } = await supabase.rpc("admin_update_billing_product", {
    p_code: code, p_amount_rwf: amount, p_credits: credits, p_is_active: isActive,
  });
  if (error || data !== true) redirect("/dashboard/admin?error=product-update");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/billing");
}

export async function adjustAdminCredits(formData: FormData) {
  const supabase = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const amount = Number(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !Number.isSafeInteger(amount) ||
    amount === 0 || Math.abs(amount) > 10000 || reason.length < 5 || reason.length > 300) {
    redirect("/dashboard/admin?error=invalid-credit-adjustment");
  }
  const { error } = await supabase.rpc("admin_adjust_user_credits", {
    p_user_id: userId, p_amount: amount, p_reason: reason,
  });
  if (error) redirect("/dashboard/admin?error=credit-adjustment");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/billing");
}
