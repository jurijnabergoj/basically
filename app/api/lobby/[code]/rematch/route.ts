import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { randomTopic } from "@/lib/topics";
import { targetWins } from "@/lib/lobby";
import { loadLobbyByCode, loadPlayers } from "@/lib/lobbyServer";

export const runtime = "nodejs";

type Action = "request" | "accept" | "decline" | "cancel";

// POST /api/lobby/[code]/rematch: start a fresh series, but only by mutual
// consent: one player requests, the other accepts (or declines). Because it
// needs the opponent to accept, a rematch can't proceed if they've left.
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
  const { clientId, action } = (body ?? {}) as {
    clientId?: unknown;
    action?: unknown;
  };
  if (typeof clientId !== "string" || !clientId) {
    return NextResponse.json({ error: "Missing identity." }, { status: 400 });
  }
  if (action !== "request" && action !== "accept" && action !== "decline" && action !== "cancel") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  const act = action as Action;

  const lobby = await loadLobbyByCode(code.toUpperCase());
  if (!lobby) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  const players = await loadPlayers(lobby.id);
  if (!players.some((p) => p.client_id === clientId)) {
    return NextResponse.json({ error: "You're not in this match." }, { status: 403 });
  }

  const target = targetWins(lobby.total_rounds);
  const seriesOver =
    lobby.status === "revealed" && players.some((p) => p.rounds_won >= target);
  if (!seriesOver) {
    return NextResponse.json({ error: "The series isn't over yet." }, { status: 409 });
  }

  const db = supabaseAdmin();

  if (act === "request") {
    // Set the requester unless one is already pending from the other player.
    if (lobby.rematch_by && lobby.rematch_by !== clientId) {
      return NextResponse.json(
        { error: "Your opponent already asked. Accept instead." },
        { status: 409 },
      );
    }
    await db.from("lobbies").update({ rematch_by: clientId }).eq("id", lobby.id);
    return NextResponse.json({ ok: true });
  }

  if (act === "cancel") {
    if (lobby.rematch_by === clientId) {
      await db.from("lobbies").update({ rematch_by: null }).eq("id", lobby.id);
    }
    return NextResponse.json({ ok: true });
  }

  if (act === "decline") {
    if (lobby.rematch_by && lobby.rematch_by !== clientId) {
      await db.from("lobbies").update({ rematch_by: null }).eq("id", lobby.id);
    }
    return NextResponse.json({ ok: true });
  }

  // accept: only the OTHER player can accept a pending request.
  if (!lobby.rematch_by || lobby.rematch_by === clientId) {
    return NextResponse.json(
      { error: "No rematch to accept." },
      { status: 409 },
    );
  }

  // Reset the series and start round 1 with a fresh topic. Conditional UPDATE
  // guards against double-accepts.
  const topic = randomTopic(lobby.topic_id ?? undefined);
  const { data: started } = await db
    .from("lobbies")
    .update({
      topic_id: topic.id,
      status: "playing",
      started_at: new Date().toISOString(),
      round_number: 1,
      rematch_by: null,
    })
    .eq("id", lobby.id)
    .eq("status", "revealed")
    .eq("rematch_by", lobby.rematch_by)
    .select("id");

  if (started && started.length > 0) {
    await db
      .from("players")
      .update({
        answer: null,
        submitted_at: null,
        score: null,
        grade: null,
        ready: false,
        rounds_won: 0,
      })
      .eq("lobby_id", lobby.id);
  }

  return NextResponse.json({ ok: true });
}
