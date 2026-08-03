"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { countWords, capWords, WORD_LIMIT } from "@/lib/words";
import {
  ALLOWED_ROUNDS,
  GRACE_SECONDS,
  FORFEIT_WAIT_PRESENT_SECONDS,
  FORFEIT_WAIT_ABSENT_SECONDS,
  READY_TIMEOUT_SECONDS,
  type RoundMode,
} from "@/lib/lobby";
import { ScoreBox } from "@/components/ScoreBox";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { getClientId } from "@/lib/clientId";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

type Grade = {
  verdict: string;
  corrections: string[];
  modelAnswer: string;
  simpleAnswer?: string;
};

type ExplainMode = "simple" | "advanced";

type LobbyView = {
  code: string;
  status: "waiting" | "playing" | "revealed";
  full: boolean;
  topic: { id: string; prompt: string; category: string } | null;
  startedAt: number | null;
  durationSeconds: number;
  totalRounds: number;
  roundNumber: number;
  seriesOver: boolean;
  seriesWinner: "you" | "opponent" | null;
  rematchRequestedBy: "you" | "opponent" | null;
  you: {
    nickname: string;
    role: "host" | "guest";
    submitted: boolean;
    ready: boolean;
    roundsWon: number;
    score: number | null;
    grade: Grade | null;
    answer: string | null;
  } | null;
  opponent: {
    nickname: string;
    submitted: boolean;
    ready: boolean;
    roundsWon: number;
    score: number | null;
    grade: Grade | null;
    answer: string | null;
  } | null;
  winner: "you" | "opponent" | "draw" | null;
};

const primaryBtn =
  "rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40";
const ghostBtn =
  "rounded-lg border border-[var(--border)] bg-[var(--panel)] px-5 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--hover)]";
const card =
  "rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 sm:p-8";
const chip =
  "inline-block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]";

// How many times a submit retries on transient failure (grader busy / network)
// before giving up and asking the player to lock in manually.
const MAX_SUBMIT_TRIES = 5;

