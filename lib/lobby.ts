// Shared server-side helpers + types for the duel (multiplayer) mode.

export const DURATION_SECONDS = 60;
// Grace window past the deadline before the server rejects a submit, absorbing
// clock skew and network latency between the two clients.
export const GRACE_SECONDS = 3;

// Best-of match modes the host may pick. A series is won by the first player to
// reach `targetWins(total)` round wins; draws add rounds until someone clinches.
export const ALLOWED_ROUNDS = [1, 3, 5] as const;
export type RoundMode = (typeof ALLOWED_ROUNDS)[number];

export function isRoundMode(n: unknown): n is RoundMode {
  return typeof n === "number" && (ALLOWED_ROUNDS as readonly number[]).includes(n);
}

export function targetWins(totalRounds: number): number {
  return Math.floor(totalRounds / 2) + 1; // Bo1→1, Bo3→2, Bo5→3
}

// Seconds a revealed round stays up before a present client auto-readies itself,
// so an AFK/slow player can't stall the series indefinitely. Kept long so both
// players have time to read the model answer before the next round starts.
export const READY_TIMEOUT_SECONDS = 120;

// After the deadline, a player who has locked in may force a reveal that
// forfeits a missing opponent. How long they wait first depends on whether that
// opponent still looks connected: a connected opponent is probably just mid-grade
// (free-tier latency can run many seconds), so we wait out the grader before
// forfeiting them; a disconnected one is finalized almost immediately. This is
// what keeps a genuine last-second submission from being clobbered by an
// empty-answer forfeit while its grade is still in flight.
export const FORFEIT_WAIT_PRESENT_SECONDS = 30;
export const FORFEIT_WAIT_ABSENT_SECONDS = 1;

export const CODE_LENGTH = 5;
// No ambiguous characters (no O/0, I/1, L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

// Row shapes as stored in Supabase.
export type LobbyStatus = "waiting" | "playing" | "revealed";

export type LobbyRow = {
  id: string;
  code: string;
  status: LobbyStatus;
  topic_id: string | null;
  started_at: string | null;
  duration_seconds: number;
  total_rounds: number; // 1 | 3 | 5
  round_number: number; // 1-based, current round in the series
  rematch_by: string | null; // client_id that requested a fresh series, or null
  created_at: string;
};

export type PlayerRow = {
  id: string;
  lobby_id: string;
  client_id: string;
  nickname: string;
  role: "host" | "guest";
  answer: string | null;
  submitted_at: string | null;
  score: number | null;
  grade: {
    verdict: string;
    corrections: string[];
    modelAnswer: string;
    simpleAnswer?: string;
  } | null;
  rounds_won: number; // wins accumulated across the series
  ready: boolean; // readied up for the next round
  joined_at: string;
};

// True once the match deadline (+ grace) has passed.
export function deadlinePassed(lobby: LobbyRow): boolean {
  if (!lobby.started_at) return false;
  const startedMs = new Date(lobby.started_at).getTime();
  const deadline =
    startedMs + (lobby.duration_seconds + GRACE_SECONDS) * 1000;
  return Date.now() > deadline;
}

// Normalize a nickname from client input.
export function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 24);
  return trimmed.length > 0 ? trimmed : null;
}
