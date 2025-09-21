import Link from "next/link";
import { auth, signOut } from "@/auth";

const DEFAULT_REDIRECT = "/";

type LogoutPageProps = {
  searchParams: Promise<Record<string, string>>;
};

export default async function LogoutPage({ searchParams }: LogoutPageProps) {
  const { callbackUrl: callbackUrlParam } = await searchParams
  const callbackUrl = callbackUrlParam || DEFAULT_REDIRECT
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12 text-neutral-200">
        <section className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/80 p-8 text-center shadow-2xl backdrop-blur">
          <h1 className="text-xl font-semibold text-white">You are signed out</h1>
          <p className="mt-3 text-sm text-neutral-400">
            Return to the
            {" "}
            <Link
              href="/login"
              className="font-medium text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white"
            >
              login page
            </Link>
            {" "}
            to access ImageGen Canvas.
          </p>
        </section>
      </main>
    );
  }

  const displayName = session.user.name ?? session.user.email ?? "your account";

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12 text-neutral-200">
      <section className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/80 p-8 shadow-2xl backdrop-blur">
        <header className="mb-6 space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-white">Sign out</h1>
          <p className="text-sm text-neutral-400">
            Sign out of {displayName} to stop syncing new canvases.
          </p>
        </header>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: callbackUrl });
          }}
          className="space-y-4"
        >
          <button
            type="submit"
            className="w-full rounded-md bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-200"
          >
            Sign out
          </button>
        </form>

        <footer className="mt-6 text-center text-xs text-neutral-500">
          <p>
            Changed your mind?
            {" "}
            <Link
              href="/canvas"
              className="font-medium text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white"
            >
              Return to your canvas
            </Link>
            {" "}
            instead.
          </p>
        </footer>
      </section>
    </main>
  );
}
