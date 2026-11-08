import Link from "next/link";
import { redirect } from "next/navigation";
import { Aperture, ArrowUpRight, Camera, CheckCircle2, CircleHelp, Clock3, FolderPlus, ImagePlus, LogOut, Plus, Settings2, Sparkles } from "lucide-react";
import { createProject } from "@/app/actions/projects";
import { logout } from "@/app/actions/auth";
import { ProjectList, type DashboardProject } from "@/components/dashboard/project-list";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DashboardPageProps = { searchParams: Promise<{ error?: string; setup?: string }> };

function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-3xl border border-white/10 bg-[#171715] p-8 sm:p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d58a48]/10 text-[#d58a48]"><Settings2 size={22} /></div>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-[#d58a48]">One-time setup</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Connect your Supabase project</h1>
        <p className="mt-4 text-sm leading-7 text-[#a9a49b]">The dashboard and project manager are ready, but authentication and project storage need your Supabase project settings before they can save real customer data.</p>
        <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-6 text-[#d8d4cc]">
          <li>Create or open your Supabase project.</li>
          <li>Add the NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY values to your local environment and deployment settings.</li>
          <li>Apply the SQL migrations in the supabase/migrations folder.</li>
        </ol>
        <p className="mt-6 text-xs text-[#8e8980]">Use the Supabase anon/publishable key here. Never place the service-role key in browser-visible environment variables.</p>
        <Link href="/login" className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-[#d58a48] px-5 text-sm font-semibold text-[#17130f]">Continue to sign in <ArrowUpRight size={15} /></Link>
      </section>
    </main>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <SetupNotice />;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data, error } = await supabase.from("projects")
    .select("id,name,category,status,created_at,updated_at,archived_at")
    .eq("user_id", user.id).order("updated_at", { ascending: false });
  const projects = (data ?? []) as DashboardProject[];
  const activeProjects = projects.filter((project) => !project.archived_at);
  const completedProjects = activeProjects.filter((project) => project.status === "completed").length;
  const inProgressProjects = activeProjects.filter((project) => ["preparing", "ready_for_capture", "capturing", "processing"].includes(project.status)).length;
  const firstName = user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "Creator";

  return (
    <main className="min-h-screen bg-[#10100f]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 px-5 py-7 lg:flex">
          <Link href="/dashboard" className="flex items-center gap-3 px-2 text-sm font-semibold tracking-[0.14em]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d58a48] text-[#17130f]"><Aperture size={19} /></span> JASHA STUDIOS</Link>
          <p className="mb-3 mt-12 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#77736c]">Workspace</p>
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl bg-white/[0.07] px-3 py-3 text-sm text-white"><FolderPlus size={17} className="text-[#d58a48]" /> Overview</Link>
          <a href="#projects" className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#a9a49b] transition hover:bg-white/5 hover:text-white"><Camera size={17} /> Projects</a>
          <Link href="/dashboard/gallery" className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#a9a49b] transition hover:bg-white/5 hover:text-white"><ImagePlus size={17} /> Gallery <span className="ml-auto text-[9px] uppercase tracking-wider text-[#d58a48]">New</span></Link>
          <div className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#625e57]" aria-disabled="true"><Sparkles size={17} /> AI Studio <span className="ml-auto text-[9px] uppercase tracking-wider">Soon</span></div>
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-xs font-medium"><CircleHelp size={15} className="text-[#d58a48]" /> Need help?</div><p className="mt-2 text-xs leading-5 text-[#8e8980]">Your studio workflow will grow here as capture and AI tools are added.</p></div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-white/10 px-5 py-5 sm:px-8 lg:px-10">
            <div className="flex items-center gap-3 lg:hidden"><Aperture size={20} className="text-[#d58a48]" /><span className="text-xs font-semibold tracking-[0.14em]">JASHA STUDIOS</span></div>
            <div className="hidden text-sm text-[#8e8980] lg:block">Workspace <span className="px-2 text-[#55514b]">/</span> Overview</div>
            <div className="flex items-center gap-3"><span className="hidden text-right sm:block"><span className="block text-sm font-medium">{firstName}</span><span className="block text-xs text-[#8e8980]">{user.email}</span></span><form action={logout}><button aria-label="Sign out" title="Sign out" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-[#a9a49b] hover:bg-white/5 hover:text-white"><LogOut size={16} /></button></form></div>
          </header>
          <div className="px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
            <section className="flex flex-col justify-between gap-6 rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top_right,_rgba(213,138,72,0.13),_transparent_48%),#171715] p-6 sm:p-9 xl:flex-row xl:items-center">
              <div className="max-w-2xl"><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d58a48]"><Sparkles size={13} /> Your creative workspace</p><h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Good to see you, {firstName}.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#a9a49b]">Keep every shoot organized. Create a project for each photographic concept, then add your reference and captured images as the studio tools become available.</p></div>
              <a href="#new-project" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#d58a48] px-5 text-sm font-semibold text-[#17130f] transition hover:bg-[#e29b5a]"><Plus size={17} /> New project</a>
            </section>
            {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{params.error === "project-name" ? "Enter a project name between 1 and 120 characters." : "The project could not be saved. Please try again."}</p>}
            {error && <p role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">Projects could not be loaded. Refresh the page or check the Supabase migration.</p>}
            <section className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-[#171715] p-5"><div className="flex items-center justify-between text-xs text-[#8e8980]">Active projects <FolderPlus size={16} className="text-[#d58a48]" /></div><p className="mt-3 text-3xl font-semibold tabular-nums">{activeProjects.length}</p><p className="mt-1 text-xs text-[#77736c]">Your current workspace</p></div>
              <div className="rounded-2xl border border-white/10 bg-[#171715] p-5"><div className="flex items-center justify-between text-xs text-[#8e8980]">In progress <Clock3 size={16} className="text-[#d58a48]" /></div><p className="mt-3 text-3xl font-semibold tabular-nums">{inProgressProjects}</p><p className="mt-1 text-xs text-[#77736c]">Projects moving through a shoot</p></div>
              <div className="rounded-2xl border border-white/10 bg-[#171715] p-5"><div className="flex items-center justify-between text-xs text-[#8e8980]">Completed <CheckCircle2 size={16} className="text-emerald-300" /></div><p className="mt-3 text-3xl font-semibold tabular-nums">{completedProjects}</p><p className="mt-1 text-xs text-[#77736c]">Finished studio projects</p></div>
            </section>
            <section id="new-project" className="mt-8 rounded-2xl border border-white/10 bg-[#171715] p-5 sm:p-6">
              <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d58a48]/10 text-[#d58a48]"><Plus size={18} /></div><div><h2 className="text-base font-semibold">Create a project</h2><p className="mt-0.5 text-xs text-[#8e8980]">Start a new photography concept.</p></div></div>
              <form action={createProject} className="mt-5 grid gap-3 sm:grid-cols-[1fr_220px_auto]">
                <input name="name" required minLength={1} maxLength={120} placeholder="e.g. Editorial portrait — November" className="h-11 rounded-xl border border-white/10 bg-[#10100f] px-4 text-sm outline-none focus:border-[#d58a48]" />
                <select name="category" defaultValue="" className="h-11 rounded-xl border border-white/10 bg-[#10100f] px-3 text-sm text-[#d8d4cc] outline-none focus:border-[#d58a48]"><option value="">Choose a category</option><option value="Portrait">Portrait</option><option value="Fashion">Fashion</option><option value="Wedding">Wedding</option><option value="Commercial">Commercial</option><option value="Family">Family</option><option value="Creative">Creative</option></select>
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#d58a48] px-5 text-sm font-semibold text-[#17130f] hover:bg-[#e29b5a]"><Plus size={15} /> Create project</button>
              </form>
            </section>
            <div id="projects"><ProjectList projects={projects} /></div>
            <footer className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-[#77736c] sm:flex-row sm:justify-between"><span>Jasha Studios · Your identity, your vision.</span><span>{projects.length} project{projects.length === 1 ? "" : "s"} in your account <ArrowUpRight size={12} className="ml-1 inline" /></span></footer>
          </div>
        </div>
      </div>
    </main>
  );
}
