import type Anthropic from "@anthropic-ai/sdk";

/**
 * Tool definitions handed to Claude.
 *
 * Every weather number the assistant is allowed to say has to come back through
 * one of these. Each tool accepts either a place name or explicit coordinates,
 * so a simple question ("weather in Delhi") costs one tool call instead of a
 * resolve-then-fetch round trip - `resolve_location` stays available for
 * genuinely ambiguous names and for the city picker.
 */

const PLACE_PROPS = {
  place: {
    type: "string",
    description:
      "City / place name as the user referred to it, in English (e.g. \"Delhi\", \"Jaipur, Rajasthan\"). Translate Devanagari or romanised names to their English spelling. Omit only if you are passing latitude and longitude instead.",
  },
  latitude: {
    type: "number",
    description: "Latitude in decimal degrees. Use together with longitude when you already have resolved coordinates, or when the user asked about their current location.",
  },
  longitude: {
    type: "number",
    description: "Longitude in decimal degrees.",
  },
  language: {
    type: "string",
    enum: ["en", "hi"],
    description: "Language for the labels on the visual card. Match the language of the user's latest message.",
  },
} as const;

const PART_OF_DAY = {
  type: "string",
  enum: ["morning", "afternoon", "evening", "night"],
  description:
    "Narrow the answer to part of the day. morning 06-11, afternoon 12-16, evening 17-20, night 21-05 local time.",
} as const;

function schema(properties: Record<string, unknown>, required: string[] = []) {
  return {
    type: "object" as const,
    properties: { ...PLACE_PROPS, ...properties },
    required,
  };
}

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "resolve_location",
    description:
      "Search for a place by name and get candidate matches with coordinates, region, country and timezone. Use it when a name is ambiguous, when the user asks which places match a name, or when another tool reported that it could not resolve a place. If the place cannot be found, say so - never guess coordinates.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Place name to search for, in English.",
        },
        limit: {
          type: "integer",
          description: "Maximum number of candidates to return (1-10). Default 5.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_current_weather",
    description:
      "Current observed conditions plus the next 12 hours: temperature, feels-like, humidity, wind and gusts, rain probability, precipitation, visibility, pressure, cloud cover and condition. Use this for \"right now\", \"today\", \"is it raining\", and for feels-like vs actual temperature questions.",
    input_schema: schema({}),
  },
  {
    name: "get_forecast",
    description:
      "Forecast for the coming days: daily highs/lows, rain probability, precipitation totals, wind, gusts and UV, plus an hourly breakdown. Pass `date` for a specific day (tomorrow, the weekend) and `part_of_day` for \"tomorrow evening\" style questions. Covers up to 16 days ahead; it will tell you the covered range if you ask for a date outside it.",
    input_schema: schema({
      date: {
        type: "string",
        description:
          "Target day as YYYY-MM-DD in the place's local calendar. Compute it from today's date given in the context block. Omit for a general multi-day outlook.",
      },
      part_of_day: PART_OF_DAY,
      days: {
        type: "integer",
        description: "How many days of daily outlook to return (1-16). Default 7.",
      },
    }),
  },
  {
    name: "get_weather_alerts",
    description:
      "Extreme weather check. Returns two clearly separated channels: `official` (warnings issued by a meteorological authority, only when that provider is configured) and `derived` (threshold advisories computed from the forecast - heavy rain, thunderstorm, heat stress, cold, strong wind, low visibility). Claim an official warning ONLY if official.alerts is non-empty, and name the issuing authority. Present derived items as forecast-based advisories, explicitly not official warnings.",
    input_schema: schema({}),
  },
  {
    name: "get_historical_weather",
    description:
      "Real measured/reanalysed past weather (ERA5) for a date range: mean/max/min temperature, highest and lowest, total precipitation. Data goes back to 1940 and lags real time by about 6 days; the range you ask for is clamped to what exists and the clamp is reported back. Use for \"was it hotter last year\", \"how much rain did we get in July\".",
    input_schema: schema(
      {
        start_date: { type: "string", description: "Range start, YYYY-MM-DD." },
        end_date: { type: "string", description: "Range end, YYYY-MM-DD." },
      },
      ["start_date", "end_date"],
    ),
  },
  {
    name: "get_climate_trend",
    description:
      "Year-over-year climate comparison from ERA5: per-year mean temperature, mean maximum and total precipitation, plus a least-squares warming trend in °C per year. Optionally restrict to one calendar month across years (e.g. every May). Use for \"how has the temperature changed over the last 10 years\" and \"is this year hotter than last year\". Maximum 40 years per request.",
    input_schema: schema(
      {
        start_year: { type: "integer", description: "First year, 1940 or later." },
        end_year: { type: "integer", description: "Last year." },
        month: {
          type: "integer",
          description: "Optional 1-12 to compare the same month across years.",
        },
      },
      ["start_year", "end_year"],
    ),
  },
  {
    name: "get_nwp_forecast",
    description:
      "Raw numerical weather prediction model output (temperature, precipitation, wind, pressure) with model metadata. Available models: gfs (NOAA), icon (DWD), ecmwf (IFS). wrf is NOT configured in this deployment and will return an explicit failure - report that honestly, do not substitute another model's numbers as WRF. Use only when the user asks about models specifically; for ordinary weather questions use get_forecast.",
    input_schema: schema(
      {
        model: {
          type: "string",
          enum: ["gfs", "icon", "ecmwf", "wrf"],
          description: "Model identifier.",
        },
        forecast_days: {
          type: "integer",
          description: "Days of model output to return (1-16). Default 5.",
        },
      },
      ["model"],
    ),
  },
  {
    name: "get_activity_advisory",
    description:
      "Decision-relevant aggregates for an activity question (umbrella, outdoor plans, travel): the wettest hours in the window, rain totals and probability, feels-like maximum, gusts, minimum visibility, and boolean threshold flags. Use it for \"should I carry an umbrella\", \"is it good for a run\", \"I'm travelling this weekend\". You write the recommendation; the tool only supplies the numbers.",
    input_schema: schema(
      {
        activity: {
          type: "string",
          enum: ["umbrella", "outdoor", "travel", "general"],
          description: "What the user is deciding about.",
        },
        date: {
          type: "string",
          description: "Target day as YYYY-MM-DD. Omit for the next 24 hours.",
        },
        part_of_day: PART_OF_DAY,
      },
      ["activity"],
    ),
  },
  {
    name: "get_agriculture_advisory",
    description:
      "Agronomic variables for an irrigation or field-work question: FAO-56 reference evapotranspiration (ET0), forecast rainfall, the rain-minus-ET0 water balance per day, surface (0-1 cm) soil moisture and soil temperature, plus caveats about what these variables do and do not represent. Repeat the relevant caveats in your answer and do not make crop-specific claims the data does not support.",
    input_schema: schema({}),
  },
];

export const TOOL_NAMES = TOOLS.map((tool) => tool.name);
