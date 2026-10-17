<div align="center">

# master kael

The right question is the lesson.

</div>

Bring one LeetCode problem. master kael talks it through until the answer is in your hands.

He keeps a brief so you never repeat yourself: the statement, what you have already established, the idea on the table, and the question still waiting. Name a different problem and he sends you to a fresh lesson, then asks that same question again.

Ask for the approaches and he lays them out in order — brute force, the improvement, and the optimal version — each with its cost. Then he walks you back to the step you were on.

## How a lesson moves

| | |
| --- | --- |
| **Understand** | He locks the problem in one sentence and asks one question. |
| **Approach** | Your idea first. When it is real, he names the pattern and what it costs. |
| **Example** | One small input, walked by hand. A miss comes back as a counterexample. |
| **Code** | A short solution in your language. Python, if you never picked one. |
| **Check** | The edge that breaks it: empty, duplicates, negatives, a single element. |
| **Solved** | Complexity in one line. He stops quizzing. |

Stuck? You get one hint, then the same question. Right fragment? He says which part holds, and only then asks the next thing.

## Sit down

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, and name a problem.

## What you paste in

| Variable | What it is |
| --- | --- |
| `MONGODB_URI` | Atlas connection string. Your lessons live here. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth **web client**, not a service account |
| `AUTH_SECRET` | Random string. `openssl rand -base64 32` |
| `GROQ_API_KEY` | Free key from [console.groq.com](https://console.groq.com) |
| `GROQ_MODEL` | Optional. Defaults to `openai/gpt-oss-20b` |

A Google service-account JSON (`client_email`, `private_key`) cannot sign a person in. In Google Cloud Console, create an OAuth client:

1. APIs & Services → OAuth consent screen. External is fine. Add your Gmail as a test user while the app is in testing.
2. Credentials → Create credentials → OAuth client ID → **Web application**.
3. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

Lessons call Groq. The default model is `openai/gpt-oss-20b` on the free tier, about 30 requests a minute and 1,000 a day — enough for one person and one problem. Set `GROQ_MODEL` to `openai/gpt-oss-120b` when you want a sharper reply on the same key.

```bash
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-20b
```

Sign-in is stored with Auth.js and the MongoDB adapter. Each problem is its own document: a `question` brief, and the back-and-forth in `messages`. Both belong to the signed-in user.
