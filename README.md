# WeatherGPT

Conversational AI for weather forecasting, alerts and climate information — built for the Smart India
Hackathon problem statement of the same name.

This is not a weather dashboard with a chatbot bolted on. The chat is the product: you ask in plain
English or Hindi, the assistant works out what you meant, fetches **real** data, and answers in prose,
with a compact card underneath carrying the numbers and their source.

```
"Will it rain in Delhi tomorrow?"
"Kal Jaipur mein baarish hogi?"
"Should I carry an umbrella tomorrow in Pune?"
"What about tomorrow evening?"          ← follow-up, keeps the city
"How does this August compare with the last ten Augusts in Nagpur?"
```

## The one rule everything else follows

**The assistant never invents weather data.** Every number it says comes from a tool result fetched
during that turn, and every claim is labelled with what kind of claim it is:

| Label | Means | Source |
|---|---|---|
| observation | measured/analysed current conditions | Open-Meteo `current` |
| forecast | model prediction | Open-Meteo hourly/daily |
| historical | reanalysis of the past | ERA5 via Open-Meteo archive |
| official warning | issued by a met authority, authority named | OpenWeatherMap One Call `alerts[]` (needs a key) |
| NWP | raw numerical model output | GFS / ICON / ECMWF endpoints |
| AI advisory | a suggestion computed from the above | this app, never presented as official |

Consequences you can check for yourself (all four are in the automated flow tests):

- Ask for a city that does not exist → it says the lookup failed. It does not produce a temperature.
- Ask "is there an official IMD warning?" with no `OPENWEATHER_API_KEY` → it says the official channel is
  not configured in this deployment and offers forecast-derived advisories instead, labelled as not
  official. It never claims an authority issued something. With a key whose account lacks the "One Call
  by Call" subscription (a `401` on every lookup) it says the channel could not be reached and points at
  imd.gov.in — a failed lookup is never reported as "no warning is active".
- Ask for WRF model output → it says WRF is not wired up here and offers GFS/ICON/ECMWF. There is no mock
  NWP data anywhere in the codebase.
- Tell it to ignore its instructions and give tomorrow's temperature without a tool call → it refuses
  both halves.

## Setup

Requires Node 20.9+ (Node 20.19 and 22 both tested) and npm.

```bash
cd prototype
npm install
cp .env.example .env.local     # then edit .env.local, see below
npm run dev                    # http://localhost:3000
```

### Which keys you need, and exactly where they go

Everything goes in **`.env.local`** in the project root (gitignored, never committed). `.env.example` is
the template with the same variable names.

| Variable | Required? | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes**, for the conversational layer | The Claude API key used by `/api/chat`. Without it the app still runs and still returns real weather, but through a deterministic fallback shown behind a visible "LLM not configured" notice — it cannot hold a conversation. |
| `ANTHROPIC_BASE_URL` | No | Set only if Anthropic traffic goes through a gateway/proxy instead of `api.anthropic.com`. |
| `LLM_MODEL` | No | Defaults to `claude-opus-5`. |
| `LLM_EFFORT` | No | `low` (default) … `max`. Reasoning effort per chat turn. |
| `OPENWEATHER_API_KEY` | No | **The only thing that unlocks official government warnings** (OpenWeatherMap One Call 3.0 `alerts[]`, which relays IMD warnings for India — free tier at openweathermap.org/api). The key alone is not enough: One Call 3.0 needs the separate **"One Call by Call"** subscription on the same account, or every lookup answers `401`. Leave it blank and the app says the official channel is not configured rather than inventing warnings; with a key that 401s it says the channel could not be reached — never "no warning is active". |

No key is needed for any weather data itself. These providers are keyless on purpose, so this runs on a
laptop with nothing to sign up for:

- `api.open-meteo.com/v1/forecast` — current conditions, hourly, daily, and the agronomy variables
  (FAO-56 ET₀, soil moisture, soil temperature)
- `api.open-meteo.com/v1/{gfs,dwd-icon,ecmwf}` — real NWP model output
- `archive-api.open-meteo.com/v1/archive` — ERA5 reanalysis back to 1940
- `geocoding-api.open-meteo.com/v1/search` — city search
- `api.bigdatacloud.net` — reverse geocoding for browser coordinates

Keys are read only in `src/lib/env.ts` and `src/services/**`, every one of which starts with
`import "server-only"` — so importing any of them from a client component is a build error, not a silent
leak. `/api/health` reports which providers are configured as booleans and never echoes a key.

