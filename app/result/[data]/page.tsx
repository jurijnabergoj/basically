import type { Metadata } from "next";
import Link from "next/link";
import { decodeShare } from "@/lib/share";
import { ScoreBox } from "@/components/ScoreBox";
import { ThemeToggle } from "@/components/ThemeToggle";

type Props = { params: Promise<{ data: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await params;
  const share = decodeShare(data);
  if (!share) {
    return { title: "basically…" };
  }
  const title = `I scored ${share.score}/100 explaining “${share.topic}”`;
  const description = "Think you can do better? Explain it in 100 words.";
  const ogUrl = `/og?d=${encodeURIComponent(data)}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}

const card =
  "rounded-lg border border-[var(--border)] bg-[var(--panel)] p-8";
const primaryBtn =
  "rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-hover)]";

export default async function ResultPage({ params }: Props) {
  const { data } = await params;
  const share = decodeShare(data);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-10 sm:py-14">
      <header className="mb-10 flex items-center justify-between">
        <Link
          href="/"
          className="text-2xl font-bold tracking-tight text-[var(--text)]"
        >
          basically<span className="text-[var(--accent-text)]">…</span>
        </Link>
        <ThemeToggle />
      </header>

      {!share ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="mb-3 text-2xl font-bold text-[var(--text)]">
            This link&apos;s broken
          </h1>
          <p className="mb-6 text-[var(--text-muted)]">
            Couldn&apos;t read a score out of it.
          </p>
          <Link href="/" className={primaryBtn}>
            Play anyway
          </Link>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center">
          <div className={`${card} text-center`}>
            <p className="mb-1 text-sm text-[var(--text-faint)]">Someone scored</p>
            <h1 className="mb-6 text-xl font-semibold text-[var(--text)] sm:text-2xl">
              “{share.topic}”
            </h1>

            <div className="flex flex-col items-center gap-4">
              <ScoreBox score={share.score} />
              {share.verdict && (
                <p className="max-w-md text-[var(--text-muted)]">{share.verdict}</p>
              )}
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="mb-4 text-[var(--text-muted)]">Think you can do better?</p>
            <Link href="/" className={primaryBtn}>
              Give it a shot
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
