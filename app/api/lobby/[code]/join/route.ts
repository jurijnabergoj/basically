import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cleanNickname } from "@/lib/lobby";
import { loadLobbyByCode, loadPlayers } from "@/lib/lobbyServer";

export const runtime = "nodejs";

// POST /api/lobby/[code]/join: join an existing lobby as the guest.
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
  const nickname = cleanNickname((body as { nickname?: unknown })?.nickname);
  if (typeof clientId !== "string" || !clientId) {
    return NextResponse.json({ error: "Missing identity." }, { status: 400 });
  }
  if (!nickname) {
    return NextResponse.json({ error: "Pick a nickname first." }, { status: 400 });
  }

  const lobby = await loadLobbyByCode(code.toUpperCase());
  if (!lobby) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  const players = await loadPlayers(lobby.id);

  // Idempotent re-entry: already a member.
  if (players.some((p) => p.client_id === clientId)) {
    return NextResponse.json({ ok: true });
  }

  if (players.length >= 2) {
    return NextResponse.json({ error: "Lobby is full." }, { status: 409 });
  }
  if (lobby.status !== "waiting") {
    return NextResponse.json(
      { error: "This match already started." },
      { status: 409 },
    );
  }

  const { error } = await supabaseAdmin().from("players").insert({
    lobby_id: lobby.id,
    client_id: clientId,
    nickname,
    role: "guest",
  });
  if (error) {
    // A racing join may have filled the lobby.
    if (error.code === "23505") {
      return NextResponse.json({ error: "Lobby is full." }, { status: 409 });
    }
    console.error("[lobby.join] failed:", error);
    return NextResponse.json({ error: "Couldn't join." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
