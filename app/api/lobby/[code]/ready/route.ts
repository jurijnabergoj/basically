import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { randomTopic } from "@/lib/topics";
import { targetWins } from "@/lib/lobby";
import { loadLobbyByCode, loadPlayers } from "@/lib/lobbyServer";

export const runtime = "nodejs";

// POST /api/lobby/[code]/ready: ready up for the next round of a series.
// When both players are ready, the round advances (fresh topic, reset answers).
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
  const { clientId } = (body ?? {}) as { clientId?: unknown };
  if (typeof clientId !== "string" || !clientId) {
    return NextResponse.json({ error: "Missing identity." }, { status: 400 });
  }

  const lobby = await loadLobbyByCode(code.toUpperCase());
  if (!lobby) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }
  if (lobby.status !== "revealed") {
    return NextResponse.json({ error: "No round to advance." }, { status: 409 });
  }

  const players = await loadPlayers(lobby.id);
  const you = players.find((p) => p.client_id === clientId);
  if (!you) {
    return NextResponse.json({ error: "You're not in this match." }, { status: 403 });
  }

  const target = targetWins(lobby.total_rounds);
  if (players.some((p) => p.rounds_won >= target)) {
    return NextResponse.json({ error: "The series is over." }, { status: 409 });
  }

  const db = supabaseAdmin();

  // Mark this player ready (idempotent).
  if (!you.ready) {
    await db.from("players").update({ ready: true }).eq("id", you.id);
  }

  // If both are now ready, advance to the next round. The conditional UPDATE on
  // (status, round_number) ensures only one caller performs the advance.
  const after = await loadPlayers(lobby.id);
  if (after.length === 2 && after.every((p) => p.ready)) {
    const topic = randomTopic(lobby.topic_id ?? undefined);
    const { data: advanced } = await db
      .from("lobbies")
      .update({
        topic_id: topic.id,
        status: "playing",
        started_at: new Date().toISOString(),
        round_number: lobby.round_number + 1,
      })
      .eq("id", lobby.id)
      .eq("status", "revealed")
      .eq("round_number", lobby.round_number)
      .select("id");

    if (advanced && advanced.length > 0) {
      await db
        .from("players")
        .update({
          answer: null,
          submitted_at: null,
          score: null,
          grade: null,
          ready: false,
        })
        .eq("lobby_id", lobby.id);
    }
  }

  return NextResponse.json({ ok: true });
}