function fmtTime(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

export default function LobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();
  const router = useRouter();

  const [clientId, setClientId] = useState("");
  const [view, setView] = useState<LobbyView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  const [nickname, setNickname] = useState("");
  const [answer, setAnswer] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [explainMode, setExplainMode] = useState<ExplainMode>("advanced");

  // Host's best-of choice in the waiting room.
  const [selectedRounds, setSelectedRounds] = useState<RoundMode>(1);
  // Auto-ready countdown between rounds.
  const [readySecs, setReadySecs] = useState<number | null>(null);
  // Opponent connection state (Realtime Presence). Defaults to present so we
  // never wrongly block before we have signal.
  const [opponentPresent, setOpponentPresent] = useState(true);

  // Guards so timer-driven actions fire exactly once per round.
  const submittingRef = useRef(false);
  const revealingRef = useRef(false);
  const readyFiredRef = useRef("");
  const autoTriesRef = useRef(0); // capped submit attempts this round
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // When a submit is waiting to retry (grader busy), the epoch ms it fires at.
  const [retryUntil, setRetryUntil] = useState<number | null>(null);
  const [, setTick] = useState(0); // drives the retry countdown display

  useEffect(() => setClientId(getClientId()), []);

  const refetch = useCallback(async () => {
    if (!clientId) return;
    try {
      const res = await fetch(
        `/api/lobby/${code}?clientId=${encodeURIComponent(clientId)}`,
        { cache: "no-store" },
      );
      if (res.status === 404) {
        setFatal("This match doesn't exist (or it expired).");
        setLoaded(true);
        return;
      }
      const data = (await res.json()) as LobbyView;
      setView(data);
      setLoaded(true);
    } catch {
      // transient failure; keep whatever we had
    }
  }, [clientId, code]);

  useEffect(() => {
    if (clientId) refetch();
  }, [clientId, refetch]);

  // Realtime (change signals + presence) with a polling safety net.
  useEffect(() => {
    if (!clientId) return;
    const supabase = getSupabaseBrowser();

    const poll = setInterval(() => {
      setView((v) => {
        if (!v || v.status !== "revealed") refetch();
        return v;
      });
    }, 2000);

    if (!supabase) {
      setOpponentPresent(true); // no realtime → assume present, rely on handshake
      return () => clearInterval(poll);
    }

    let leaveTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase.channel(`lobby:${code}`, {
      config: { presence: { key: clientId } },
    });

    const computePresence = () => {
      const ids = Object.keys(channel.presenceState());
      const oppPresent = ids.some((id) => id !== clientId);
      if (oppPresent) {
        if (leaveTimer) {
          clearTimeout(leaveTimer);
          leaveTimer = null;
        }
        setOpponentPresent(true);
      } else if (!leaveTimer) {
        // Debounce so a refresh (leave→join) doesn't flap as "left".
        leaveTimer = setTimeout(() => setOpponentPresent(false), 4000);
      }
    };

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lobbies", filter: `code=eq.${code}` },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        () => refetch(),
      )
      .on("presence", { event: "sync" }, computePresence)
      .on("presence", { event: "join" }, computePresence)
      .on("presence", { event: "leave" }, computePresence)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ cid: clientId });
      });

    return () => {
      if (leaveTimer) clearTimeout(leaveTimer);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [clientId, code, refetch]);

  // Round countdown, derived purely from the server's startedAt.
  useEffect(() => {
    if (!view || view.status !== "playing" || view.startedAt == null) {
      setRemaining(null);
      return;
    }
    const end = view.startedAt + view.durationSeconds * 1000;
    const tick = () => setRemaining((end - Date.now()) / 1000);
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [view]);

  const words = countWords(answer);
  const over = words > WORD_LIMIT;
  const youSubmitted = view?.you?.submitted ?? false;

  // Always hold the latest typed answer so timeout-driven callbacks (which may
  // capture a stale closure) submit what's actually on screen.
  const answerRef = useRef("");
  answerRef.current = answer;

  const doReveal = useCallback(async () => {
    if (!clientId || revealingRef.current) return;
    revealingRef.current = true;
    try {
      const res = await fetch(`/api/lobby/${code}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send my typed answer so it's graded instead of an empty forfeit.
        body: JSON.stringify({ clientId, answer: capWords(answerRef.current) }),
      });
      // "Too early" (before the grace window) — let a later tick retry.
      if (res.status === 409) revealingRef.current = false;
    } catch {
      revealingRef.current = false;
    }
    await refetch();
  }, [clientId, code, refetch]);

  // Latest doSubmit, so a scheduled retry always calls the current closure.
  const doSubmitRef = useRef<(auto: boolean) => void>(() => {});

  const doSubmit = useCallback(
    async (auto: boolean) => {
      // A manual attempt cancels any pending retry and starts a fresh budget.
      if (!auto) {
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        setRetryUntil(null);
        autoTriesRef.current = 0;
      }
      if (!clientId || submittingRef.current) return;
      autoTriesRef.current += 1;
      const tries = autoTriesRef.current;
      submittingRef.current = true;
      setBusy(true);
      setError(null);

      let retryMs: number | null = null;
      try {
        const res = await fetch(`/api/lobby/${code}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, answer: capWords(answerRef.current) }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          // Deadline passed before this landed; salvage the text via reveal.
          await doReveal();
          await refetch();
        } else if (res.status === 429) {
          // Grader quota (Gemini free tier). Wait the server-suggested delay.
          const ra = Number(data?.retryAfter);
          retryMs = Math.min((Number.isFinite(ra) && ra > 0 ? ra : 30) * 1000, 60000);
        } else if (!res.ok) {
          retryMs = 4000; // transient server/network hiccup
        } else {
          await refetch();
        }
      } catch {
        retryMs = 4000;
      } finally {
        setBusy(false);
        submittingRef.current = false;
      }

      if (retryMs == null) return; // success (or finalized via reveal)

      if (tries >= MAX_SUBMIT_TRIES) {
        setRetryUntil(null);
        setError(
          "The grader is still busy (free-tier limit). Wait a bit, then hit Lock in answer.",
        );
        return;
      }
      // Schedule one retry; the internal timer drives it (not the tick effect).
      setRetryUntil(Date.now() + retryMs);
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        setRetryUntil(null);
        doSubmitRef.current(true);
      }, retryMs);
    },
    [clientId, code, refetch, doReveal],
  );
  doSubmitRef.current = doSubmit;

  const doReady = useCallback(async () => {
    if (!clientId) return;
    try {
      await fetch(`/api/lobby/${code}/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      await refetch();
    } catch {
      // poll will retry
    }
  }, [clientId, code, refetch]);

  // Auto-submit when the round timer runs out. This only kicks the first
  // attempt; any retries are driven by doSubmit's own timer, so we don't fire on
  // every tick.
  useEffect(() => {
    if (
      remaining != null &&
      remaining <= 0 &&
      view?.status === "playing" &&
      !youSubmitted &&
      !submittingRef.current &&
      autoTriesRef.current === 0 &&
      retryTimerRef.current === null
    ) {
      doSubmit(true);
    }
  }, [remaining, view?.status, youSubmitted, doSubmit]);

  // If I've submitted but the opponent hasn't past the deadline (+ grace), nudge
  // the reveal so the round can finalize with their forfeit. Crucially, wait
  // much longer while they still look connected: they may just be mid-grade on a
  // genuine last-second answer, and forfeiting them here would clobber it. Once
  // their own submit lands it finalizes the round and this never fires.
  useEffect(() => {
    const forfeitWait = opponentPresent
      ? FORFEIT_WAIT_PRESENT_SECONDS
      : FORFEIT_WAIT_ABSENT_SECONDS;
    if (
      view?.status === "playing" &&
      youSubmitted &&
      remaining != null &&
      remaining <= -(GRACE_SECONDS + forfeitWait) &&
      !view.opponent?.submitted &&
      !revealingRef.current
    ) {
      doReveal();
    }
  }, [
    view?.status,
    youSubmitted,
    remaining,
    view?.opponent?.submitted,
    opponentPresent,
    doReveal,
  ]);

  // Reset per-round local state whenever a fresh round begins.
  const roundKey = `${view?.status}:${view?.startedAt ?? ""}`;
  useEffect(() => {
    if (view?.status === "playing" && !youSubmitted) {
      submittingRef.current = false;
      revealingRef.current = false;
      autoTriesRef.current = 0;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setRetryUntil(null);
      setAnswer("");
      setError(null);
      setExplainMode("advanced");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey]);

  // Tick the retry countdown display while a submit is waiting to retry.
  useEffect(() => {
    if (retryUntil == null) return;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [retryUntil]);

  // Clean up any pending retry timer on unmount.
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  // Between-rounds auto-ready countdown (not on the series-deciding screen).
  const inRoundBreak =
    view?.status === "revealed" && !view.seriesOver && !!view.opponent;
  useEffect(() => {
    if (!inRoundBreak || !view) {
      setReadySecs(null);
      return;
    }
    const key = `${view.roundNumber}:${view.startedAt}`;
    const deadline = Date.now() + READY_TIMEOUT_SECONDS * 1000;
    const tick = () => {
      const rem = (deadline - Date.now()) / 1000;
      setReadySecs(rem);
      if (rem <= 0 && readyFiredRef.current !== key && !view.you?.ready) {
        readyFiredRef.current = key;
        doReady();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inRoundBreak, view?.roundNumber, view?.startedAt, view?.you?.ready, doReady]);

  async function join() {
    if (!clientId || !nickname.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lobby/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, nickname }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't join.");
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join.");
    } finally {
      setBusy(false);
    }
  }

  async function startMatch() {
    if (!clientId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lobby/${code}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, totalRounds: selectedRounds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't start.");
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start.");
    } finally {
      setBusy(false);
    }
  }

  async function rematch(action: "request" | "accept" | "decline" | "cancel") {
    if (!clientId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lobby/${code}/rematch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't do that.");
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't do that.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/lobby/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Couldn't copy. Grab the link below.");
    }
  }

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/lobby/${code}` : "";

  const seriesLine = view?.you
    ? `${view.you.nickname} ${view.you.roundsWon} - ${view.opponent?.roundsWon ?? 0} ${
        view.opponent?.nickname ?? "…"
      }  ·  Best of ${view.totalRounds}`
    : "";

  const oppGone = !!view?.opponent && !opponentPresent;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[var(--border)]">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <button
            onClick={() => router.push("/")}
            className="text-xl font-bold tracking-tight text-[var(--text)]"
            aria-label="Back to start"
          >
            basically<span className="text-[var(--accent-text)]">…</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-12">

      {!loaded && (
        <div className="flex flex-1 items-center justify-center text-[var(--text-muted)]">
          Loading match…
        </div>
      )}

      {loaded && fatal && (
        <div className={`${card} text-center`}>
          <p className="text-lg text-[var(--text)]">{fatal}</p>
          <button onClick={() => router.push("/")} className={`mt-6 ${primaryBtn}`}>
            Back home
          </button>
        </div>
      )}

      {/* Not a member yet: join screen */}
      {loaded && !fatal && view && !view.you && (
        <div className={card}>
          {view.full || view.status !== "waiting" ? (
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-[var(--text)]">
                {view.full ? "This match is full." : "This match already started."}
              </h2>
              <p className="mt-2 text-[var(--text-muted)]">
                Start your own and send the link instead.
              </p>
              <button
                onClick={() => router.push("/")}
                className={`mt-6 ${primaryBtn}`}
              >
                Start your own
              </button>
            </div>
          ) : (
            <>
              <div className={`mb-3 ${chip}`}>1v1 duel</div>
              <h2 className="mb-2 text-2xl font-semibold text-[var(--text)]">
                Join the match
              </h2>
              <p className="mb-6 text-[var(--text-muted)]">
                Pick a nickname. You&apos;ll both get the same topic and 60 seconds.
              </p>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={24}
                autoFocus
                placeholder="Your nickname"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-4 text-base text-[var(--text)] outline-none transition placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
                onKeyDown={(e) => e.key === "Enter" && join()}
              />
              {error && (
                <p className="mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {error}
                </p>
              )}
              <button
                onClick={join}
                disabled={busy || !nickname.trim()}
                className={`mt-6 w-full ${primaryBtn}`}
              >
                {busy ? "Joining…" : "Join match"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Waiting room */}
      {loaded && !fatal && view?.you && view.status === "waiting" && (
        <div className={card}>
          <div className={`mb-3 ${chip}`}>Waiting room</div>
          <h2 className="mb-1 text-2xl font-semibold text-[var(--text)]">
            Share this link
          </h2>
          <p className="mb-5 text-[var(--text-muted)]">
            Send it to one friend. When they join, start the match.
          </p>

          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3">
            <span className="truncate text-sm text-[var(--text-body)]">
              {shareUrl}
            </span>
            <button
              onClick={copyLink}
              className="shrink-0 text-sm font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <div className="mb-6 text-center">
            <div className="text-xs uppercase tracking-wider text-[var(--text-faint)]">
              Join code
            </div>
            <div className="text-4xl font-bold tracking-[0.3em] text-[var(--text)]">
              {code}
            </div>
          </div>

          <div className="mb-6 space-y-2">
            <PlayerLine label={`You: ${view.you.nickname}`} present />
            <PlayerLine
              label={
                view.opponent
                  ? oppGone
                    ? `${view.opponent.nickname} (disconnected)`
                    : `${view.opponent.nickname} joined ✓`
                  : "Waiting for opponent…"
              }
              present={!!view.opponent && !oppGone}
            />
          </div>

          {/* Host picks the format */}
          {view.you.role === "host" ? (
            <>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                Match length
              </div>
              <div className="mb-6 grid grid-cols-3 gap-2">
                {ALLOWED_ROUNDS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setSelectedRounds(n)}
                    className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                      selectedRounds === n
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
                        : "border-[var(--border)] text-[var(--text)] hover:bg-[var(--hover)]"
                    }`}
                  >
                    Best of {n}
                  </button>
                ))}
              </div>

              {error && (
                <p className="mb-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {error}
                </p>
              )}

              <button
                onClick={startMatch}
                disabled={busy || !view.opponent || oppGone}
                className={`w-full ${primaryBtn}`}
              >
                {!view.opponent
                  ? "Waiting for opponent…"
                  : oppGone
                    ? "Opponent disconnected…"
                    : busy
                      ? "Starting…"
                      : `Start best of ${selectedRounds}`}
              </button>
            </>
          ) : (
            <p className="text-center text-[var(--text-muted)]">
              Waiting for host to start…
            </p>
          )}
        </div>
      )}

      {/* Playing */}
      {loaded && !fatal && view?.you && view.status === "playing" && view.topic && (
        <div className={card}>
          <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            <span>
              Round {view.roundNumber}
              {view.totalRounds > 1 ? ` · Best of ${view.totalRounds}` : ""}
            </span>
            {view.totalRounds > 1 && (
              <span>
                {view.you.roundsWon} - {view.opponent?.roundsWon ?? 0}
              </span>
            )}
          </div>

          <div className="mb-3 flex items-center justify-between">
            <div className={chip}>{view.topic.category}</div>
            {/* Timer freezes once you lock in; it only counts down while writing. */}
            {!youSubmitted && (
              <div
                className={`text-2xl font-bold tabular-nums ${
                  remaining != null && remaining <= 10
                    ? "text-red-500"
                    : "text-[var(--text)]"
                }`}
              >
                {fmtTime(remaining ?? view.durationSeconds)}
              </div>
            )}
          </div>

          <h2 className="mb-6 text-2xl font-semibold leading-tight text-[var(--text)] sm:text-3xl">
            {view.topic.prompt}
          </h2>

          {!youSubmitted ? (
            <>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={busy}
                rows={7}
                autoFocus
                placeholder="Explain it..."
                className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-4 text-base text-[var(--text)] outline-none transition placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)] disabled:opacity-60"
              />
              <div className="mt-2 flex items-center justify-between text-sm">
                <span
                  className={
                    over ? "font-medium text-red-500" : "text-[var(--text-faint)]"
                  }
                >
                  {words} / {WORD_LIMIT}
                  {over && " (too long)"}
                </span>
                <span className="text-[var(--text-faint)]">
                  {view.opponent?.submitted
                    ? "Opponent locked in ✓"
                    : "Opponent still writing…"}
                </span>
              </div>

              {retryUntil != null && (
                <p className="mt-4 rounded-md bg-[var(--hover)] px-3 py-2 text-sm text-[var(--text-muted)]">
                  The grader hit its free-tier limit. Retrying in{" "}
                  {Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000))}s…
                </p>
              )}

              {error && (
                <p className="mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {error}
                </p>
              )}

              <button
                onClick={() => doSubmit(false)}
                disabled={busy || words === 0 || over}
                className={`mt-6 w-full ${primaryBtn}`}
              >
                {busy
                  ? "Locking in…"
                  : retryUntil != null
                    ? "Retry now"
                    : "Lock in answer"}
              </button>
            </>
          ) : (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-6 text-center">
              <p className="text-lg font-semibold text-[var(--text)]">
                Locked in ✓
              </p>
              <p className="mt-1 text-[var(--text-muted)]">
                {view.opponent?.submitted
                  ? "Scoring…"
                  : "Waiting for your opponent…"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Revealed: round result or series result */}
      {loaded && !fatal && view?.you && view.status === "revealed" && (
        <div className="space-y-4">
          <div className={`${card} text-center`}>
            <h2 className="text-3xl font-bold text-[var(--text)]">
              {view.seriesOver
                ? view.seriesWinner === "you"
                  ? `${view.you.nickname} wins the match! 🏆`
                  : `${view.opponent?.nickname ?? "Opponent"} wins the match! 🏆`
                : view.winner === "draw"
                  ? `Round ${view.roundNumber}: draw`
                  : view.winner === "you"
                    ? `You took round ${view.roundNumber}`
                    : `${view.opponent?.nickname ?? "Opponent"} took round ${view.roundNumber}`}
            </h2>
            {view.totalRounds > 1 && (
              <p className="mt-2 font-semibold text-[var(--text-muted)]">{seriesLine}</p>
            )}
            {view.topic && (
              <p className="mt-1 text-sm text-[var(--text-faint)]">{view.topic.prompt}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PlayerResult
              name={view.you.nickname}
              tag="You"
              score={view.you.score}
              answer={view.you.answer}
              grade={view.you.grade}
              highlight={view.winner === "you"}
            />
            <PlayerResult
              name={view.opponent?.nickname ?? "Opponent"}
              tag="Opponent"
              score={view.opponent?.score ?? null}
              answer={view.opponent?.answer ?? null}
              grade={view.opponent?.grade ?? null}
              highlight={view.winner === "opponent"}
            />
          </div>

          {(() => {
            const grade = view.you.grade?.modelAnswer
              ? view.you.grade
              : view.opponent?.grade ?? null;
            if (!grade?.modelAnswer) return null;
            return (
              <div className={card}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-text)]">
                    How it actually works
                  </h3>
                  {grade.simpleAnswer && (
                    <ExplainToggle mode={explainMode} onChange={setExplainMode} />
                  )}
                </div>
                <p className="text-[15px] leading-relaxed text-[var(--text-body)]">
                  {explainMode === "simple" && grade.simpleAnswer
                    ? grade.simpleAnswer
                    : grade.modelAnswer}
                </p>
              </div>
            );
          })()}

          {oppGone && (
            <p className="rounded-md bg-[var(--hover)] px-3 py-2 text-center text-sm text-[var(--text-muted)]">
              Your opponent left the match.
            </p>
          )}
          {error && (
            <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </p>
          )}

          {/* Controls: next round vs. rematch */}
          {!view.seriesOver ? (
            <NextRoundControls
              youReady={view.you.ready}
              oppReady={view.opponent?.ready ?? false}
              oppName={view.opponent?.nickname ?? "Opponent"}
              oppGone={oppGone}
              secs={readySecs}
              busy={busy}
              onReady={doReady}
              onHome={() => router.push("/")}
            />
          ) : (
            <RematchControls
              requestedBy={view.rematchRequestedBy}
              oppName={view.opponent?.nickname ?? "Opponent"}
              oppGone={oppGone}
              busy={busy}
              onRematch={rematch}
              onHome={() => router.push("/")}
            />
          )}
        </div>
      )}

      </main>

      <Footer />
    </div>
  );
}

// Segmented control to switch the model explanation between a plain-language
// "simple" version and the precise "advanced" one.
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

function PlayerLine({ label, present }: { label: string; present: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          present ? "bg-green-500" : "bg-[var(--text-faint)]"
        }`}
      />
      <span className="text-[var(--text-body)]">{label}</span>
    </div>
  );
}

function NextRoundControls({
  youReady,
  oppReady,
  oppName,
  oppGone,
  secs,
  busy,
  onReady,
  onHome,
}: {
  youReady: boolean;
  oppReady: boolean;
  oppName: string;
  oppGone: boolean;
  secs: number | null;
  busy: boolean;
  onReady: () => void;
  onHome: () => void;
}) {
  if (oppGone) {
    return (
      <div className="flex flex-col gap-3 pt-1 sm:flex-row">
        <button onClick={onHome} className={`flex-1 ${ghostBtn}`}>
          Back home
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 pt-1 sm:flex-row">
      {youReady ? (
        <div
          className={`flex-1 rounded-lg border border-[var(--border)] px-5 py-2.5 text-center text-sm font-semibold text-[var(--text-muted)]`}
        >
          {oppReady ? "Starting…" : `Waiting for ${oppName}…`}
        </div>
      ) : (
        <button onClick={onReady} disabled={busy} className={`flex-1 ${primaryBtn}`}>
          Next round{secs != null && secs > 0 ? ` (${Math.ceil(secs)}s)` : ""}
        </button>
      )}
      <button onClick={onHome} className={`flex-1 ${ghostBtn}`}>
        Back home
      </button>
    </div>
  );
}

function RematchControls({
  requestedBy,
  oppName,
  oppGone,
  busy,
  onRematch,
  onHome,
}: {
  requestedBy: "you" | "opponent" | null;
  oppName: string;
  oppGone: boolean;
  busy: boolean;
  onRematch: (a: "request" | "accept" | "decline" | "cancel") => void;
  onHome: () => void;
}) {
  if (oppGone) {
    return (
      <div className="space-y-3">
        <p className="rounded-md bg-[var(--hover)] px-3 py-2 text-center text-sm text-[var(--text-muted)]">
          Can&apos;t rematch. {oppName} left.
        </p>
        <button onClick={onHome} className={`w-full ${ghostBtn}`}>
          Back home
        </button>
      </div>
    );
  }

  if (requestedBy === "opponent") {
    return (
      <div className="space-y-3">
        <p className="text-center font-semibold text-[var(--text)]">
          {oppName} wants a rematch.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => onRematch("accept")}
            disabled={busy}
            className={`flex-1 ${primaryBtn}`}
          >
            Accept
          </button>
          <button
            onClick={() => onRematch("decline")}
            disabled={busy}
            className={`flex-1 ${ghostBtn}`}
          >
            Decline
          </button>
        </div>
      </div>
    );
  }

  if (requestedBy === "you") {
    return (
      <div className="space-y-3">
        <p className="text-center text-[var(--text-muted)]">
          Waiting for {oppName} to accept…
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => onRematch("cancel")}
            disabled={busy}
            className={`flex-1 ${ghostBtn}`}
          >
            Cancel
          </button>
          <button onClick={onHome} className={`flex-1 ${ghostBtn}`}>
            Back home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-1 sm:flex-row">
      <button
        onClick={() => onRematch("request")}
        disabled={busy}
        className={`flex-1 ${primaryBtn}`}
      >
        Rematch
      </button>
      <button onClick={onHome} className={`flex-1 ${ghostBtn}`}>
        Back home
      </button>
    </div>
  );
}

function PlayerResult({
  name,
  tag,
  score,
  answer,
  grade,
  highlight,
}: {
  name: string;
  tag: string;
  score: number | null;
  answer: string | null;
  grade: Grade | null;
  highlight: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-lg border p-6 ${
        highlight
          ? "border-[var(--accent)] bg-[var(--panel)]"
          : "border-[var(--border)] bg-[var(--panel)]"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
          {tag}
        </span>
        {highlight && (
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-text)]">
            Round win
          </span>
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        <ScoreBox score={score ?? 0} size="sm" label={tag} />
        <p className="text-[var(--text)]">{name}</p>
      </div>

      {grade?.verdict && (
        <p className="mt-3 text-center text-sm text-[var(--text-muted)]">
          {grade.verdict}
        </p>
      )}

      {(answer || (grade?.corrections?.length ?? 0) > 0) && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-4 w-full text-center text-sm text-[var(--text-faint)] underline-offset-4 hover:text-[var(--text)] hover:underline"
        >
          {open ? "Hide details" : "See what they wrote"}
        </button>
      )}

      {open && (
        <div className="mt-4 space-y-4">
          {answer !== null && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                What they wrote
              </h4>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
                {answer || "(no answer)"}
              </p>
            </div>
          )}
          {(grade?.corrections?.length ?? 0) > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                What they skipped
              </h4>
              <ul className="space-y-2">
                {grade!.corrections.map((c, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm text-[var(--text-muted)]"
                  >
                    <span aria-hidden className="mt-[2px] text-[var(--accent-text)]">
                      →
                    </span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
