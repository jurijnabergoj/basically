import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cleanNickname, generateCode, DURATION_SECONDS } from "@/lib/lobby";

export const runtime = "nodejs";

// POST /api/lobby: create a lobby, insert the host player, return { code }.
export async function POST(req: NextRequest) {
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

  const db = supabaseAdmin();

  // Opportunistic cleanup so the free tier stays tidy: drop lobbies older than
  // a few hours (their players cascade). Best-effort — never block match
  // creation on it.
  try {
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    await db.from("lobbies").delete().lt("created_at", cutoff);
  } catch {
    /* ignore cleanup failures */
  }

  // Retry a few times on the (rare) unique-code collision.
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateCode();
    const { data: lobby, error } = await db
      .from("lobbies")
      .insert({ code, status: "waiting", duration_seconds: DURATION_SECONDS })
      .select("id, code")
      .single();

    if (error) {
      // 23505 = unique_violation on `code`; try another code.
      if (error.code === "23505") continue;
      console.error("[lobby.create] insert lobby failed:", error);
      return NextResponse.json({ error: "Couldn't create a match." }, { status: 500 });
    }

    const { error: pErr } = await db.from("players").insert({
      lobby_id: lobby.id,
      client_id: clientId,
      nickname,
      role: "host",
    });
    if (pErr) {
      console.error("[lobby.create] insert host failed:", pErr);
      return NextResponse.json({ error: "Couldn't create a match." }, { status: 500 });
    }

    return NextResponse.json({ code: lobby.code });
  }

  return NextResponse.json(
    { error: "Couldn't allocate a match code. Try again." },
    { status: 500 },
  );
}
