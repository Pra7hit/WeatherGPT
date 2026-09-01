import type { Metadata, Viewport } from "next";

import "./globals.css";

/**
 * Root layout.
 *
 * Fonts come from the system stack declared in globals.css rather than
 * next/font, so a `next build` on a machine without network access (a judge's
 * laptop, an offline demo) does not fail fetching a webfont. The stack includes
 * Noto Sans Devanagari so Hindi answers render properly.
 */

export const metadata: Metadata = {
  title: "WeatherGPT — Conversational weather, alerts & climate",
  description:
    "Ask about the weather in plain English or Hindi. Every answer is built from real forecast data, with the source shown.",
  applicationName: "WeatherGPT",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1117" },
  ],
};

/**
 * Applied before first paint so a dark-mode reload does not flash white.
 * Kept inline and tiny for that reason; it is the only inline script in the app.
 */
const THEME_SCRIPT = `
try {
  var stored = localStorage.getItem('weathergpt.theme');
  var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
`.trim();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-canvas text-ink min-h-full antialiased">{children}</body>
    </html>
  );
}
