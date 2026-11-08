import Link from "next/link";
import { redirect } from "next/navigation";
import { Aperture, ArrowLeft, Images } from "lucide-react";
import { GalleryClient } from "@/components/gallery/gallery-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function GalleryPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/dashboard?setup=supabase");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  return (
    <main className="min-h-screen bg-[#10100f] text-[#f4f1eb]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#a9a49b] transition hover:text-white"><ArrowLeft size={16}/> Dashboard</Link>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em]"><Aperture size={17} className="text-[#d58a48]"/> JASHA STUDIOS</Link>
        </div>
      </header>
      <div className="mx-auto max-w-[1400px] px-5 py-9 sm:px-8 sm:py-12">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#d58a48]"><Images size={14}/> Your work</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Gallery</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8e8980]">A private library of your studio captures and generated photography, organized across your projects.</p>
        <GalleryClient/>
      </div>
    </main>
  );
}
