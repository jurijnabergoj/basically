import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTopicById } from "@/lib/topics";
import { gradeExplanation, GeminiError } from "@/lib/grade";
import { countWords, WORD_LIMIT } from "@/lib/words";
import { deadlinePassed } from "@/lib/lobby";
import {
  loadLobbyByCode,
  loadPlayers,
  finalizeRoundIfComplete,
} from "@/lib/lobbyServer";

export const runtime = "nodejs";

// POST /api/lobby/[code]/submit: lock in an answer, grade it, reveal if both done.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  // No IP rate limit here: submitting is naturally bounded (one grade per player
  // per round, idempotent afterwards), and on localhost both players share an IP.

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { clientId, answer } = (body ?? {}) as {
    clientId?: unknown;
    answer?: unknown;
  };
  if (typeof clientId !== "string" || !clientId || typeof answer !== "string") {
    return NextResponse.json({ error: "Missing answer." }, { status: 400 });
  }

  const lobby = await loadLobbyByCode(code.toUpperCase());
  if (!lobby) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  const players = await loadPlayers(lobby.id);
  const you = players.find((p) => p.client_id === clientId);
  if (!you) {
    return NextResponse.json({ error: "You're not in this match." }, { status: 403 });
  }

  if (lobby.status === "revealed") {
    return NextResponse.json({ error: "The match is over." }, { status: 409 });
  }
  if (lobby.status !== "playing") {
    return NextResponse.json({ error: "The match hasn't started." }, { status: 409 });
  }

  // Idempotent: already submitted → don't double-grade.
  if (you.submitted_at) {
    return NextResponse.json({ ok: true });
  }

  if (deadlinePassed(lobby)) {
    return NextResponse.json({ error: "Time's up." }, { status: 409 });
  }

  const words = countWords(answer);
  if (words > WORD_LIMIT) {
    return NextResponse.json(
      { error: `Your explanation is ${words} words; the limit is ${WORD_LIMIT}.` },
      { status: 400 },
    );
  }

  const topic = getTopicById(lobby.topic_id ?? "");
  if (!topic) {
    return NextResponse.json({ error: "Match topic missing." }, { status: 500 });
  }

  let grade;
  try {
    grade = await gradeExplanation(topic.prompt, answer);
  } catch (err) {
    if (err instanceof GeminiError && err.status === 429) {
      const retryAfter = err.retryAfterSeconds ?? 30;
      return NextResponse.json(
        {
          error: "The grader hit its free-tier limit.",
          retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    console.error("[lobby.submit] grading failed:", err);
    return NextResponse.json(
      { error: "Grading failed. Please try again in a moment." },
      { status: 502 },
    );
  }

  const db = supabaseAdmin();
  const { error: upErr } = await db
    .from("players")
    .update({
      answer,
      submitted_at: new Date().toISOString(),
      score: grade.score,
      grade: {
        verdict: grade.verdict,
        corrections: grade.corrections,
        modelAnswer: grade.modelAnswer,
      },
    })
    .eq("id", you.id)
    .is("submitted_at", null); // guard against a double-submit race
  if (upErr) {
    console.error("[lobby.submit] store failed:", upErr);
    return NextResponse.json({ error: "Couldn't save your answer." }, { status: 500 });
  }

  // If both players have now submitted, reveal the round and award the win.
  const after = await loadPlayers(lobby.id);
  await finalizeRoundIfComplete(lobby, after);

  return NextResponse.json({ ok: true });
}
