"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { randomTopic, type Topic } from "@/lib/topics";
import { countWords, WORD_LIMIT } from "@/lib/words";
import { encodeShare } from "@/lib/share";
import type { GradeResult } from "@/lib/grade";
import { ScoreBox } from "@/components/ScoreBox";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { getClientId } from "@/lib/clientId";

type Phase = "start" | "writing" | "grading" | "done";
type ExplainMode = "simple" | "advanced";

const primaryBtn =
  "rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40";
const ghostBtn =
  "rounded-lg border border-[var(--border)] bg-[var(--panel)] px-5 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--hover)]";
const card =
  "rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 sm:p-8";
const chip =
  "inline-block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]";

export default function Home() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("start");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [explainMode, setExplainMode] = useState<ExplainMode>("advanced");
  // Score from the previous attempt at this same topic (retry flow), so the
  // player can see whether they actually improved.
  const [prevScore, setPrevScore] = useState<number | null>(null);

  // "Challenge a friend" inline flow.
  const [challenging, setChallenging] = useState(false);
  const [duelNick, setDuelNick] = useState("");
  const [creating, setCreating] = useState(false);
  const [duelError, setDuelError] = useState<string | null>(null);

  async function createDuel() {
    if (!duelNick.trim() || creating) return;
    setCreating(true);
    setDuelError(null);
    try {
      const res = await fetch("/api/lobby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: getClientId(), nickname: duelNick }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't create a match.");
      router.push(`/lobby/${data.code}`);
    } catch (e) {
      setDuelError(e instanceof Error ? e.message : "Couldn't create a match.");
      setCreating(false);
    }
  }

  const words = countWords(text);
  const over = words > WORD_LIMIT;

  const shareUrl = useMemo(() => {
    if (!topic || !result || typeof window === "undefined") return "";
    const encoded = encodeShare({
      topic: topic.prompt,
      score: result.score,
      verdict: result.verdict,
    });
    return `${window.location.origin}/result/${encoded}`;
  }, [topic, result]);

  function goHome() {
    setPhase("start");
    setTopic(null);
    setText("");
    setResult(null);
    setError(null);
    setCopied(false);
    setPrevScore(null);
  }

  function pickTopic() {
    setTopic((prev) => randomTopic(prev?.id));
    setText("");
    setResult(null);
    setError(null);
    setCopied(false);
    setPrevScore(null);
    setPhase("writing");
  }

  // Retry the same topic: keep the prompt, remember the last score to compare
  // against, and drop back to a blank writing screen.
  function retrySameTopic() {
    if (!topic) return;
    setPrevScore(result?.score ?? null);
    setText("");
    setResult(null);
    setError(null);
    setCopied(false);
    setPhase("writing");
  }

  async function submit() {
    if (!topic || words === 0 || over) return;
    setPhase("grading");
    setError(null);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId: topic.id, explanation: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Something broke. Try again.");
      setResult(data as GradeResult);
      setExplainMode("advanced");
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something broke. Try again.");
      setPhase("writing");
    }
  }

  async function copyShare() {
    if (!topic || !result || !shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Couldn't copy. Grab the link below instead.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[var(--border)]">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <button
            onClick={goHome}
            className="text-xl font-bold tracking-tight text-[var(--text)]"
            aria-label="Back to start"
          >
            basically<span className="text-[var(--accent-text)]">…</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-12">

      {phase === "start" && (
        <div>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-[var(--text)]">
            How does it work?
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[var(--text-muted)]">
            Explain a random everyday thing in 100 words. Find out how much you
            actually understand.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button onClick={pickTopic} className={primaryBtn}>
              Give me a topic
            </button>
            {!challenging && (
              <button
                onClick={() => {
                  setChallenging(true);
                  setDuelError(null);
                }}
                className={ghostBtn}
              >
                Challenge a friend
              </button>
            )}
          </div>

          {challenging && (
            <div className={`mt-6 ${card}`}>
              <div className={`mb-3 ${chip}`}>1v1 duel</div>
              <h2 className="mb-1 text-xl font-semibold text-[var(--text)]">
                Challenge a friend
              </h2>
              <p className="mb-5 text-[var(--text-muted)]">
                You and a friend both get the same topic and 60 seconds to
                explain it, and whoever scores higher wins. Pick a nickname to
                create a lobby, then share the link to invite them in.
              </p>
              <input
                value={duelNick}
                onChange={(e) => setDuelNick(e.target.value)}
                maxLength={24}
                autoFocus
                placeholder="Your nickname"
                onKeyDown={(e) => e.key === "Enter" && createDuel()}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-4 text-base text-[var(--text)] outline-none transition placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
              />
              {duelError && (
                <p className="mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {duelError}
                </p>
              )}
              <div className="mt-5 flex items-center justify-between">
                <button
                  onClick={() => setChallenging(false)}
                  className={ghostBtn}
                >
                  Cancel
                </button>
                <button
                  onClick={createDuel}
                  disabled={creating || !duelNick.trim()}
                  className={primaryBtn}
                >
                  {creating ? "Creating…" : "Create match"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(phase === "writing" || phase === "grading") && topic && (
        <div className={card}>
          <div className={`mb-3 ${chip}`}>{topic.category}</div>
          <h2 className="mb-6 text-2xl font-semibold leading-tight text-[var(--text)] sm:text-3xl">
            {topic.prompt}
          </h2>

          {prevScore != null && (
            <p className="mb-4 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-muted)]">
              Another go at this one. Last time you scored{" "}
              <span className="font-semibold text-[var(--text)]">
                {prevScore}
              </span>
            </p>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={phase === "grading"}
            rows={7}
            autoFocus
            placeholder="Explain it..."
            className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-4 text-base text-[var(--text)] outline-none transition placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)] disabled:opacity-60"
          />

          <div className="mt-2 flex items-center justify-between text-sm">
            <span className={over ? "font-medium text-red-500" : "text-[var(--text-faint)]"}>
              {words} / {WORD_LIMIT}
              {over && " (too long)"}
            </span>
            <button
              onClick={pickTopic}
              disabled={phase === "grading"}
              className="text-[var(--text-faint)] underline-offset-4 transition hover:text-[var(--text)] hover:underline disabled:opacity-50"
            >
              Swap topic
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button onClick={goHome} className={ghostBtn}>
              Back
            </button>
            <button
              onClick={submit}
              disabled={phase === "grading" || words === 0 || over}
              className={primaryBtn}
            >
              {phase === "grading" ? "Scoring…" : "Score it"}
            </button>
          </div>
        </div>
      )}

      {phase === "done" && topic && result && (
        <div className="space-y-4">
          <div className={card}>
            <div className="sm:flex sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <div className={`mb-3 ${chip}`}>{topic.category}</div>
                <h2 className="text-xl font-semibold leading-tight text-[var(--text)] sm:text-2xl">
                  {topic.prompt}
                </h2>
                {result.verdict && (
                  <p className="mt-4 text-[var(--text-muted)]">{result.verdict}</p>
                )}
              </div>
              <div className="mt-5 shrink-0 sm:mt-0">
                <ScoreBox score={result.score} label="Your score" />
                {prevScore != null && (
                  <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
                    {result.score > prevScore
                      ? `Up ${result.score - prevScore} from ${prevScore}`
                      : result.score < prevScore
                        ? `Down ${prevScore - result.score} from ${prevScore}`
                        : `Same as last time (${prevScore})`}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className={card}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-text)]">
                How it actually works
              </h3>
              {result.simpleAnswer && (
                <ExplainToggle mode={explainMode} onChange={setExplainMode} />
              )}
            </div>
            <p className="text-[15px] leading-relaxed text-[var(--text-body)]">
              {explainMode === "simple" && result.simpleAnswer
                ? result.simpleAnswer
                : result.modelAnswer}
            </p>
          </div>

          {result.corrections.length > 0 && (
            <div className={card}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                What you skipped
              </h3>
              <ul className="space-y-2.5">
                {result.corrections.map((c, i) => (
                  <li key={i} className="flex gap-2.5 text-[15px] text-[var(--text-muted)]">
                    <span aria-hidden className="mt-[2px] text-[var(--accent-text)]">
                      →
                    </span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={card}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              What you wrote
            </h3>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--text-muted)]">
              {text}
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <button onClick={copyShare} className={`flex-1 ${primaryBtn}`}>
              {copied ? "Link copied!" : "Share result"}
            </button>
            <button onClick={retrySameTopic} className={`flex-1 ${ghostBtn}`}>
              Try this topic again
            </button>
            <button onClick={pickTopic} className={`flex-1 ${ghostBtn}`}>
              New topic
            </button>
          </div>

          {shareUrl && (
            <p className="break-all text-xs text-[var(--text-faint)]">
              {shareUrl}
            </p>
          )}
        </div>
      )}

      </main>

      <Footer />
    </div>
  );
}

// A small segmented control to switch the model explanation between a
// plain-language "simple" version and the precise "advanced" one.
function ExplainToggle({
  mode,
  onChange,
}: {
  mode: ExplainMode;
  onChange: (m: ExplainMode) => void;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-md border border-[var(--border)] p-0.5 text-xs font-semibold">
      {(["simple", "advanced"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          aria-pressed={mode === m}
          className={`rounded px-2.5 py-1 capitalize transition ${
            mode === m
              ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
              : "text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
