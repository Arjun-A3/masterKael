import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

const AUTH_ERRORS: Record<string, string> = {
  Configuration: "Google sign-in is missing its client id, secret, or AUTH_SECRET.",
  AccessDenied: "Google did not grant access.",
  OAuthSignin: "Could not start Google sign-in.",
  OAuthCallback: "Google returned an error. Check the redirect URI in Google Cloud.",
  Callback: "Could not finish sign-in. Check that MongoDB is reachable.",
  Default: "Sign-in failed. Check the server logs.",
};

const EXAMPLES = [
  ["01", "Two Sum", "One problem, talked through until the answer."],
  ["02", "3Sum", "He keeps what you have already established."],
  ["03", "LRU Cache", "The next question stays on this problem."],
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const missing = [
    ["AUTH_SECRET", process.env.AUTH_SECRET],
    ["AUTH_GOOGLE_ID", process.env.AUTH_GOOGLE_ID],
    ["AUTH_GOOGLE_SECRET", process.env.AUTH_GOOGLE_SECRET],
    ["MONGODB_URI", process.env.MONGODB_URI],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  let signedIn = false;
  if (missing.length === 0) {
    try {
      const session = await auth();
      signedIn = Boolean(session?.user);
    } catch (error) {
      console.error(error);
    }
  }

  if (signedIn) redirect("/chat");

  async function login() {
    "use server";
    await signIn("google", { redirectTo: "/chat" });
  }

  const errorMessage = params.error
    ? AUTH_ERRORS[params.error] || AUTH_ERRORS.Default
    : null;

  return (
    <main className="landing">
      <header className="topbar">
        <span className="mark">
          <span className="blade" aria-hidden="true" />
          master kael
        </span>
      </header>
      <div className="landing-grid">
        <div>
          <p className="eyebrow">A patient order</p>
          <h1>The right question is the lesson.</h1>
          <p className="lede">
            Each lesson is one LeetCode problem, talked through until you reach an
            answer. master kael keeps the statement, what you have already established,
            and the question still in front of you.
          </p>
          {missing.length > 0 ? (
            <p className="setup">
              Sign-in is waiting on {missing.join(", ")}. Copy <code>.env.example</code> to{" "}
              <code>.env.local</code> and fill those in. Google needs an OAuth web client,
              not a service account.
            </p>
          ) : (
            <form action={login}>
              <button className="google" type="submit">
                <GoogleMark />
                Continue with Google
              </button>
            </form>
          )}
          {errorMessage ? <p className="banner">{errorMessage}</p> : null}
          <p className="fine">Each problem keeps its own conversation in MongoDB. The model key stays on the server.</p>
        </div>
        <ol className="index">
          {EXAMPLES.map(([index, title, detail]) => (
            <li key={index}>
              <span>{index}</span>
              <strong>{title}</strong>
              <em>{detail}</em>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
