import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Aperture,
  ArrowRight,
  Camera,
  Check,
  Image as ImageIcon,
  Layers3,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const steps = [
  { number: "01", icon: ImageIcon, title: "Choose the look", description: "Select a studio scene or upload a reference photograph. Jasha studies its framing, pose and visual treatment." },
  { number: "02", icon: Smartphone, title: "Connect your phone", description: "Pair your phone with a secure QR code, open the camera and follow live pose guidance." },
  { number: "03", icon: Aperture, title: "Create the photograph", description: "Send your approved capture to the desktop, compose it into the reference scene and review the result." },
];

const capabilities = [
  { icon: Layers3, title: "Reference-led studio", description: "Build a shoot around a scene, pose and composition you want to recreate." },
  { icon: Camera, title: "Live pose coaching", description: "Use on-device pose detection to compare your stance with the selected reference." },
  { icon: Smartphone, title: "Phone as the camera", description: "Connect desktop and mobile into one guided photography session." },
  { icon: WandSparkles, title: "Local image processing", description: "Use open-source segmentation and OpenCV compositing without a paid image-generation API." },
  { icon: ShieldCheck, title: "Private by design", description: "Keep customer projects and photographs in owner-scoped private storage." },
  { icon: ImageIcon, title: "One organized gallery", description: "Review the reference, original capture and final composite together." },
];

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#10100f] text-[#f5f0e8]">
      <div className="pointer-events-none fixed inset-0 opacity-40" aria-hidden="true">
        <div className="absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full bg-[#d58a48]/10 blur-[120px]" />
        <div className="absolute -bottom-64 -left-40 h-[520px] w-[520px] rounded-full bg-white/[0.035] blur-[120px]" />
      </div>
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <header className="flex h-20 items-center justify-between border-b border-white/10">
          <Link href="/" className="flex items-center gap-3" aria-label="Jasha Studios home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#d58a48]/40 bg-[#d58a48]/10 text-[#e6a66c]"><Aperture size={20}/></span>
            <span className="text-sm font-semibold tracking-[0.08em]">JASHA <span className="text-[#d58a48]">STUDIOS</span></span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="hidden rounded-full px-4 py-2 text-sm text-[#b9b2a7] transition hover:text-white sm:inline-flex">Sign in</Link>
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-[#d58a48] px-4 py-2.5 text-xs font-semibold text-[#17130f] transition hover:bg-[#e6a66c] sm:text-sm">Open your studio <ArrowRight size={15}/></Link>
          </nav>
        </header>

        <section className="grid min-h-[640px] items-center gap-14 py-20 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d58a48]/25 bg-[#d58a48]/[0.07] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e6a66c]">
              <Sparkles size={13}/> AI-assisted virtual photography
            </div>
            <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Your studio.
              <span className="block text-[#d58a48]">Your phone.</span>
              <span className="block">A new way to create.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-[#aaa49b] sm:text-lg">
              Jasha Studios turns a smartphone into a guided photography studio. Choose a reference, match the pose, capture on your phone and build a polished scene from your desktop.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/signup" className="inline-flex h-12 items-center gap-3 rounded-full bg-[#d58a48] px-6 text-sm font-semibold text-[#17130f] transition hover:bg-[#e6a66c]">Start a photoshoot <ArrowRight size={16}/></Link>
              <Link href="/login" className="text-sm text-[#c8c1b6] transition hover:text-white">I already have an account</Link>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3 text-xs text-[#89837a]">
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#d58a48]"/> Phone-based capture</span>
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#d58a48]"/> Live pose guidance</span>
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#d58a48]"/> Local computer vision</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[540px]">
            <div className="absolute -inset-5 rounded-[36px] border border-white/[0.06] rotate-3" />
            <div className="relative rounded-[30px] border border-white/10 bg-[#191917] p-5 shadow-2xl sm:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d58a48]">Studio workflow</p><p className="mt-1 text-sm font-medium">Portrait session / 001</p></div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5 text-[10px] text-emerald-200">Connected workflow</span>
              </div>
              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-[#10100f] p-4">
                  <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d58a48]/10 text-[#e6a66c]"><ImageIcon size={19}/></span><div className="flex-1"><p className="text-xs text-[#8e8980]">REFERENCE</p><p className="mt-1 text-sm font-medium">Choose the scene and pose</p></div><span className="text-[10px] text-[#d58a48]">01</span></div>
                </div>
                <div className="ml-7 h-5 border-l border-dashed border-[#d58a48]/50" />
                <div className="rounded-2xl border border-[#d58a48]/25 bg-[#d58a48]/[0.055] p-4">
                  <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d58a48]/15 text-[#e6a66c]"><Smartphone size={19}/></span><div className="flex-1"><p className="text-xs text-[#d58a48]">PHONE CAPTURE</p><p className="mt-1 text-sm font-medium">Pair, pose and capture</p></div><span className="text-[10px] text-[#d58a48]">02</span></div>
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-[10px] text-[#c8c1b6]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> Live pose tracking on the device</div>
                </div>
                <div className="ml-7 h-5 border-l border-dashed border-[#d58a48]/50" />
                <div className="rounded-2xl border border-white/10 bg-[#10100f] p-4">
                  <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-[#e6a66c]"><Aperture size={19}/></span><div className="flex-1"><p className="text-xs text-[#8e8980]">STUDIO RESULT</p><p className="mt-1 text-sm font-medium">Compose, review and download</p></div><span className="text-[10px] text-[#d58a48]">03</span></div>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5 text-[10px] text-[#77736c]"><span>Reference-led photography</span><span>Jasha Studios</span></div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 py-20">
          <div className="max-w-2xl"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d58a48]">A simpler studio workflow</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">From inspiration to photograph in three steps.</h2></div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((step) => { const Icon = step.icon; return <article key={step.number} className="rounded-2xl border border-white/10 bg-[#171715] p-6"><div className="flex items-center justify-between"><span className="text-xs tabular-nums text-[#d58a48]">{step.number}</span><Icon size={19} className="text-[#d58a48]"/></div><h3 className="mt-8 text-lg font-semibold">{step.title}</h3><p className="mt-3 text-sm leading-7 text-[#8e8980]">{step.description}</p></article>; })}
          </div>
        </section>

        <section className="border-t border-white/10 py-20">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div className="max-w-2xl"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d58a48]">Built around the shoot</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">The tools of a studio, connected in one place.</h2></div><p className="max-w-sm text-sm leading-7 text-[#8e8980]">A focused workflow for creators, photographers, teams and people who want more from the camera they already carry.</p></div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((item) => { const Icon = item.icon; return <article key={item.title} className="rounded-2xl border border-white/10 bg-[#171715]/80 p-5"><Icon size={19} className="text-[#d58a48]"/><h3 className="mt-5 text-sm font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#8e8980]">{item.description}</p></article>; })}
          </div>
        </section>

        <section className="mb-16 rounded-3xl border border-[#d58a48]/20 bg-[#d58a48]/[0.055] px-6 py-12 text-center sm:px-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d58a48]">Make your next shoot different</p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Create your first Jasha Studios project.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#aaa49b]">Set up a project, choose a reference and connect your phone. Your studio workspace is ready when you are.</p>
          <Link href="/signup" className="mt-7 inline-flex h-12 items-center gap-3 rounded-full bg-[#d58a48] px-6 text-sm font-semibold text-[#17130f] transition hover:bg-[#e6a66c]">Create an account <ArrowRight size={16}/></Link>
        </section>

        <footer className="flex flex-col justify-between gap-3 border-t border-white/10 py-7 text-xs text-[#77736c] sm:flex-row"><span>© {new Date().getFullYear()} Jasha Studios</span><span>Photography, guided by technology.</span></footer>
      </div>
    </main>
  );
}
