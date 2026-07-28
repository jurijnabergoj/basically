import { NextRequest, NextResponse } from "next/server";
import { getTopicById } from "@/lib/topics";
import { gradeExplanation } from "@/lib/grade";
import { rateLimit } from "@/lib/rateLimit";
import { countWords, WORD_LIMIT } from "@/lib/words";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You're going a bit fast — give it a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 30) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { topicId, explanation } = (body ?? {}) as {
    topicId?: unknown;
    explanation?: unknown;
  };

  if (typeof topicId !== "string" || typeof explanation !== "string") {
    return NextResponse.json(
      { error: "Missing topic or explanation." },
      { status: 400 },
    );
  }

  // Never trust a client-sent prompt — look the topic up by id.
  const topic = getTopicById(topicId);
  if (!topic) {
    return NextResponse.json({ error: "Unknown topic." }, { status: 400 });
  }

  const words = countWords(explanation);
  if (words === 0) {
    return NextResponse.json(
      { error: "Write an explanation first." },
      { status: 400 },
    );
  }
  if (words > WORD_LIMIT) {
    return NextResponse.json(
      { error: `Your explanation is ${words} words; the limit is ${WORD_LIMIT}.` },
      { status: 400 },
    );
  }

  try {
    const result = await gradeExplanation(topic.prompt, explanation);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[grade] failed:", err);
    return NextResponse.json(
      { error: "Grading failed. Please try again in a moment." },
      { status: 502 },
    );
  }
}
