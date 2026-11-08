import Link from "next/link";
import { Camera, UserRoundPlus } from "lucide-react";
import { signup } from "@/app/actions/auth";

type SignupPageProps = { searchParams: Promise<{ error?: string }> };

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm font-semibold tracking-[0.16em]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d58a48] text-[#17130f]"><Camera size={18} /></span> JASHA STUDIOS
        </Link>
        <section className="rounded-3xl border border-white/10 bg-[#171715] p-7 shadow-2xl shadow-black/20 sm:p-9">
          <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-[#d58a48]"><UserRoundPlus size={19} /></div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d58a48]">Create your workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Start your studio</h1>
          <p className="mt-3 text-sm leading-6 text-[#a9a49b]">Create an account to organize your photography projects.</p>
          {params.error === "configuration" && <p role="alert" className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Supabase is not configured yet. Add the project URL and anon key to your environment.</p>}
          {params.error && params.error !== "configuration" && <p role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">We could not create the account. Check your details and try again.</p>}
          <form action={signup} className="mt-7 space-y-4">
            <label className="block text-sm text-[#d8d4cc]">Full name
              <input name="fullName" autoComplete="name" required minLength={2} maxLength={100} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#10100f] px-4 text-sm outline-none focus:border-[#d58a48]" placeholder="Your name" />
            </label>
            <label className="block text-sm text-[#d8d4cc]">Email address
              <input name="email" type="email" autoComplete="email" required maxLength={254} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#10100f] px-4 text-sm outline-none focus:border-[#d58a48]" placeholder="you@example.com" />
            </label>
            <label className="block text-sm text-[#d8d4cc]">Password
              <input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#10100f] px-4 text-sm outline-none focus:border-[#d58a48]" placeholder="At least 8 characters" />
            </label>
            <button className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[#d58a48] text-sm font-semibold text-[#17130f] transition hover:bg-[#e29b5a]">Create account</button>
          </form>
          <p className="mt-7 text-center text-sm text-[#a9a49b]">Already have an account? <Link href="/login" className="font-medium text-[#e6a66c] hover:underline">Sign in</Link></p>
        </section>
      </div>
    </main>
  );
}
