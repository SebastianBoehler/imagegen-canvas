import Link from "next/link";
import { signIn } from "@/auth";

const DEFAULT_REDIRECT = "/canvas";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "We could not connect to Google. Please try again.",
  OAuthCallback: "We could not complete the Google sign-in flow. Please try again.",
  OAuthAccountNotLinked:
    "A different account with the same email already exists. Please use that account instead.",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl: callbackUrlParam, error: errorParam } = await searchParams;
  const callbackUrl = callbackUrlParam || DEFAULT_REDIRECT;
  const errorMessage = errorParam ? ERROR_MESSAGES[errorParam] ?? "Unable to sign in. Please try again." : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12 text-neutral-200">
      <section className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/80 p-8 shadow-2xl backdrop-blur">
        <header className="mb-6 space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
          <p className="text-sm text-neutral-400">
            Continue to ImageGen Canvas with your Google account.
          </p>
        </header>

        {errorMessage ? (
          <p className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {errorMessage}
          </p>
        ) : null}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl });
          }}
          className="space-y-4"
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Continue with Google
          </button>
        </form>

        <footer className="mt-6 text-center text-xs text-neutral-500">
          <p>
            Need to switch accounts? You can first <Link href="/logout" className="font-medium text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white">
              sign out
            </Link>
            .
          </p>
        </footer>
      </section>
    </main>
  );
}
