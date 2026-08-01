import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// Set the theme before first paint to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;

// Absolute base for resolving Open Graph / Twitter image URLs so shared links
// unfurl correctly. Auto-detects the Vercel URL in production; override with
// NEXT_PUBLIC_SITE_URL if you use a custom domain.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const title = "basically… Do you actually know how things work?";
const description =
  "Explain a random everyday thing in 100 words. Find out how much you actually understand.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  // Kept out of search results while this is a personal project. Flip to
  // `index: true` (or delete this line) when you're ready to show it off.
  robots: { index: false, follow: false },
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: "/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={display.className}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
