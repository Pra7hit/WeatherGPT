import "server-only";

/**
 * Server-only environment access.
 *
 * Nothing in this file may be imported from a client component - importing
 * `server-only` makes that a build error rather than a silent secret leak.
 */

function optional(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

function readEffort(): Effort {
  const raw = optional("LLM_EFFORT")?.toLowerCase();
  return EFFORTS.includes(raw as Effort) ? (raw as Effort) : "low";
}

export const env = {
  /** Required for the conversational layer. Without it the app runs in a labelled fallback mode. */
  anthropicApiKey: optional("ANTHROPIC_API_KEY"),
  /** Optional. Set when routing through a proxy/gateway instead of api.anthropic.com. */
  anthropicBaseUrl: optional("ANTHROPIC_BASE_URL"),
  llmModel: optional("LLM_MODEL") ?? "claude-opus-5",
  llmEffort: readEffort(),
  /** Optional. Only enables the *official government warning* channel. */
  openWeatherApiKey: optional("OPENWEATHER_API_KEY"),
};

/** Which data providers are actually wired up right now. Surfaced by /api/health. */
export function providerStatus() {
  return {
    /** Conversational AI. */
    llm: Boolean(env.anthropicApiKey),
    llmModel: env.anthropicApiKey ? env.llmModel : null,
    /** Open-Meteo forecast - keyless, always available. */
    weather: true,
    /** Open-Meteo geocoding + BigDataCloud reverse geocoding - keyless. */
    geocoding: true,
    /** ERA5 reanalysis archive - keyless. */
    historical: true,
    /** Real GFS model output via Open-Meteo. */
    nwpGfs: true,
    /** WRF is not wired to a real source, so it is reported as unavailable. */
    nwpWrf: false,
    /** Official government warnings require an OpenWeatherMap key. */
    officialAlerts: Boolean(env.openWeatherApiKey),
  };
}
