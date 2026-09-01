import { providerStatus } from "@/lib/env";
import { listModels } from "@/services/nwp";

/**
 * Which providers are actually wired up. Reports booleans only - never a key,
 * a key prefix, or a key length.
 */
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const status = providerStatus();

  return Response.json({
    ok: true,
    providers: status,
    nwpModels: listModels().map((model) => ({
      id: model.id,
      name: model.name,
      producer: model.producer,
      available: model.available,
      note: model.note,
    })),
    notes: {
      llm: status.llm
        ? "Conversational layer active."
        : "ANTHROPIC_API_KEY missing - /api/chat answers from the deterministic fallback and labels every answer as such.",
      officialAlerts: status.officialAlerts
        ? "Official government warnings enabled via OpenWeatherMap One Call."
        : "OPENWEATHER_API_KEY missing - only forecast-derived advisories are available, and they are labelled as not official.",
    },
  });
}
