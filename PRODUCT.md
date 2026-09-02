# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary (confirmed 2026-09-02):** a member of the Indian public holding a mid-range Android phone,
asking about the weather in plain English or Hindi — Devanagari or romanised — to make a near-term
decision: carry an umbrella, travel this weekend, work outdoors tomorrow, water the field tonight. They
are frequently outdoors in daylight, on a cold cache, with no one narrating the interface to them. When
audiences conflict, this one wins: glanceability, contrast and thumb reach outrank expressive layout.

**Also real, but not the design's first master:**

- Farmers asking irrigation questions. The agriculture advisory runs on measured ET₀, soil moisture and
  soil temperature, so this is a genuine capability rather than a demo prop.
- Smart India Hackathon evaluators, who will drive the deployed build on their own phones rather than
  watch it on a projector.

## Product Purpose

Answer a weather question the way a competent person would: in prose, in the language it was asked in,
built from data fetched during that turn, with the source of every number visible. Success is a user
acting on the answer and being right to have trusted it — including the times the honest answer is
"reliable data could not be retrieved."

## Positioning

Not a weather dashboard with a chatbot bolted on. The conversation is the product; cards are evidence
filed underneath the prose. The mechanism a neighbouring product cannot truthfully copy is the
provenance discipline: six kinds of claim — current observation, forecast, historical (ERA5), official
warning, raw NWP output, AI advisory — are separate objects from the provider all the way to the pixel,
and the app refuses rather than estimates. An official warning is claimed only when an official provider
returned one and the authority can be named.

## Operating Context

- **Delivered as a URL.** Strangers arrive without narration, so the empty state, first-run guidance and
  failure states carry as much weight as the happy path.
- **Unknown handheld devices.** 390 px wide, touch-only, cold cache, no hover, variable network.
  Evaluators pass a phone around; citizens open it in sunlight.
- **Bilingual in one session.** A user may switch script mid-conversation. The reply follows the language
  of their last message; the selector is only a tiebreaker.
- **Voice is a convenience, not a path.** A speech transcript lands in the composer for the user to check
  before sending, because recognition mishears Indian place names. Browsers without the API lose the
  button rather than see a dead one.
- **Verification ritual:** `npm run typecheck && npm run lint && npm run build`, then `npm run smoke`
  (services against live providers) and `npm run flows` (16 conversations through `/api/chat`). The
  no-LLM fallback path gets its own pass with `ANTHROPIC_API_KEY` unset.

## Capabilities and Constraints

Confirmed functionality: streaming SSE chat with a manual tool-use loop; natural-language resolution of
location, date and part-of-day with follow-ups that inherit context; English and Hindi; Web Speech voice
input; location by mention, search or browser geolocation; official warnings versus forecast-derived
advisories as distinct objects; umbrella/outdoor/travel/agriculture advisories; ERA5 history and
year-over-year trends with a least-squares slope; real GFS/ICON/ECMWF output.

Technical constraints that future work must preserve:

- Next.js 16 App Router, TypeScript, Tailwind v4. Dark mode is a `dark` class on `<html>` set before
  paint by the inline script in `layout.tsx`.
- Services under `src/services/**` are `import "server-only"` and return
  `Result<T> = {ok:true,data} | {ok:false,reason}`; nothing throws across a service boundary. Client code
  reaches data only through `/api/*`. Keys live in `.env.local`, read only via `src/lib/env.ts`.
- Persistence is `localStorage` only. No database, no server-side transcript, no cross-device history.
- Weather providers are keyless on purpose (Open-Meteo family, ERA5 archive, Open-Meteo geocoding,
  BigDataCloud reverse geocoding). Only official warnings need `OPENWEATHER_API_KEY`, and that key also
  requires the separate "One Call by Call" subscription.
- **Fonts stay on the system stack** (confirmed 2026-09-02). No `next/font`, no fetched webfont: a
  `next build` on a machine with no network must not fail. The stack must keep Noto Sans Devanagari.
- **Dependency budget** (confirmed 2026-09-02): the user permits one pinned animation dependency, and
  also asked for system fonts and CSS motion. Read together: motion is authored in CSS unless something
  genuinely needs a library, and any addition is pinned to an exact version and reported.
- Runtime guardrails in `src/lib/guardrails.ts`: per-caller rate limits, a process-wide cap of 8
  concurrent chat streams, a 40-turn / 24 000-char request budget, control-character stripping. In-memory
  and per-process by design.
- Model output is rendered by a hand-built Markdown component that produces React nodes. Nothing reaches
  `innerHTML`.
- Any tokeniser touching Hindi must preserve `\p{M}`; stripping combining marks turns "दिल्ली" into
  "दलल". Open-Meteo timestamps are naive-local: parse as UTC components, format with `timeZone: "UTC"`.

## Brand Commitments

- Name: **WeatherGPT**. No logo asset exists; the wordmark is currently type only.
- UI chrome copy lives in `src/lib/uiText.ts` in English and Hindi. Answer text is never translated on
  the client.
- Voice: plain, calibrated, specific. It states what it knows, names where it came from, and says when it
  cannot know. Never alarmist, never padded, never apologetic about a refusal.
- The six claim kinds must remain visually distinguishable from each other, and a forecast-derived
  advisory must never be able to look like a government warning.
- A standing disclaimer sits under the composer in both languages regardless of what any answer says.

## Evidence on Hand

Real and citable: 13/13 service smoke checks and 16/16 conversation flows passing on 2026-09-01,
including ET₀ 18.4 mm and soil moisture 0.416 m³/m³ for Nashik, a +0.017 °C/yr nine-year May trend for
Delhi, live GFS output, a fictional city correctly refused, and WRF failing loudly.

Absences future work must not paper over: no direct IMD integration; no WRF; no users, testimonials,
customers, press, awards, benchmarks, pricing or uptime figures; no cross-device history. The
`public/` directory holds only unused Next.js starter SVGs — there is no photography, illustration or
brand asset to build on.

## Product Principles

1. **A number without a source is a defect.** Every figure on screen traces to a tool result fetched
   that turn, and its kind is legible without reading prose.
2. **Refusal is a feature.** "Reliable data could not be retrieved" is a correct answer and must be
   designed as carefully as a good one, never buried as an error state.
3. **The conversation leads; evidence supports.** Cards clarify the prose answer. They never become the
   product's centre of gravity.
4. **Earn trust on a cheap phone in daylight.** Contrast, tap targets and first paint are product
   features, not polish.
5. **Both languages are first-class.** Hindi is not a translation layer bolted onto an English product.

## Accessibility & Inclusion

- WCAG AA contrast is a stated constraint of the existing token system, not an aspiration: quiet label
  inks clear 4.5:1 on their surface in both themes so labels stay readable outdoors.
- Must work at 390 px, touch-only, with no hover-dependent affordance and no gesture that lacks a button.
- `prefers-reduced-motion: reduce` is honoured globally.
- Devanagari must render with combining marks intact at every size used.
- Voice input is additive; the interface is fully operable without it.