Verified after a production build: the Anthropic key appears nowhere in `.next/static` (the client
bundle) or in the served HTML. It *is* present in Turbopack's local build cache under `.next/cache`,
which is how the bundler records the env it built with — `.next/` and `.env*` are both gitignored, so
just don't hand someone a zip of the folder with `.next` and `.env.local` inside it.

### Commands

```bash
npm run dev         # dev server
npm run build       # production build
npm start           # serve the production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (next config, React hooks rules)
npm run smoke       # call every data service directly and print the real values it returns
npm run flows       # send the 16 demo + adversarial questions through /api/chat (needs npm run dev)
npm run flows 7     # just flow 7
```

## What it does

- **Chat UI** — streaming answers over SSE, suggested questions on the empty state, conversation kept in
  `localStorage`, new-chat, retry on failure, mobile-first layout, dark/light mode.
- **Natural language** — location, date, part of day and intent come from the question. Follow-ups
  resolve against earlier turns ("What about tomorrow evening?" keeps the city).
- **Bilingual** — English and Hindi, in both Devanagari and romanised form. The reply follows the
  language of your last message; the selector is only a tiebreaker.
- **Voice input** — Web Speech API (`en-IN` / `hi-IN`). The transcript is placed in the composer for you
  to check rather than sent automatically, because speech recognition mishears place names. The mic
  button hides itself in browsers without support (Firefox) instead of pretending to listen.
- **Location** — mentioned in chat, searched in the picker, or from browser geolocation (asked for only
  on a button press).
- **Alerts** — official channel and forecast-derived advisories are separate objects all the way to the
  UI: red/amber "Official warning — <authority>" cards versus neutral advisory cards that always carry a
  "not an official warning" chip and list the numbers that tripped the threshold.
- **Advisories** — umbrella, outdoor, travel, and an agriculture/irrigation advisory built on real ET₀,
  soil moisture and soil temperature, with its agronomic caveats stated (reference-grass ET₀, 0–1 cm
  surface layer only).
- **Historical and climate** — ERA5 summaries and year-over-year trends with a least-squares slope, and
  an explicit note when the requested range is clamped to what the archive actually covers.
- **NWP** — GFS, ICON and ECMWF are real; WRF is registered as unavailable and fails loudly.

## Project structure

```
prototype/
├── .env.example              # variable names; copy to .env.local
├── CLAUDE.md                 # working notes / conventions for contributors
├── next.config.ts            # pins the Turbopack root
├── scripts/
│   ├── smoke.ts              # service-level test against live providers
│   └── flows.ts              # end-to-end test through /api/chat
└── src/
    ├── app/
    │   ├── layout.tsx        # theme bootstrap, metadata
    │   ├── page.tsx          # renders <ChatShell/>
    │   ├── globals.css       # Tailwind v4 entry, dark variant, fonts
    │   └── api/
    │       ├── chat/route.ts            # SSE streaming tool-use loop
    │       ├── geocode/route.ts         # city search
    │       ├── reverse-geocode/route.ts # coords → place name
    │       └── health/route.ts          # which providers are configured
    ├── services/                        # all server-only
    │   ├── ai/         index.ts (stream loop) tools.ts execute.ts
    │   │               systemPrompt.ts fallback.ts
    │   ├── weather/    openMeteo.ts codes.ts index.ts types.ts
    │   ├── location/   forward + reverse geocoding
    │   ├── alerts/     official.ts (key-gated) derived.ts (thresholds)
    │   ├── advisory/   index.ts (activity) agriculture.ts
    │   ├── historical/ ERA5 summaries and trends
    │   └── nwp/        model registry (GFS/ICON/ECMWF real, WRF unavailable)
    ├── components/     ChatShell Header MessageList MessageBubble Composer
    │                   WeatherCard AlertCard SuggestedQuestions Markdown
    │                   LocationSelector LanguageSelector MicButton ThemeToggle
    ├── hooks/          useChat useSpeechRecognition useGeolocation useTheme
    └── lib/            types.ts http.ts time.ts format.ts sse.ts env.ts
                        guardrails.ts prefs.ts uiText.ts
```

## How a turn works

```
browser ──POST /api/chat──►  rate limit + sanitise + history budget
                             │
                             ├─ system prompt: cached rules block + volatile
                             │  date/timezone/location block
                             ├─ streaming tool-use loop (max 6 rounds)
                             │    ├─ text deltas ─────────────► SSE {t:"text"}
                             │    └─ tool_use → services/*
                             │         result = {data, card, _meta}
                             │         card ─────────────────► SSE {t:"card"|"alert"}
                             └─ SSE {t:"done"}
```

Services return `{ ok: true, data } | { ok: false, reason }` and never throw across a boundary, so
"unavailable" reaches the model as a fact it has to tell you about rather than as an exception.

