"use client";

import { useMemo, useState } from "react";
import { Archive, FolderOpen, RotateCcw } from "lucide-react";
import { archiveProject, renameProject, restoreProject } from "@/app/actions/projects";

export type DashboardProject = {
  id: string; name: string; category: string | null; status: string;
  created_at: string; updated_at: string; archived_at: string | null;
};
type ProjectListProps = { projects: DashboardProject[] };

const statusLabels: Record<string, string> = {
  draft: "Draft", preparing: "Preparing", ready_for_capture: "Ready for capture",
  capturing: "Capturing", processing: "Processing", completed: "Completed",
  failed: "Needs attention", archived: "Archived",
};

export function ProjectList({ projects }: ProjectListProps) {
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [query, setQuery] = useState("");
  const visibleProjects = useMemo(() => projects.filter((project) => {
    const matchesFilter = filter === "archived" ? Boolean(project.archived_at) : !project.archived_at;
    const matchesQuery = project.name.toLowerCase().includes(query.toLowerCase()) ||
      (project.category ?? "").toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  }), [filter, projects, query]);

  return (
    <section className="mt-9">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d58a48]">Your workspace</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Photography projects</h2></div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search projects" placeholder="Search projects..." className="h-10 rounded-xl border border-white/10 bg-[#171715] px-3 text-sm outline-none focus:border-[#d58a48]" />
          <div className="flex rounded-xl border border-white/10 bg-[#171715] p-1">
            <button onClick={() => setFilter("active")} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === "active" ? "bg-white/10 text-white" : "text-[#a9a49b]"}`}>Active</button>
            <button onClick={() => setFilter("archived")} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === "archived" ? "bg-white/10 text-white" : "text-[#a9a49b]"}`}>Archived</button>
          </div>
        </div>
      </div>
      {visibleProjects.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 text-[#d58a48]"><FolderOpen size={21} /></div>
          <h3 className="mt-4 text-lg font-medium">{query ? "No matching projects" : filter === "archived" ? "No archived projects" : "Your studio is ready for its first project"}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#a9a49b]">{query ? "Try another project name or category." : filter === "archived" ? "Projects you archive will be available here." : "Create a project to keep your reference images, captures and final photographs organized."}</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleProjects.map((project) => (
            <article key={project.id} className="group rounded-2xl border border-white/10 bg-[#171715] p-5 transition hover:border-white/20">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d58a48]/10 text-[#d58a48]"><FolderOpen size={18} /></div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] ${project.status === "failed" ? "border-red-500/30 text-red-300" : project.status === "completed" ? "border-emerald-500/30 text-emerald-300" : "border-white/10 text-[#bdb7ad]"}`}>{statusLabels[project.status] ?? project.status}</span>
              </div>
              <h3 className="mt-5 truncate text-lg font-semibold">{project.name}</h3>
              <p className="mt-1 text-xs text-[#8e8980]">{project.category || "General photography"} · Created {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(project.created_at))}</p>
              <div className="mt-5 border-t border-white/10 pt-4">
                {project.archived_at ? (
                  <form action={restoreProject}><input type="hidden" name="id" value={project.id} /><button className="inline-flex items-center gap-2 text-xs font-medium text-[#e6a66c] hover:text-white"><RotateCcw size={14} /> Restore project</button></form>
                ) : (
                  <div className="flex flex-col gap-3">
                    <form action={renameProject} className="flex gap-2">
                      <input type="hidden" name="id" value={project.id} />
                      <input name="name" defaultValue={project.name} aria-label={`Rename ${project.name}`} maxLength={120} required className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#10100f] px-3 py-2 text-xs outline-none focus:border-[#d58a48]" />
                      <button className="rounded-lg border border-white/10 px-3 text-xs text-[#c8c1b6] hover:bg-white/5">Save</button>
                    </form>
                    <form action={archiveProject}><input type="hidden" name="id" value={project.id} /><button className="inline-flex items-center gap-2 text-xs text-[#8e8980] hover:text-white"><Archive size={13} /> Archive</button></form>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
