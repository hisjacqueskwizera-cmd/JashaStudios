import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Activity, AlertTriangle, BadgeCheck, Camera, Image, Layers3, ShieldCheck, Users } from "lucide-react";
import { getAdminOverview, setAdminUserStatus } from "@/app/actions/admin";

type Props = { searchParams: Promise<{ error?: string }> };
const number = (value: number | undefined) => new Intl.NumberFormat("en-RW").format(Number(value ?? 0));
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : "—";

export default async function AdminDashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const result = await getAdminOverview();
  if ("error" in result) {
    return <main className="min-h-screen bg-[#10100f] px-5 py-12 text-white"><div className="mx-auto max-w-3xl rounded-2xl border border-amber-400/20 bg-[#171715] p-7"><AlertTriangle className="text-amber-300" /><h1 className="mt-3 text-xl font-semibold">Admin data is not ready</h1><p className="mt-2 text-sm leading-6 text-[#aaa49b]">{result.error}</p><Link href="/dashboard" className="mt-5 inline-flex items-center gap-2 text-sm text-[#e6a66c]"><ArrowLeft size={15}/> Back to workspace</Link></div></main>;
  }
  const s = result.summary;
  const stats = [
    { label: "Total customers", value: s.total_users, icon: Users },
    { label: "Active customers", value: s.active_users, icon: BadgeCheck },
    { label: "Projects", value: s.total_projects, icon: Layers3 },
    { label: "Phone captures", value: s.total_captures, icon: Camera },
    { label: "Finished photographs", value: s.total_generated_images, icon: Image },
    { label: "Queued jobs", value: s.jobs_queued, icon: Activity },
    { label: "Failed jobs", value: s.jobs_failed, icon: AlertTriangle },
    { label: "Suspended accounts", value: s.suspended_users, icon: ShieldCheck },
  ];
  return (
    <main className="min-h-screen bg-[#10100f] px-5 py-8 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#aaa49b] hover:text-white"><ArrowLeft size={15}/> Workspace</Link>
        <header className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d58a48]">Platform administration</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Admin dashboard</h1><p className="mt-2 text-sm text-[#aaa49b]">Customer operations, photography workflow and platform activity.</p></div>
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-200"><ShieldCheck size={14}/> Admin access verified</span>
        </header>
        {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-200">The requested change could not be completed. Check the values and try again.</p>}
        <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => { const Icon = item.icon; return <article key={item.label} className="rounded-2xl border border-white/10 bg-[#171715] p-5"><div className="flex items-center justify-between text-xs text-[#aaa49b]">{item.label}<Icon size={16} className="text-[#d58a48]"/></div><p className="mt-3 text-2xl font-semibold tabular-nums">{number(item.value)}</p></article>; })}
        </section>
        <section className="mt-9 rounded-2xl border border-white/10 bg-[#171715] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><h2 className="text-lg font-semibold">Customer accounts</h2><p className="mt-1 text-xs text-[#8e8980]">Latest 50 accounts · suspend or reactivate with an audit record.</p></div><span className="text-xs text-[#8e8980]">{number(s.suspended_users)} suspended</span></div>
          <div className="mt-5 space-y-3">
            {result.users.map((user) => <article key={user.user_id} className="grid gap-4 rounded-xl border border-white/10 bg-black/10 p-4 sm:grid-cols-[minmax(180px,1fr)_auto] sm:items-center">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{user.full_name || user.email || "Unnamed customer"}</p><p className="mt-1 truncate text-xs text-[#8e8980]">{user.email} · Joined {date(user.created_at)}</p><p className="mt-1 text-xs text-[#aaa49b]">{number(user.projects_count)} projects</p></div>
              <form action={setAdminUserStatus} className="flex items-center gap-2"><input type="hidden" name="user_id" value={user.user_id}/><input type="hidden" name="status" value={user.account_status === "suspended" ? "active" : "suspended"}/><span className={user.account_status === "active" ? "rounded-full border border-emerald-400/20 px-2 py-1 text-[10px] text-emerald-200" : "rounded-full border border-amber-400/20 px-2 py-1 text-[10px] text-amber-200"}>{user.account_status}</span><button className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5">{user.account_status === "suspended" ? "Reactivate" : "Suspend"}</button></form>
            </article>)}
            {result.users.length === 0 && <p className="py-6 text-center text-sm text-[#8e8980]">No customer accounts found.</p>}
          </div>
        </section>
        <section className="mt-9 grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#171715] p-5"><div className="flex items-center gap-2"><Activity size={16} className="text-[#d58a48]"/><h2 className="font-semibold">Transformation jobs</h2></div><div className="mt-4 space-y-3">{result.jobs.map((job) => <div key={job.job_id} className="border-b border-white/5 pb-3 text-xs"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm">{job.user_email || "Unknown customer"}</p><span className="capitalize text-[#d8b18e]">{job.status}</span></div><p className="mt-1 text-[#8e8980]">{job.stage || "—"} · {job.provider || "Local processing"} · {date(job.created_at)}</p>{job.error_code && <p className="mt-1 text-amber-200">Error: {job.error_code}</p>}</div>)}{result.jobs.length===0 && <p className="py-5 text-sm text-[#8e8980]">No transformation jobs yet.</p>}</div></div>
          <div className="rounded-2xl border border-white/10 bg-[#171715] p-5"><h2 className="font-semibold">Administrator audit trail</h2><div className="mt-4 space-y-3">{result.audit.map((entry) => <div key={entry.id} className="flex flex-col justify-between gap-1 border-b border-white/5 pb-3 text-xs sm:flex-row"><span><strong className="font-medium text-white">{entry.action}</strong><span className="ml-2 text-[#8e8980]">{entry.actor_email || "System"} · {entry.target_type || "record"}</span></span><time className="text-[#77736c]">{date(entry.created_at)}</time></div>)}{result.audit.length===0 && <p className="py-4 text-sm text-[#8e8980]">No administrative changes recorded yet.</p>}</div></div>
        </section>
        <footer className="mt-10 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5 text-xs text-[#77736c]"><span>Jasha Studios · Administration</span><Link href="/dashboard" className="text-[#e6a66c] hover:text-white">Return to workspace</Link></footer>
      </div>
    </main>
  );
}
