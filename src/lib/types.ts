/**
 * Types shared between the server (API routes, services) and the browser
 * (components, hooks). Nothing here may import server-only modules.
 */

/**
 * What *kind* of claim a piece of data supports. The AI is required to label its
 * statements with the matching kind, so a forecast is never presented as an
 * observation and a threshold-derived advisory is never presented as an
 * official warning.
 */
export type DataKind =
  | "observation"
  | "forecast"
  | "historical"
  | "official_warning"
  | "derived_advisory"
  | "nwp"
  | "location";

export interface Provenance {
  dataKind: DataKind;
  /** Human-readable attribution, e.g. "Open-Meteo forecast API". */
  source: string;
  /** ISO timestamp of when we fetched it. */
  retrievedAt: string;
  /** False would mean sample/mock values. Nothing in this app ships mock data. */
  isReal: boolean;
  /** NWP model identifier, when relevant (e.g. "GFS 0.11deg (gfs_seamless)"). */
  model?: string;
  note?: string;
}

export interface WeatherMetric {
  label: string;
  value: string;
  hint?: string;
}

export interface HourlyPoint {
  time: string;
  label: string;
  tempC: number | null;
  precipProbability: number | null;
  conditionCode: number | null;
}

export interface DailyPoint {
  date: string;
  label: string;
  maxC: number | null;
  minC: number | null;
  precipProbability: number | null;
  precipMm: number | null;
  conditionCode: number | null;
}

export type WeatherCardKind =
  | "current"
  | "forecast"
  | "historical"
  | "nwp"
  | "agriculture";

export interface WeatherCardData {
  id: string;
  kind: WeatherCardKind;
  place: string;
  /** Primary line, e.g. "31°C · Partly cloudy". */
  headline: string;
  subline?: string;
  conditionCode?: number | null;
  metrics: WeatherMetric[];
  hourly?: HourlyPoint[];
  daily?: DailyPoint[];
  provenance: Provenance;
}

export type AlertSeverity = "extreme" | "severe" | "moderate" | "minor" | "info";

export interface AlertCardData {
  id: string;
  /** True only for warnings issued by a meteorological authority. */
  official: boolean;
  severity: AlertSeverity;
  event: string;
  place: string;
  /** Issuing authority. Present only when `official` is true. */
  authority?: string;
  starts?: string;
  ends?: string;
  description: string;
  /** For derived advisories: the actual numbers that tripped the threshold. */
  evidence?: string[];
  provenance: Provenance;
}

export type Language = "auto" | "en" | "hi";

export interface ClientLocation {
  latitude: number;
  longitude: number;
  name?: string;
  source: "geolocation" | "search" | "manual";
}

/** Frames sent from /api/chat over the SSE-style newline-delimited JSON stream. */
export type StreamFrame =
  | { t: "text"; d: string }
  | { t: "tool"; name: string; label: string }
  | { t: "card"; card: WeatherCardData }
  | { t: "alert"; alert: AlertCardData }
  | { t: "notice"; message: string }
  | { t: "error"; message: string }
  | { t: "done" };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards?: WeatherCardData[];
  alerts?: AlertCardData[];
  /** Labels of the data lookups performed for this answer. */
  toolTrace?: string[];
  status?: "streaming" | "done" | "error";
  /** Set when the answer came from the no-LLM fallback path. */
  notice?: string;
  error?: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatRequestBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  language: Language;
  timezone?: string;
  location?: ClientLocation | null;
}
