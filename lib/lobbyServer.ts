// Server-side data access + the reveal-gated view builder. Imported only by
// route handlers (uses the service-role client).
import { supabaseAdmin } from "@/lib/supabase";
import { getTopicById } from "@/lib/topics";
import { targetWins, type LobbyRow, type PlayerRow } from "@/lib/lobby";

export async function loadLobbyByCode(code: string): Promise<LobbyRow | null> {
  const { data } = await supabaseAdmin()
    .from("lobbies")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  return (data as LobbyRow) ?? null;
}

export async function loadPlayers(lobbyId: string): Promise<PlayerRow[]> {
  const { data } = await supabaseAdmin()
    .from("players")
    .select("*")
    .eq("lobby_id", lobbyId)
    .order("joined_at", { ascending: true });
  return (data as PlayerRow[]) ?? [];
}

// The authoritative, reveal-gated payload the client renders from. Opponent
// secrets (answer/score/grade) are only included once status === 'revealed'.
export function serializeView(
  lobby: LobbyRow,
  players: PlayerRow[],
  clientId: string,
) {
  const revealed = lobby.status === "revealed";
  const you = players.find((p) => p.client_id === clientId) ?? null;
  const opp = players.find((p) => p.client_id !== clientId) ?? null;

  const topic =
    lobby.topic_id != null ? getTopicById(lobby.topic_id) ?? null : null;

  // Winner of the round currently revealed (by this round's scores).
  let winner: "you" | "opponent" | "draw" | null = null;
  if (revealed && you?.score != null && opp?.score != null) {
    if (you.score > opp.score) winner = "you";
    else if (you.score < opp.score) winner = "opponent";
    else winner = "draw";
  }

  // Series state (best-of).
  const target = targetWins(lobby.total_rounds);
  const seriesOver =
    (you?.rounds_won ?? 0) >= target || (opp?.rounds_won ?? 0) >= target;
  let seriesWinner: "you" | "opponent" | null = null;
  if (seriesOver) {
    seriesWinner = (you?.rounds_won ?? 0) >= target ? "you" : "opponent";
  }

  const rematchRequestedBy =
    lobby.rematch_by == null
      ? null
      : lobby.rematch_by === clientId
        ? "you"
        : "opponent";

  return {
    code: lobby.code,
    status: lobby.status,
    full: players.length >= 2,
    topic: topic
      ? { id: topic.id, prompt: topic.prompt, category: topic.category }
      : null,
    startedAt: lobby.started_at ? new Date(lobby.started_at).getTime() : null,
    durationSeconds: lobby.duration_seconds,
    totalRounds: lobby.total_rounds,
    roundNumber: lobby.round_number,
    seriesOver,
    seriesWinner,
    rematchRequestedBy,
    you: you
      ? {
          nickname: you.nickname,
          role: you.role,
          submitted: you.submitted_at != null,
          ready: you.ready,
          roundsWon: you.rounds_won,
          score: you.score,
          grade: you.grade,
          answer: you.answer,
        }
      : null,
    opponent: opp
      ? {
          nickname: opp.nickname,
          submitted: opp.submitted_at != null,
          ready: opp.ready,
          roundsWon: opp.rounds_won,
          score: revealed ? opp.score : null,
          grade: revealed ? opp.grade : null,
          answer: revealed ? opp.answer : null,
        }
      : null,
    winner,
  };
}

// Flip a round to 'revealed' exactly once when both players have scored, and
// award the round win. Safe to call from multiple routes / racing clients: the
// conditional UPDATE guards so only one caller performs the transition.
export async function finalizeRoundIfComplete(
  lobby: LobbyRow,
  players: PlayerRow[],
): Promise<void> {
  if (lobby.status !== "playing") return;
  if (players.length !== 2) return;
  if (!players.every((p) => p.submitted_at != null && p.score != null)) return;

  const db = supabaseAdmin();
  const { data: flipped } = await db
    .from("lobbies")
    .update({ status: "revealed" })
    .eq("id", lobby.id)
    .eq("status", "playing")
    .select("id");

  // Another caller already revealed this round; nothing more to do.
  if (!flipped || flipped.length === 0) return;

  // We own the transition: award the round to the higher score (draw = no point).
  const [a, b] = players;
  let roundWinner: PlayerRow | null = null;
  if ((a.score ?? 0) > (b.score ?? 0)) roundWinner = a;
  else if ((b.score ?? 0) > (a.score ?? 0)) roundWinner = b;

  if (roundWinner) {
    await db
      .from("players")
      .update({ rounds_won: (roundWinner.rounds_won ?? 0) + 1 })
      .eq("id", roundWinner.id);
  }
}
