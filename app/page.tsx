import { auth, signIn } from "@/auth";
import { GoogleSignIn } from "@/components/auth-pending";
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
              <GoogleSignIn />
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
