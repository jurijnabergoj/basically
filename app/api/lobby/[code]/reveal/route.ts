import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTopicById } from "@/lib/topics";
import { gradeExplanation } from "@/lib/grade";
import { capWords } from "@/lib/words";
import { deadlinePassed } from "@/lib/lobby";
import {
  loadLobbyByCode,
  loadPlayers,
  finalizeRoundIfComplete,
} from "@/lib/lobbyServer";

export const runtime = "nodejs";

// POST /api/lobby/[code]/reveal: finalize after the deadline. Idempotent.
// Grades any un-submitted player as an empty-answer forfeit, then reveals.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

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
  if (typeof clientId !== "string" || !clientId) {
    return NextResponse.json({ error: "Missing identity." }, { status: 400 });
  }
  // The caller may include whatever they'd typed so we grade THEIR text rather
  // than an empty forfeit when they ran out of time before locking in.
  const callerAnswer =
    typeof answer === "string" && answer.trim() ? capWords(answer) : "";

  const lobby = await loadLobbyByCode(code.toUpperCase());
  if (!lobby) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  // Already finalized; nothing to do.
  if (lobby.status === "revealed") {
    return NextResponse.json({ ok: true });
  }
  if (lobby.status !== "playing") {
    return NextResponse.json({ error: "The match hasn't started." }, { status: 409 });
  }
  if (!deadlinePassed(lobby)) {
    return NextResponse.json({ error: "Too early." }, { status: 409 });
  }

  const players = await loadPlayers(lobby.id);
  if (!players.some((p) => p.client_id === clientId)) {
    return NextResponse.json({ error: "You're not in this match." }, { status: 403 });
  }

  const topic = getTopicById(lobby.topic_id ?? "");
  if (!topic) {
    return NextResponse.json({ error: "Match topic missing." }, { status: 500 });
  }

  const db = supabaseAdmin();

  // Grade anyone who never locked in. For the caller we use whatever they'd
  // typed (so a timed-out answer still counts); the other player, if absent,
  // forfeits with an empty answer.
  for (const p of players) {
    if (p.submitted_at) continue;
    const text = p.client_id === clientId ? callerAnswer : "";

    let grade;
    try {
      grade = await gradeExplanation(topic.prompt, text);
    } catch (err) {
      console.error("[lobby.reveal] grade failed:", err);
      // Fall back to a hard zero-ish forfeit rather than blocking the reveal.
      grade = {
        score: 1,
        verdict: text ? "Couldn't score in time." : "No answer submitted.",
        corrections: [],
        modelAnswer: "",
      };
    }
    await db
      .from("players")
      .update({
        answer: text,
        submitted_at: new Date().toISOString(),
        score: grade.score,
        grade: {
          verdict: grade.verdict,
          corrections: grade.corrections,
          modelAnswer: grade.modelAnswer,
        },
      })
      .eq("id", p.id)
      .is("submitted_at", null);
  }

  // Reveal the round and award the win (idempotent, race-safe).
  const after = await loadPlayers(lobby.id);
  await finalizeRoundIfComplete(lobby, after);

  return NextResponse.json({ ok: true });
}
