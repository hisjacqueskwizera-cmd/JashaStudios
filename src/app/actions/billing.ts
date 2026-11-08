"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getBillingOverview() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase is not configured." as const };

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Please sign in again." as const };

  const [productsResult, creditsResult, subscriptionsResult, paymentsResult] = await Promise.all([
    supabase.from("billing_products")
      .select("code,name,description,product_type,amount_minor,currency,billing_interval,credits_per_purchase,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("credit_ledger")
      .select("id,transaction_type,amount,description,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase.from("subscriptions")
      .select("id,plan_code,status,current_period_start,current_period_end,cancel_at_period_end,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("payment_transactions")
      .select("id,provider,amount_minor,currency,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (productsResult.error || creditsResult.error || subscriptionsResult.error || paymentsResult.error) {
    return { error: "Billing data is not ready. Apply the Phase 11 billing migration and try again." as const };
  }

  const ledger = creditsResult.data ?? [];
  return {
    success: true as const,
    products: (productsResult.data ?? []).map((product) => ({
      ...product,
      amountRwf: Number(product.amount_minor),
      creditsPerPurchase: product.credits_per_purchase,
    })),
    creditsBalance: ledger.reduce((balance, entry) => balance + Number(entry.amount), 0),
    ledger: ledger.map((entry) => ({
      id: entry.id,
      type: entry.transaction_type,
      amount: Number(entry.amount),
      description: entry.description ?? "Credit adjustment",
      createdAt: entry.created_at,
    })),
    subscriptions: (subscriptionsResult.data ?? []).map((subscription) => ({
      id: subscription.id,
      planCode: subscription.plan_code,
      status: subscription.status,
      periodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    })),
    payments: (paymentsResult.data ?? []).map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      amountRwf: Number(payment.amount_minor),
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.created_at,
    })),
    paymentProviderStatus: "not_configured" as const,
  };
}
