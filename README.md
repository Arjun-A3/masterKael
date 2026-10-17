# master kael

A small chat for working one LeetCode problem at a time. master kael keeps a brief on that problem — the statement, what you have established, your current idea, and the next question — and the conversation stays there until you reach an answer. Ask for the approaches and he will lay out brute force, the improvement, and the optimal version, each with its cost, then return to the step you were on.

## Host it as one Next.js app

Use this single app on **Vercel**. The pages and the API routes are the whole product. MongoDB Atlas holds Google sessions and lesson transcripts, so there is no second server to run.

Vercel is the simpler default. Render can run the same app too: `npm run build`, then `npm start`.

## What you will paste in

| Variable | What it is |
| --- | --- |
| `MONGODB_URI` | Atlas connection string |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth **web client**, not a service account |
| `AUTH_SECRET` | Random string, `openssl rand -base64 32` |
| `GROQ_API_KEY` | Free key from [console.groq.com](https://console.groq.com) |
| `GROQ_MODEL` | Optional. Defaults to `openai/gpt-oss-20b` |

A Google **service account** JSON (`client_email`, `private_key`) cannot sign a person in. In Google Cloud Console create an OAuth client:

1. APIs & Services → OAuth consent screen. External is fine. Add your Gmail as a test user while the app is in testing.
2. Credentials → Create credentials → OAuth client ID → **Web application**.
3. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-domain>/api/auth/callback/google`

Lessons call Groq's chat API. The default model is `openai/gpt-oss-20b`, an open-weight model on Groq's free tier. The free tier is rate limited to about 30 requests a minute and 1,000 a day, which is enough for one person working a problem. Set `GROQ_MODEL` to `openai/gpt-oss-120b` if you want a stronger reply on the same key.

```bash
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-20b
```

On Atlas, allow network access from anywhere (`0.0.0.0/0`) if you deploy to Vercel. Serverless IPs change.

## Local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`, sign in with Google, and start a lesson.

## Vercel

Import the repo, set the env vars from `.env.example`, and set `AUTH_URL` to the production URL (for example `https://masterkael.vercel.app`). `trustHost` is already on, so preview URLs work once Google knows their redirect URI.

Sessions use Auth.js with the MongoDB adapter (`strategy: "database"`), so login state lives in the `sessions` collection. Each problem is a document in `conversations` with a `question` brief, and the back-and-forth lives in `messages`. Both are scoped to the signed-in user.
