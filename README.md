# basically…

A tiny web game built around the **illusion of explanatory depth**: you think you
understand how everyday things work — until you try to explain one in 100 words.
(The repo/folder is still named `explain-it`; the product name is “basically…”.)
Pick a topic, write your explanation, and an AI grades it 1–100 for accuracy and
completeness, shows the corrections you missed, and gives a model answer. Results
are shareable via a link (with an auto-generated social card).

- **Framework:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Grading:** Google Gemini (`gemini-3.6-flash`, free tier), called server-side only
- **Persistence:** none — shared results are encoded directly in the URL
- **Hosting:** Vercel

---

## 1. Prerequisites

- **Node.js 18.18+** (Node 20+ recommended). Check with `node -v`.
- A **Google Gemini API key** (free). Get one at
  <https://aistudio.google.com/apikey> — sign in with a Google account, click
  *Create API key*, and copy it. No billing required for the free tier.

## 2. Run locally

```bash
# from the project root
npm install

# set up your key
cp .env.example .env.local
# then edit .env.local and paste your Gemini key:
#   GEMINI_API_KEY=AIza...

npm run dev
```

Open <http://localhost:3000>.

> The key lives only in `.env.local` (git-ignored) and is used only in the
> server-side grading route — it never reaches the browser.

## 3. How it works

- `app/page.tsx` — the game (pick topic → write → submit → see score + model answer → share).
- `app/api/grade/route.ts` — POST endpoint; validates input, enforces the 100-word
  cap server-side, rate-limits per IP, and calls Gemini.
- `lib/grade.ts` — builds the grading prompt and calls the Gemini REST API,
  requesting JSON output with a fixed schema.
- `lib/topics.ts` — the curated list of ~125 topics.
- `lib/share.ts` — encodes/decodes a result into a URL-safe string (the whole
  "database").
- `app/result/[data]/page.tsx` — the page a shared link opens.
- `app/og/route.tsx` — the auto-generated social share image.

## 4. Deploy to Vercel

1. Push this repo to GitHub (see below).
2. Go to <https://vercel.com>, sign up / log in (GitHub login is easiest).
3. **Add New → Project → Import** your GitHub repo. Framework preset auto-detects
   as **Next.js** — leave the defaults.
4. Under **Environment Variables**, add:
   - `GEMINI_API_KEY` = your Gemini key
5. Click **Deploy**. You'll get a live URL like `https://explain-it-xxxx.vercel.app`.

To push to GitHub the first time:

```bash
git init
git add .
git commit -m "Explain It: initial version"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/explain-it.git
git branch -M main
git push -u origin main
```

Redeploys happen automatically on every push to `main`.

## 5. Test checklist

- [ ] Submit a **strong** and a **weak** explanation for at least 3 topics; confirm
      scores and feedback are sane (strong ≫ weak).
- [ ] Confirm the **100-word cap** blocks submission client-side, and that a direct
      API call over the limit is rejected server-side.
- [ ] Click **Share my result**, open the copied link in another tab/browser, and
      confirm the result card renders and the link unfurls with an image (paste it
      into a chat app to see the card).

## Notes & knobs

- **Model:** `GEMINI_MODEL` in `lib/grade.ts` (default `gemini-3.6-flash`). Use
  `gemini-flash-latest` to always track Google's current flash model, or
  `gemini-3.5-flash-lite` for a faster/lighter option. Note: Gemini 3 models do
  **not** accept the older `thinkingConfig.thinkingBudget` field.
- **Rate limit:** `lib/rateLimit.ts` (default 8 requests / minute / IP). It's
  in-memory and best-effort; for serious traffic, swap in a shared store.
- **Free-tier limits:** Gemini's free tier is rate-limited per minute/day. Normal
  personal use stays well within it; you are never billed on the free tier.
