/**
 * WMO 4677 weather interpretation codes as used by Open-Meteo.
 *
 * This is the single place condition text is produced - services return codes,
 * never prose, so English and Hindi labels can never drift apart.
 */

export interface ConditionLabel {
  en: string;
  hi: string;
  icon: string;
  /** True for codes that involve active precipitation. */
  wet: boolean;
  /** True for thunderstorm codes. */
  storm: boolean;
}

const CONDITIONS: Record<number, ConditionLabel> = {
  0: { en: "Clear sky", hi: "साफ़ आसमान", icon: "sun", wet: false, storm: false },
  1: { en: "Mainly clear", hi: "मुख्यतः साफ़", icon: "sun", wet: false, storm: false },
  2: { en: "Partly cloudy", hi: "आंशिक बादल", icon: "cloud-sun", wet: false, storm: false },
  3: { en: "Overcast", hi: "घने बादल", icon: "cloud", wet: false, storm: false },
  45: { en: "Fog", hi: "कोहरा", icon: "fog", wet: false, storm: false },
  48: { en: "Depositing rime fog", hi: "पाला जमाने वाला कोहरा", icon: "fog", wet: false, storm: false },
  51: { en: "Light drizzle", hi: "हल्की फुहार", icon: "drizzle", wet: true, storm: false },
  53: { en: "Moderate drizzle", hi: "मध्यम फुहार", icon: "drizzle", wet: true, storm: false },
  55: { en: "Dense drizzle", hi: "घनी फुहार", icon: "drizzle", wet: true, storm: false },
  56: { en: "Light freezing drizzle", hi: "हल्की जमने वाली फुहार", icon: "drizzle", wet: true, storm: false },
  57: { en: "Dense freezing drizzle", hi: "घनी जमने वाली फुहार", icon: "drizzle", wet: true, storm: false },
  61: { en: "Slight rain", hi: "हल्की बारिश", icon: "rain", wet: true, storm: false },
  63: { en: "Moderate rain", hi: "मध्यम बारिश", icon: "rain", wet: true, storm: false },
  65: { en: "Heavy rain", hi: "तेज़ बारिश", icon: "rain", wet: true, storm: false },
  66: { en: "Light freezing rain", hi: "हल्की जमने वाली बारिश", icon: "rain", wet: true, storm: false },
  67: { en: "Heavy freezing rain", hi: "तेज़ जमने वाली बारिश", icon: "rain", wet: true, storm: false },
  71: { en: "Slight snowfall", hi: "हल्की बर्फ़बारी", icon: "snow", wet: true, storm: false },
  73: { en: "Moderate snowfall", hi: "मध्यम बर्फ़बारी", icon: "snow", wet: true, storm: false },
  75: { en: "Heavy snowfall", hi: "भारी बर्फ़बारी", icon: "snow", wet: true, storm: false },
  77: { en: "Snow grains", hi: "बर्फ़ के कण", icon: "snow", wet: true, storm: false },
  80: { en: "Slight rain showers", hi: "हल्की बौछारें", icon: "showers", wet: true, storm: false },
  81: { en: "Moderate rain showers", hi: "मध्यम बौछारें", icon: "showers", wet: true, storm: false },
  82: { en: "Violent rain showers", hi: "तेज़ बौछारें", icon: "showers", wet: true, storm: false },
  85: { en: "Slight snow showers", hi: "हल्की बर्फ़ की बौछारें", icon: "snow", wet: true, storm: false },
  86: { en: "Heavy snow showers", hi: "भारी बर्फ़ की बौछारें", icon: "snow", wet: true, storm: false },
  95: { en: "Thunderstorm", hi: "गरज के साथ तूफ़ान", icon: "thunder", wet: true, storm: true },
  96: { en: "Thunderstorm with slight hail", hi: "गरज के साथ हल्के ओले", icon: "thunder", wet: true, storm: true },
  99: { en: "Thunderstorm with heavy hail", hi: "गरज के साथ भारी ओले", icon: "thunder", wet: true, storm: true },
};

const UNKNOWN: ConditionLabel = {
  en: "Unknown condition",
  hi: "अज्ञात स्थिति",
  icon: "cloud",
  wet: false,
  storm: false,
};

export function condition(code: number | null | undefined): ConditionLabel {
  if (code === null || code === undefined) return UNKNOWN;
  return CONDITIONS[code] ?? UNKNOWN;
}

export function conditionText(
  code: number | null | undefined,
  language: "en" | "hi" = "en",
): string {
  const label = condition(code);
  return language === "hi" ? label.hi : label.en;
}

/** Bilingual label, for tool results the model reads in either language. */
export function conditionForModel(code: number | null | undefined): string {
  const label = condition(code);
  return `${label.en} / ${label.hi} (WMO code ${code ?? "n/a"})`;
}
