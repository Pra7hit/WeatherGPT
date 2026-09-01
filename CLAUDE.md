# WeatherGPT — working notes

Conversational weather assistant (Smart India Hackathon). The chat *is* the product; cards are
supporting evidence under a prose answer. Next.js 16 App Router + TypeScript + Tailwind v4, Anthropic
SDK, Open-Meteo providers.

## Non-negotiables

1. **No fabricated weather.** Every number in an answer must trace to a tool result fetched this turn.
   When a fetch fails the answer is "reliable data could not be retrieved" — never an estimate, never a
   seasonal guess, never mock data.
2. **Label the claim.** Current observation / forecast / historical (ERA5) / official warning / NWP
   output / AI advisory are six different things and the UI and prose must keep them apart.
3. **Official warnings only when real.** Claimed only when an official provider returned one, with the
   authority named. Threshold advisories computed from the forecast are never attributed to IMD/NDMA.
   With no `OPENWEATHER_API_KEY` the app says the official channel is not configured.
4. **Secrets stay server-side.** Keys live in `.env.local` and are read only via `src/lib/env.ts` and
   `src/services/**`, all `import "server-only"`. Client code reaches data through `/api/*` only.
   `/api/health` reports booleans, never a key or its length.
5. **No mock NWP.** GFS/ICON/ECMWF are real endpoints; WRF is registered as unavailable and returns an
   explicit failure.

## Layout

- `src/services/{weather,location,alerts,advisory,historical,nwp,ai}` — all server-only. Services return
  `Result<T> = {ok:true,data} | {ok:false,reason}`; nothing throws across a service boundary.
- `src/services/ai/` — `tools.ts` (tool schemas), `execute.ts` (dispatch → compact payload + provenance),
  `systemPrompt.ts` (cached stable block + volatile context block), `index.ts` (streaming manual tool-use
  loop), `fallback.ts` (deterministic no-LLM path behind a visible notice).
- `src/app/api/{chat,geocode,reverse-geocode,health}` — Node runtime. `/api/chat` streams SSE frames
  (`StreamFrame` in `src/lib/types.ts`).
- `src/components`, `src/hooks` — client layer. `useChat` owns the transcript and localStorage.
- `src/lib/guardrails.ts` — rate limits, concurrency cap, request-size caps, text sanitisation.

## Conventions

- Tailwind v4, dark mode via the `dark` class (set pre-paint by the script in `layout.tsx`).
- Open-Meteo timestamps are naive-local: parse as UTC components, format with `timeZone: "UTC"`.
- The Open-Meteo geocoder only matches a name written in the script of the requested `language`, so
  `geocode()` sends `language=hi` for Devanagari queries and `en` otherwise. Any tokeniser that touches
  Hindi text must keep `\p{M}` — stripping matras turns "दिल्ली" into "दलल".
- UI chrome copy lives in `src/lib/uiText.ts` (EN/HI). Answer text is never translated on the client.
- Persistence is `localStorage` only — no Prisma, no Postgres.

## Checks before calling anything done

```bash
npm run typecheck && npm run lint && npm run build
npm run smoke          # hits each service directly and prints real values
npm run flows          # 16 conversations through /api/chat (needs a dev server)
```

The no-LLM path deserves its own pass, because it is the one place where a bad answer cannot be blamed
on the model: run `ANTHROPIC_API_KEY= npx next start -p 3002` after a build and send flows 9 and 16 at it
with `WG_BASE=http://localhost:3002`. Flow 9 must refuse the fictional city; flow 16 must answer in
Devanagari with real Delhi numbers.
