import { NextRequest, NextResponse } from "next/server";
import { loadLobbyByCode, loadPlayers, serializeView } from "@/lib/lobbyServer";

export const runtime = "nodejs";

// GET /api/lobby/[code]?clientId=... : authoritative, reveal-gated read.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const clientId = req.nextUrl.searchParams.get("clientId") ?? "";

  const lobby = await loadLobbyByCode(code.toUpperCase());
  if (!lobby) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  const players = await loadPlayers(lobby.id);
  return NextResponse.json(serializeView(lobby, players, clientId), {
    headers: { "Cache-Control": "no-store" },
  });
}
