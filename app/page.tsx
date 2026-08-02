"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { randomTopic, type Topic } from "@/lib/topics";
import { countWords, WORD_LIMIT } from "@/lib/words";
import { encodeShare } from "@/lib/share";
import type { GradeResult } from "@/lib/grade";
import { ScoreBox } from "@/components/ScoreBox";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getClientId } from "@/lib/clientId";

type Phase = "start" | "writing" | "grading" | "done";

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
  }

  function pickTopic() {
    setTopic((prev) => randomTopic(prev?.id));
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-10 sm:py-14">
      <header className="mb-10 flex items-center justify-between">
        <button
          onClick={goHome}
          className="text-2xl font-bold tracking-tight text-[var(--text)]"
          aria-label="Back to start"
        >
          basically...
        </button>
        <ThemeToggle />
      </header>

      {phase === "start" && (
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-[var(--text)] sm:text-5xl">
            Do you really know how it works?
          </h1>
          <p className="mt-5 max-w-md text-lg text-[var(--text-muted)]">
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
                Same topic, 60 seconds each, higher score wins. Pick a nickname
                and we&apos;ll make you a shareable link.
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
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={createDuel}
                  disabled={creating || !duelNick.trim()}
                  className={`flex-1 ${primaryBtn}`}
                >
                  {creating ? "Creating…" : "Create match"}
                </button>
                <button
                  onClick={() => setChallenging(false)}
                  className={`flex-1 ${ghostBtn}`}
                >
                  Cancel
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

          <button
            onClick={submit}
            disabled={phase === "grading" || words === 0 || over}
            className={`mt-6 w-full ${primaryBtn}`}
          >
            {phase === "grading" ? "Scoring…" : "Score it"}
          </button>
        </div>
      )}

      {phase === "done" && topic && result && (
        <div className="space-y-4">
          <div className={`${card} text-center`}>
            <div className={`mb-4 ${chip}`}>{topic.category}</div>
            <h2 className="mb-6 text-xl font-semibold leading-tight text-[var(--text)] sm:text-2xl">
              {topic.prompt}
            </h2>

            <div className="flex flex-col items-center gap-4">
              <ScoreBox score={result.score} label="Your score" />
              {result.verdict && (
                <p className="max-w-md text-[var(--text-muted)]">{result.verdict}</p>
              )}
            </div>
          </div>

          <div className={card}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent-text)]">
              How it actually works
            </h3>
            <p className="text-[15px] leading-relaxed text-[var(--text-body)]">
              {result.modelAnswer}
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
            <button onClick={pickTopic} className={`flex-1 ${ghostBtn}`}>
              Go again
            </button>
          </div>

          {shareUrl && (
            <p className="break-all text-center text-xs text-[var(--text-faint)]">
              {shareUrl}
            </p>
          )}
        </div>
      )}

      <footer className="mt-auto pt-12 text-center text-xs text-[var(--text-faint)]">
        Scored by a robot. Don&apos;t take it personally.
      </footer>
    </main>
  );
}
