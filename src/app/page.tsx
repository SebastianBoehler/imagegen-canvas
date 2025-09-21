import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  const { user } = session || {};
  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-24 h-64 w-64 rounded-full bg-purple-600/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-6 text-sm text-neutral-400 sm:px-10">
          <div className="flex items-center gap-2 text-neutral-200">
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/80">
              Beta
            </span>
            <span className="font-semibold text-neutral-100">ImageGen Canvas</span>
          </div>
          <nav className="hidden items-center gap-6 sm:flex">
            <Link href="#features" className="transition hover:text-white">
              Features
            </Link>
            <Link href="/login" className="transition hover:text-white">
              Sign in
            </Link>
            <Link
              href="/canvas"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-medium text-white transition hover:bg-white/10"
            >
              Open canvas
            </Link>
          </nav>
        </header>

        <section className="flex flex-1 flex-col items-center px-6 pb-16 pt-12 sm:px-10 lg:flex-row lg:items-center lg:justify-center lg:gap-16 lg:pt-24">
          <div className="max-w-xl text-center lg:text-left">
            <p className="text-sm uppercase tracking-[0.3em] text-purple-300/70">Print quality image generation</p>
            <h1 className="mt-6 text-4xl font-semibold text-white sm:text-5xl">
              Orchestrate agent-driven image workflows from a live canvas.
            </h1>
            <p className="mt-6 text-base text-neutral-400 sm:text-lg">
              Prompt, iterate, and arrange AI-generated visuals in a persistent workspace. Attach references, swap
              models, and prepare for autonomous agent loops—all without leaving the canvas.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/login"
                className="w-full rounded-md bg-white px-5 py-2.5 text-center text-sm font-medium text-neutral-900 transition hover:bg-white/90 sm:w-auto"
              >
                Continue with Google
              </Link>
              <Link
                href="/canvas"
                className="w-full rounded-md border border-white/10 bg-white/5 px-5 py-2.5 text-center text-sm font-medium text-white transition hover:bg-white/10 sm:w-auto"
              >
                Explore the canvas
              </Link>
            </div>
          </div>

          <div className="mt-12 w-full max-w-4xl lg:mt-0">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/70 p-3 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)] backdrop-blur">
              <div className="overflow-hidden rounded-2xl border border-white/5">
                <Image
                  alt="Screenshot of ImageGen Canvas workspace"
                  src="/static/images/screenshot.png"
                  width={1922}
                  height={933}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="px-6 pb-24 sm:px-10">
          <div className="mx-auto grid max-w-5xl gap-6 rounded-3xl border border-white/10 bg-neutral-900/80 p-8 text-neutral-300 backdrop-blur md:grid-cols-3 md:p-12">
            <article>
              <h2 className="text-lg font-semibold text-white">Canvas-first prompting</h2>
              <p className="mt-3 text-sm text-neutral-400">
                Move beyond chat logs. Compose prompts, drag results, and sketch flows directly on the infinite canvas.
              </p>
            </article>
            <article>
              <h2 className="text-lg font-semibold text-white">Agent-ready foundation</h2>
              <p className="mt-3 text-sm text-neutral-400">
                The UI is built for future automation—style runs, prompt enhancers, and variant explorers are ready to slot in.
              </p>
            </article>
            <article>
              <h2 className="text-lg font-semibold text-white">Attach and align</h2>
              <p className="mt-3 text-sm text-neutral-400">
                Snap reference images, keep aspect ratios consistent, and iterate on generations without losing context.
              </p>
            </article>
          </div>
        </section>

        <footer className="px-6 pb-12 text-xs text-neutral-500 sm:px-10">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
            <p>© {new Date().getFullYear()} ImageGen Canvas. Building agent-native tools.</p>
            <div className="flex items-center gap-4">
              {!user && <Link href="/login" className="transition hover:text-white">
                Sign in
              </Link>}
              {user && <Link href="/logout" className="transition hover:text-white">
                Sign out
              </Link>}
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
