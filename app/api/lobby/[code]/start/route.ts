import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { randomTopic } from "@/lib/topics";
import { isRoundMode } from "@/lib/lobby";
import { loadLobbyByCode, loadPlayers } from "@/lib/lobbyServer";

export const runtime = "nodejs";

// POST /api/lobby/[code]/start: host starts the round.
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
  const { clientId, totalRounds } = (body ?? {}) as {
    clientId?: unknown;
    totalRounds?: unknown;
  };
  if (typeof clientId !== "string" || !clientId) {
    return NextResponse.json({ error: "Missing identity." }, { status: 400 });
  }
  const rounds = isRoundMode(totalRounds) ? totalRounds : 1;

  const lobby = await loadLobbyByCode(code.toUpperCase());
  if (!lobby) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  const players = await loadPlayers(lobby.id);
  const you = players.find((p) => p.client_id === clientId);
  if (!you) {
    return NextResponse.json({ error: "You're not in this match." }, { status: 403 });
  }
  if (you.role !== "host") {
    return NextResponse.json(
      { error: "Only the host can start." },
      { status: 403 },
    );
  }
  if (players.length < 2) {
    return NextResponse.json(
      { error: "Waiting for your opponent." },
      { status: 409 },
    );
  }
  if (lobby.status !== "waiting") {
    return NextResponse.json(
      { error: "This match already started." },
      { status: 409 },
    );
  }

  const topic = randomTopic();
  const { error } = await supabaseAdmin()
    .from("lobbies")
    .update({
      topic_id: topic.id,
      status: "playing",
      started_at: new Date().toISOString(),
      total_rounds: rounds,
      round_number: 1,
    })
    .eq("id", lobby.id)
    .eq("status", "waiting"); // guard against a double-start race

  if (error) {
    console.error("[lobby.start] failed:", error);
    return NextResponse.json({ error: "Couldn't start the match." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
