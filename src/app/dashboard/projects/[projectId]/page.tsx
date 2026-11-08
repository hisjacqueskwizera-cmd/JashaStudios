import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Aperture, FolderOpen } from "lucide-react";
import { ProjectAssetsManager, type ProjectAssetCard } from "@/components/projects/project-assets-manager";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ projectId: string }> };

export default async function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/dashboard?setup=supabase");
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: project, error: projectError } = await supabase.from("projects")
    .select("id,name,category,status,selected_reference_image_id,selected_user_background_id,selected_studio_background_id")
    .eq("id", projectId).eq("user_id", user.id).maybeSingle();

  if (projectError) {
    return (
      <main className="min-h-screen bg-[#10100f] px-5 py-12 text-[#f4f1eb]">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-500/20 bg-[#171715] p-7">
          <h1 className="text-xl font-semibold">Studio library needs its database migration</h1>
          <p className="mt-3 text-sm leading-6 text-[#a9a49b]">Apply the Phase 4 migration in <code>supabase/migrations</code>, then refresh this page. No project files have been changed.</p>
          <Link href="/dashboard" className="mt-5 inline-flex items-center gap-2 text-sm text-[#e6a66c]"><ArrowLeft size={15} /> Back to dashboard</Link>
        </div>
      </main>
    );
  }
  if (!project) notFound();

  const [referenceResult, backgroundResult, presetResult] = await Promise.all([
    supabase.from("reference_images").select("id,storage_path,mime_type,byte_size,created_at")
      .eq("project_id", projectId).eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("user_studio_backgrounds").select("id,name,storage_path,mime_type,byte_size,created_at")
      .eq("project_id", projectId).eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("studio_backgrounds").select("id,name,description,category,preview_path,original_path,created_at")
      .eq("is_active", true).order("category", { ascending: true }).order("name", { ascending: true }),
  ]);

  const privateBucket = supabase.storage.from("studio-assets");
  const references: ProjectAssetCard[] = await Promise.all((referenceResult.data ?? []).map(async (row) => {
    const { data } = await privateBucket.createSignedUrl(row.storage_path, 600);
    return {
      id: row.id,
      name: `Reference · ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(row.created_at))}`,
      url: data?.signedUrl ?? null,
      mimeType: row.mime_type,
      byteSize: Number(row.byte_size),
      createdAt: row.created_at,
      type: "reference" as const,
      selected: project.selected_reference_image_id === row.id,
    };
  }));

  const backgrounds: ProjectAssetCard[] = await Promise.all((backgroundResult.data ?? []).map(async (row) => {
    const { data } = await privateBucket.createSignedUrl(row.storage_path, 600);
    return {
      id: row.id,
      name: row.name,
      url: data?.signedUrl ?? null,
      mimeType: row.mime_type,
      byteSize: Number(row.byte_size),
      createdAt: row.created_at,
      type: "background" as const,
      selected: project.selected_user_background_id === row.id,
    };
  }));

  const presetBucket = supabase.storage.from("studio-presets");
  const presets: ProjectAssetCard[] = (presetResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    url: presetBucket.getPublicUrl(row.preview_path).data.publicUrl,
    mimeType: "image/jpeg",
    byteSize: 0,
    createdAt: row.created_at,
    type: "preset",
    selected: project.selected_studio_background_id === row.id,
  }));

  return (
    <main className="min-h-screen bg-[#10100f] text-[#f4f1eb]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#a9a49b] transition hover:text-white"><ArrowLeft size={16} /> All projects</Link>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em]"><Aperture size={17} className="text-[#d58a48]" /> JASHA STUDIOS</Link>
        </div>
      </header>
      <div className="mx-auto max-w-[1400px] px-5 py-9 sm:px-8 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#d58a48]"><FolderOpen size={14} /> Project workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{project.name}</h1>
            <p className="mt-2 text-sm text-[#8e8980]">{project.category || "General photography"} · {project.status.replaceAll("_", " ")}</p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#a9a49b]">Phase 4 · Asset library</span>
        </div>
        <ProjectAssetsManager
          projectId={project.id}
          references={references}
          backgrounds={backgrounds}
          presets={presets}
          selectedReferenceId={project.selected_reference_image_id}
          selectedUserBackgroundId={project.selected_user_background_id}
          selectedPresetId={project.selected_studio_background_id}
        />
        {(referenceResult.error || backgroundResult.error || presetResult.error) && (
          <p role="status" className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">Some library records could not be loaded. Check that the Phase 4 migration was applied successfully.</p>
        )}
      </div>
    </main>
  );
}
