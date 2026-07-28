// Server-side grading via the Google Gemini REST API (free tier).
// The API key never reaches the client — this module is only imported by the
// /api/grade route handler.

export type GradeResult = {
  score: number;
  verdict: string;
  corrections: string[];
  modelAnswer: string;
};

const GEMINI_MODEL = "gemini-3.6-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = `You are a rigorous but fair science and engineering explainer. You grade how well a layperson explained an everyday concept they think they understand.

Reward correct mechanism and cause-and-effect. Penalize vagueness, hand-waving, merely restating the question, and wrong causation. Fluent, confident writing that lacks real mechanism should score low. Base the score ONLY on the accuracy and completeness of the underlying mechanism — not on writing polish, grammar, or length.`;

function buildUserPrompt(topicPrompt: string, explanation: string): string {
  return `TOPIC: ${topicPrompt}

USER'S EXPLANATION:
"""
${explanation}
"""

Grade the explanation on a 1-100 scale for ACCURACY and COMPLETENESS of the underlying mechanism.
- If the explanation is empty, nonsense, off-topic, or an obvious non-answer, score it very low (1-15).
- "verdict": one short line (about 8-14 words) summarizing how they did.
- "corrections": 2-4 short, specific items — key points they missed or got wrong, tied to what they actually wrote.
- "modelAnswer": a correct, satisfying explanation of about 60-90 words that a curious adult would find genuinely illuminating.
Respond ONLY with the JSON object.`;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER" },
    verdict: { type: "STRING" },
    corrections: { type: "ARRAY", items: { type: "STRING" } },
    modelAnswer: { type: "STRING" },
  },
  required: ["score", "verdict", "corrections", "modelAnswer"],
  propertyOrdering: ["score", "verdict", "corrections", "modelAnswer"],
};

export async function gradeExplanation(
  topicPrompt: string,
  explanation: string,
): Promise<GradeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [
        { role: "user", parts: [{ text: buildUserPrompt(topicPrompt, explanation) }] },
      ],
      generationConfig: {
        temperature: 0.2,
        // Generous headroom: Gemini 3 may spend some output budget on internal
        // "thinking" before the JSON, so keep this well above the answer size.
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
    // Fail fast rather than hang the request if Gemini is slow/unreachable.
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned no content");
  }

  const parsed = JSON.parse(text);

  let score = Math.round(Number(parsed.score));
  if (!Number.isFinite(score)) score = 1;
  score = Math.max(1, Math.min(100, score));

  const corrections = Array.isArray(parsed.corrections)
    ? parsed.corrections.map((c: unknown) => String(c)).filter(Boolean).slice(0, 5)
    : [];

  return {
    score,
    verdict: String(parsed.verdict ?? "").trim(),
    corrections,
    modelAnswer: String(parsed.modelAnswer ?? "").trim(),
  };
}