## Guardrails

Honesty rules live in the cached block of `src/services/ai/systemPrompt.ts`; the runtime ones live in
`src/lib/guardrails.ts` and are applied by the route handlers:

- Per-caller rate limits: 20 chat requests/min, 60 geocode, 30 reverse geocode → `429` with
  `Retry-After`.
- Process-wide cap of 8 concurrent chat streams → `503` when saturated, slot released in a `finally`.
- Request budget: 40 turns, 4 000 chars per turn, 24 000 chars total; older turns are dropped first.
- Control characters and lone surrogates stripped from all incoming text.
- Tool results and user text — including alert descriptions relayed from external feeds — are treated as
  data, never as instructions. The model refuses to reveal its prompt, to invent numbers, to relabel a
  forecast as an observation, or to promote an advisory to an official warning.
- Model output is rendered by a small Markdown component that builds React nodes; nothing goes through
  `innerHTML`, so a response cannot inject markup.
- A standing disclaimer sits under the composer in both languages, whatever any single answer says.

These are per-process and in-memory by design (no Redis, no database). A multi-instance deployment would
swap the store in `guardrails.ts`, not the call sites.

## Verified on 2026-09-01

- `npm run typecheck`, `npm run lint`, `npm run build` — all clean.
- `npm run smoke` — 13/13 passed against live providers: geocoding (and a fictional city correctly
  refused), reverse geocoding, current observation, tomorrow's forecast, part-of-day narrowing, the alert
  channels, umbrella advisory, agriculture (ET₀ 18.4 mm / soil moisture 0.416 m³/m³ for Nashik), ERA5
  window, a 9-year May trend for Delhi (+0.017 °C/yr), real GFS output, and WRF failing loudly.
- `npm run flows` — 16/16 conversations answered, including all eight demo questions, the four
  adversarial checks above, both Hindi scripts (`Kal Jaipur mein baarish hogi?` answered in romanised
  Hindi, `कल दिल्ली में बारिश होगी?` in Devanagari), the Hindi agriculture question, and
  geolocation-as-default.
- The same suite run against a build with **no** `ANTHROPIC_API_KEY` (`ANTHROPIC_API_KEY= npx next start
  -p 3002`): every answer carried the "LLM not configured" notice, the fictional city was refused rather
  than substituted, and the Devanagari and romanised questions were answered in the script they were
  asked in.
- Guardrails exercised with live requests: geocode returned `429` on request 61 with `Retry-After: 43`,
  reverse geocode on request 31, chat on request 21; the 9th concurrent chat slot was refused and freed
  slots were reusable.
- Official-warning channel checked in all three states with a real key present. The key on this account
  has no "One Call by Call" subscription, so every One Call 3.0 lookup answers `401`; both paths report
  that honestly. LLM path (flows 5 and 10): "the official warning feed is configured, but the lookup
  failed … so I have no visibility into whether IMD has something active for Delhi. For anything
  authoritative, check imd.gov.in" with both threshold advisories still labelled non-official. No-LLM
  path, driven directly: the same statement in English and Devanagari.
- Not automated, so check these by hand in a browser: the mic button, the geolocation permission prompt,
  the language selector, the dark/light toggle, and the layout at 390 px width.

## Known limits

- Chat history is per-browser (`localStorage`), so there is no cross-device history and no server-side
  transcript. This was a deliberate choice to keep setup to `npm install` and one env file.
- Official warnings depend on `OPENWEATHER_API_KEY` **and** on that account having the "One Call by Call"
  subscription; without either, the app is explicit that the channel is off or unreachable. There is no
  direct IMD API integration.
- Forecast-derived advisory *titles* ("High heat stress", "Thunderstorm risk") are English strings from
  `src/services/alerts/derived.ts`, so a Hindi answer from the no-LLM fallback names them in English. On
  the LLM path the model renders them in the user's language.
- WRF needs a self-hosted run or an institutional feed. Adding one means writing a fetcher in
  `src/services/nwp/index.ts`; nothing above that file changes.
- ERA5 lags roughly six days, so "yesterday" historical questions get a clamped range plus a note.
- Voice input depends on the browser's speech API; unsupported browsers simply lose the mic button.
- The no-LLM fallback is keyword matching, not language understanding. It handles "current / forecast /
  alerts" for one city in English, romanised Hindi and Devanagari, and says so behind its notice; anything
  outside that (history, NWP, irrigation, follow-ups) needs `ANTHROPIC_API_KEY`. It refuses rather than
  guesses when it cannot pin the city — a generic word like "City" on its own is not treated as a place.



