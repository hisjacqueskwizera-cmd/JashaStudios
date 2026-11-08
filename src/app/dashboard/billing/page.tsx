import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BadgeCheck, CalendarDays, Check, CircleAlert, CreditCard, History, Wallet } from "lucide-react";
import { getBillingOverview } from "@/app/actions/billing";

const money = (amount: number) => new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
}).format(amount);

export default async function BillingPage() {
  const result = await getBillingOverview();
  if ("error" in result) {
    if (result.error === "Please sign in again.") redirect("/login");
    return (
      <main className="min-h-screen bg-[#10100f] px-5 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#aaa49b] hover:text-white"><ArrowLeft size={15} /> Workspace</Link>
          <section className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <CircleAlert className="text-amber-300" />
            <h1 className="mt-3 text-xl font-semibold">Billing setup required</h1>
            <p className="mt-2 text-sm leading-6 text-[#aaa49b]">{result.error}</p>
          </section>
        </div>
      </main>
    );
  }

  const activeSubscription = result.subscriptions.find((subscription) => subscription.status === "active");

  return (
    <main className="min-h-screen bg-[#10100f] px-5 py-8 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#aaa49b] transition hover:text-white"><ArrowLeft size={15} /> Workspace</Link>
        <header className="mt-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d58a48]">Account</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Billing & credits</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#aaa49b]">Manage your studio credits, subscription and payment history.</p></div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200"><CircleAlert size={14} /> Payments are not connected yet</div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#171715] p-5">
            <div className="flex items-center gap-2 text-sm text-[#aaa49b]"><Wallet size={16} className="text-[#d58a48]" /> Available credits</div>
            <p className="mt-3 text-4xl font-semibold tabular-nums">{result.creditsBalance}</p>
            <p className="mt-1 text-xs text-[#77736c]">Credits are added only after verified payment or an authorized adjustment.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#171715] p-5">
            <div className="flex items-center gap-2 text-sm text-[#aaa49b]"><BadgeCheck size={16} className="text-[#d58a48]" /> Current subscription</div>
            {activeSubscription ? <><p className="mt-3 text-2xl font-semibold capitalize">{activeSubscription.planCode}</p><p className="mt-2 text-xs text-[#aaa49b]">Renews/ends {activeSubscription.periodEnd ? new Date(activeSubscription.periodEnd).toLocaleDateString() : "when configured"}</p></> : <><p className="mt-3 text-2xl font-semibold">No active plan</p><p className="mt-2 text-xs text-[#77736c]">Choose a plan below when checkout becomes available.</p></>}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Studio plans</h2><p className="mt-1 text-sm text-[#8e8980]">Seeded prices in Rwandan francs.</p></div><CreditCard className="text-[#d58a48]" /></div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {result.products.map((product) => (
              <article key={product.code} className="flex flex-col rounded-2xl border border-white/10 bg-[#171715] p-5">
                <div className="flex items-center justify-between"><h3 className="font-semibold">{product.name}</h3><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-wide text-[#aaa49b]">{product.billing_interval === "month" ? "Monthly" : "One-time"}</span></div>
                <p className="mt-4 text-3xl font-semibold tabular-nums">{money(product.amountRwf)}<span className="ml-1 text-xs font-normal text-[#8e8980]">{product.billing_interval === "month" ? "/ month" : ""}</span></p>
                <p className="mt-3 min-h-10 text-sm leading-5 text-[#aaa49b]">{product.description}</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-[#aaa49b]">{product.creditsPerPurchase ? <><Check size={14} className="text-emerald-300" /> {product.creditsPerPurchase} photo credit</> : <><CalendarDays size={14} className="text-[#d58a48]" /> Monthly credit allowance not configured</>}</div>
                <button type="button" disabled className="mt-6 h-11 cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.03] text-sm font-medium text-[#77736c]" title="Payment provider integration is not configured">Checkout coming soon</button>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-[#77736c]">No payment is collected on this page. Standard and Pro monthly credit allowances remain unset until you approve them in the admin configuration.</p>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#171715] p-5">
            <div className="flex items-center gap-2"><History size={16} className="text-[#d58a48]" /><h2 className="font-semibold">Credit activity</h2></div>
            {result.ledger.length ? <ul className="mt-4 divide-y divide-white/5">{result.ledger.map((entry) => <li key={entry.id} className="flex items-center justify-between gap-4 py-3 text-sm"><span><span className="block text-white">{entry.description}</span><span className="mt-1 block text-xs text-[#77736c]">{new Date(entry.createdAt).toLocaleString()}</span></span><span className={entry.amount > 0 ? "font-semibold text-emerald-300" : "font-semibold text-white"}>{entry.amount > 0 ? "+" : ""}{entry.amount}</span></li>)}</ul> : <p className="mt-4 text-sm text-[#77736c]">No credit activity yet.</p>}
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#171715] p-5">
            <div className="flex items-center gap-2"><CreditCard size={16} className="text-[#d58a48]" /><h2 className="font-semibold">Payment history</h2></div>
            {result.payments.length ? <ul className="mt-4 divide-y divide-white/5">{result.payments.map((payment) => <li key={payment.id} className="flex items-center justify-between gap-4 py-3 text-sm"><span><span className="block text-white">{money(payment.amountRwf)}</span><span className="mt-1 block text-xs text-[#77736c]">{payment.provider} · {new Date(payment.createdAt).toLocaleDateString()}</span></span><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] capitalize text-[#aaa49b]">{payment.status}</span></li>)}</ul> : <p className="mt-4 text-sm text-[#77736c]">No payment records yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
