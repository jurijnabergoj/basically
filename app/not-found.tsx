import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-5 text-center">
      <div className="text-2xl font-bold tracking-tight text-[var(--text)]">
        basically<span className="text-[var(--accent-text)]">…</span>
      </div>
      <h1 className="mt-8 text-4xl font-bold text-[var(--text)]">nothing here</h1>
      <p className="mt-3 text-[var(--text-muted)]">
        This page doesn&apos;t exist — or a share link fell apart on the way over.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-[var(--accent)] px-6 py-3 text-base font-semibold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-hover)]"
      >
        Back to the game
      </Link>
    </main>
  );
}
