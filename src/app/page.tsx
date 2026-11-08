import { Camera, CircleDot, ScanFace, Sparkles } from "lucide-react";

const capabilities = [
  {
    icon: ScanFace,
    title: "Reference analysis",
    description: "Understand composition, pose, framing and lighting from a reference image.",
  },
  {
    icon: Camera,
    title: "Connected capture",
    description: "Prepare a desktop session and capture an approved photograph on your phone.",
  },
  {
    icon: Sparkles,
    title: "Studio transformation",
    description: "Combine deterministic image processing with reference-conditioned AI workflows.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 md:px-10">
      <header className="flex items-center justify-between border-b border-white/10 pb-6">
        <a href="/" className="text-lg font-semibold tracking-tight">
          JASHA<span className="text-[#d58a48]">.</span>STUDIOS
        </a>
        <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-[#a9a49b]">
          FOUNDATION PREVIEW
        </span>
      </header>

      <section className="grid flex-1 items-center gap-14 py-20 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#d58a48]">
            <CircleDot size={13} /> Virtual photography studio
          </p>
          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.06] tracking-[-0.055em] md:text-7xl">
            Your vision.
            <br />
            Your identity.
            <br />
            <span className="text-[#d58a48]">Reimagined.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-[#a9a49b]">
            Jasha Studios is being built to recreate the photographic treatment of a
            reference image while keeping the person in the photograph recognizably
            themselves.
          </p>
          <div className="mt-9 inline-flex items-center gap-3 rounded-full bg-[#d58a48] px-5 py-3 text-sm font-semibold text-[#17130f]">
            <Sparkles size={16} /> Foundation initialized
          </div>
        </div>

        <div className="grid gap-3">
          {capabilities.map(({ icon: Icon, title, description }, index) => (
            <article
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="text-xs text-[#a9a49b]">0{index + 1}</span>
                <Icon size={19} className="text-[#d58a48]" />
              </div>
              <h2 className="text-lg font-medium">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#a9a49b]">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 pt-5 text-xs text-[#77736c]">
        Jasha Studios · Phase 1 — Project foundation
      </footer>
    </main>
  );
}
