# basically…

You think you understand how everyday things work, until you try to explain one
in 100 words. That's the game.

Get a random topic, write your explanation, and an AI grades it
1–100 for accuracy and completeness, points out what you got wrong, and shows a
model answer. You can share your result as a link with an auto-generated card, or
challenge a friend to a live head-to-head round.

**Built with:** Next.js (App Router) · TypeScript · Tailwind · Google Gemini for
grading · Supabase for multiplayer · deployed on Vercel.

## Two ways to play

- **Solo:** pick or roll a topic, write, get graded. Share the result via a link
  (the whole result is encoded in the URL, so there's no database for solo play).
- **Challenge a friend:** create a lobby, send the link, both players get the same
  topic and a synced 60-second timer, both answers are graded, higher score wins.
  There are no accounts, only player nicknames which we manage with Supabase.

## Run it locally

You'll need Node 18.18+ and a free [Gemini API key](https://aistudio.google.com/apikey)
(sign in, *Create API key*, copy it; no billing).

```bash
npm install
cp .env.example .env.local   # then paste your Gemini key into .env.local
npm run dev
```

Open <http://localhost:3000>. The solo game works with just the Gemini key.

Multiplayer runs on a free [Supabase](https://supabase.com) project
with two tables (`lobbies` and `players`) plus the three `SUPABASE_*` values in
`.env.local`. Solo play never touches Supabase, so you can skip this entirely. The
Gemini key never reaches the browser, and the Supabase service-role key stays
server-side only.


## Knobs worth knowing

- **Model:** `GEMINI_MODEL` in `lib/grade.ts` (default `gemini-3.6-flash`). Use
  `gemini-flash-latest` to track Google's current flash model.
- **Rate limit:** `lib/rateLimit.ts`, 8 requests/min/IP, in-memory and best-effort.
- **Cost:** free tier all around. Normal personal use never gets billed.
