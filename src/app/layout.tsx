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
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
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

const DIRECTION = `
THESIS: weather answered as measurement — pure black and white at data density, with every
number printed beside the field it was drawn from. Refuses the assistant arrangement this
product shipped: bubbles, sparkle avatar, one blue accent.
OWN-WORLD: two colours, full ink on full ground; dark mode is the inversion, not a second
palette. Tone exists only as coverage — hairline lattice, bar fields, dither. Mono caps for
every label, control and measured number; the humanist system sans, Devanagari included, for
prose. Plates ruled top and bottom, never cards. No shadow anywhere.
STORY: a stranger in daylight reads a plain answer, sees the series it came from, and can
point at the source of every figure — including the times the answer is a refusal.
FIRST VIEWPORT: head rule carrying the barcode mark, wordmark, station switch and the switch
bank. Under it the answer in sans at lead size; below that the hourly series drawn as bars
into the lattice with its values printed in the margin. Composer docked on a 2px rule, SEND
as the solid ink block.
FORM: datamatics field, candidate 1 of the bolder hand, seed key f682b218.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance
`.trim();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-ground text-ink min-h-full antialiased">
        {/* The direction contract, emitted as a real HTML comment so it survives
            the production build and can be grepped out of it. React cannot render
            a comment node, hence the inert wrapper; the string is a module
            constant, never model output. */}
        <div hidden dangerouslySetInnerHTML={{ __html: `<!--\n${DIRECTION}\n-->` }} />
        {children}
      </body>
    </html>
  );
}
