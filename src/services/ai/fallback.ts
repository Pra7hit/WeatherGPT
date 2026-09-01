import "server-only";

import { fmtMm, fmtPct, fmtTemp, fmtWind } from "@/lib/format";
import { addDays, dayLabel, isoDateInZone, isValidTimeZone } from "@/lib/time";
import type { ChatRequestBody, StreamFrame } from "@/lib/types";
import { getAlerts } from "@/services/alerts";
import { geocode, reverseGeocode } from "@/services/location";
import { conditionText, getCurrentWeather, getForecast } from "@/services/weather";
import type { Place } from "@/services/weather/types";

/**
 * No-LLM fallback path.
 *
 * If ANTHROPIC_API_KEY is missing the app still has to be honest and useful, so
 * this answers a narrow set of questions deterministically from the same real
 * providers, behind a visible notice. It is a safety net, not the product: it
 * does keyword matching, not language understanding.
 */

const DEFAULT_TIMEZONE = "Asia/Kolkata";
const DEVANAGARI = /[ऀ-ॿ]/;

const NOTICE = {
  en: "LLM not configured — this is a deterministic summary built from real data, not a conversational answer. Add ANTHROPIC_API_KEY to .env.local for the full assistant.",
  hi: "LLM कॉन्फ़िगर नहीं है — यह वास्तविक डेटा से बना नियम-आधारित सारांश है, संवादात्मक उत्तर नहीं। पूरे सहायक के लिए .env.local में ANTHROPIC_API_KEY जोड़ें।",
  roman:
    "LLM configure nahi hai — yeh asli data se bana rule-based summary hai, baat-cheet wala jawab nahi. Poore assistant ke liye .env.local mein ANTHROPIC_API_KEY joden.",
};

const STOPWORDS = new Set([
  "what", "whats", "what's", "is", "the", "weather", "in", "at", "for", "on", "of", "to",
  "will", "it", "rain", "raining", "today", "tomorrow", "tonight", "now", "right", "how",
  "about", "should", "i", "carry", "an", "umbrella", "there", "any", "severe", "alert",
  "alerts", "warning", "warnings", "forecast", "like", "feel", "feels", "hotter", "colder",
  "temperature", "and", "me", "my", "we", "this", "weekend", "evening", "morning",
  "afternoon", "night", "day", "after", "next", "week", "please", "hai", "hoga", "hogi",
  "ho", "kya", "kal", "aaj", "mein", "me", "ka", "ki", "ke", "par", "baarish", "barish",
  "mausam", "garmi", "thand", "hawa", "kaisa", "kaisi", "batao", "bata", "do",
  // Devanagari. Without these a Hindi question keeps five content tokens, the
  // n-gram budget is spent on nonsense pairs, and the city is never reached.
  "मौसम", "कैसा", "कैसी", "कैसे", "है", "हैं", "होगा", "होगी", "क्या", "कल", "आज", "परसों",
  "अभी", "में", "मे", "का", "की", "के", "को", "पर", "और", "या", "बारिश", "बरसात", "वर्षा",
  "तापमान", "गर्मी", "ठंड", "ठंडी", "हवा", "धूप", "नमी", "चेतावनी", "तूफ़ान", "तूफान",
  "खतरा", "पूर्वानुमान", "छाता", "सलाह", "बताओ", "बताइए", "मुझे", "हमें", "यहाँ", "यहां",
  "शाम", "सुबह", "रात", "दिन", "सप्ताहांत", "अगले", "हफ़्ते", "हफ्ते", "पानी", "फसल",
  "सिंचाई", "कृपया", "गंभीर", "जाऊं", "चाहिए", "मौसमी",
]);

/**
 * Romanised-Hindi markers. Devanagari is unambiguous, but "Kal Jaipur mein
 * baarish hogi?" is Hindi written in Latin script, and answering it in English
 * would be wrong even on this path. Two hits are required so an English question
 * that happens to contain "do" or "me" is not misread as Hindi.
 */
const ROMAN_HINDI = new Set([
  "kal", "aaj", "parso", "kya", "hai", "hoga", "hogi", "hogaa", "mein", "mai",
  "baarish", "barish", "mausam", "garmi", "thand", "thandi", "hawa", "dhoop",
  "kaisa", "kaisi", "kaise", "batao", "bata", "chahiye", "paani", "fasal",
  "kitna", "kitni", "abhi", "shaam", "subah", "raat", "nahi", "haan", "toofan",
]);

/**
 * Which of the three registers to answer in.
 *
 * `hi` is Devanagari, `roman` is Hindi written in Latin script. Only `hi` asks the
 * data services for Hindi strings — condition names and day labels inside a
 * romanised sentence stay English so a single sentence never mixes two scripts.
 */
type Mode = "en" | "hi" | "roman";

function languageOf(body: ChatRequestBody): Mode {
  const last = body.messages[body.messages.length - 1]?.content ?? "";
  if (DEVANAGARI.test(last)) return "hi";

  const words = last.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  const hits = new Set(words.filter((word) => ROMAN_HINDI.has(word)));
  if (hits.size >= 2) return "roman";
  if (body.language === "hi") return "hi";
  return "en";
}

/** Picks the phrasing for the answer register. */
function say(mode: Mode, text: { en: string; hi: string; roman: string }): string {
  return text[mode];
}

/**
 * Trims a provider failure down to something quotable. Upstream reasons carry the
 * whole error body ("upstream responded 401: {…}"); the status is the useful part in
 * a sentence, and the full text still reaches the model on the LLM path.
 */
function shortReason(error: string): string {
  const head = error.split(/:\s*[{[]/)[0].trim();
  return head.length > 0 ? head : error.slice(0, 80).trim();
}


/**
 * Words that are part of a place name but are never a place on their own.
 *
 * Without this, "Zyxwvutsraq City" fails as a whole, then the bare token "City"
 * resolves to a real settlement called City in Jamaica and the fallback answers
 * confidently about somewhere the user never mentioned. A candidate made only of
 * these words is skipped; they are still allowed inside a longer candidate, so
 * "Kansas City" and "Salt Lake City" keep working.
 */
const GENERIC_PLACE_WORDS = new Set([
  "city", "cities", "town", "village", "district", "area", "region", "place",
  "here", "near", "nearby", "around", "shahar", "sheher", "gaon", "jagah",
]);

/** Longest-first n-gram search against the geocoder. Never guesses coordinates. */
async function findPlace(text: string, body: ChatRequestBody): Promise<Place | null> {
  const tokens = text
    // `\p{M}` keeps Devanagari matras attached: without it "दिल्ली" is stripped to
    // "दलल", which matches nothing in the geocoder.
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token.toLowerCase()));

  const candidates: string[] = [];
  for (let size = Math.min(3, tokens.length); size >= 1; size -= 1) {
    for (let start = 0; start + size <= tokens.length; start += 1) {
      const parts = tokens.slice(start, start + size);
      if (parts.every((part) => GENERIC_PLACE_WORDS.has(part.toLowerCase()))) continue;
      if (size === 1 && parts[0].length < 3) continue;
      candidates.push(parts.join(" "));
    }
  }

  // Budget of eight geocoder calls: enough that the single tokens are still
  // reachable after the longer n-grams miss, small enough to stay one turn.
  for (const candidate of [...new Set(candidates)].slice(0, 8)) {
    const found = await geocode(candidate, 1);
    if (found.ok) return found.data[0];
  }

  if (body.location) {
    const reverse = await reverseGeocode(body.location.latitude, body.location.longitude);
    if (reverse.ok) return reverse.data;
  }
  return null;
}

type Intent = "current" | "forecast" | "alerts";

function readIntent(text: string): { intent: Intent; offsetDays: number } {
  const lower = text.toLowerCase();
  const alerts = /alert|warning|severe|cyclone|चेतावनी|तूफ़ान|तूफान|खतरा/.test(lower);
  let offsetDays = 0;
  if (/tomorrow|\bkal\b|कल/.test(lower)) offsetDays = 1;
  if (/day after|parso|परसों/.test(lower)) offsetDays = 2;
  if (/weekend|सप्ताहांत/.test(lower)) offsetDays = 2;

  if (alerts) return { intent: "alerts", offsetDays };
  if (offsetDays > 0 || /forecast|पूर्वानुमान|umbrella|छाता/.test(lower)) {
    return { intent: "forecast", offsetDays: Math.max(offsetDays, 1) };
  }
  return { intent: "current", offsetDays: 0 };
}

export async function runFallback(body: ChatRequestBody, emit: (frame: StreamFrame) => void) {
  const mode = languageOf(body);
  /** Data services only speak en/hi; romanised answers borrow the English strings. */
  const language: "en" | "hi" = mode === "hi" ? "hi" : "en";
  emit({ t: "notice", message: NOTICE[mode] });

  const question = body.messages[body.messages.length - 1]?.content ?? "";
  const place = await findPlace(question, body);
  if (!place) {
    emit({
      t: "text",
      d: say(mode, {
        en: 'I could not identify a city in that question. Please name a city (for example "Delhi"), or allow location access.',
        hi: "मुझे इस सवाल में कोई शहर नहीं मिला। कृपया शहर का नाम बताएं (जैसे \"दिल्ली\"), या स्थान की अनुमति दें।",
        roman:
          'Mujhe is sawaal mein koi shahar nahi mila. Kripya shahar ka naam batayein (jaise "Delhi"), ya location ki anumati dein.',
      }),
    });
    return;
  }

  const timezone = isValidTimeZone(body.timezone) ? body.timezone! : DEFAULT_TIMEZONE;
  const { intent, offsetDays } = readIntent(question);

  if (intent === "alerts") {
    const alerts = await getAlerts(place, { language });
    if (!alerts.ok) {
      emit({ t: "text", d: unavailable(mode, place.name, alerts.reason) });
      return;
    }
    const { official, derived } = alerts.data;
    for (const alert of [...official.alerts, ...derived]) emit({ t: "alert", alert });

    const count = official.alerts.length;
    const officialLine = !official.configured
      ? say(mode, {
          en: "The official warning feed is not configured in this deployment, so an official warning can neither be confirmed nor ruled out.",
          hi: "इस इंस्टॉलेशन में सरकारी चेतावनी फ़ीड कॉन्फ़िगर नहीं है, इसलिए सरकारी चेतावनी की पुष्टि नहीं की जा सकती।",
          roman:
            "Is deployment mein sarkari chetavni ka feed configure nahi hai, is liye sarkari chetavni ki pushti nahi ki ja sakti.",
        })
      : official.error
        ? say(mode, {
            en: `The official warning feed (${official.provider}) is configured but could not be reached just now (${shortReason(official.error)}), so I do not know whether a warning is active — check imd.gov.in directly.`,
            hi: `सरकारी चेतावनी फ़ीड (${official.provider}) कॉन्फ़िगर है, लेकिन इस समय उससे संपर्क नहीं हो सका (${shortReason(official.error)}), इसलिए कोई चेतावनी सक्रिय है या नहीं, यह मुझे नहीं पता — imd.gov.in पर सीधे देखें।`,
            roman: `Sarkari chetavni feed (${official.provider}) configure hai, par abhi us se sampark nahi ho saka (${shortReason(official.error)}), is liye koi chetavni active hai ya nahi mujhe nahi pata — imd.gov.in par seedha dekhein.`,
          })
        : count > 0
          ? say(mode, {
              en: `There ${count === 1 ? "is" : "are"} ${count} official warning(s) for ${place.name} (${official.provider}).`,
              hi: `${place.name} के लिए ${count} सरकारी चेतावनी है (${official.provider}).`,
              roman: `${place.name} ke liye ${count} sarkari chetavni hai (${official.provider}).`,
            })
          : say(mode, {
              en: `No official warning is currently active for ${place.name}.`,
              hi: `${place.name} के लिए कोई सरकारी चेतावनी सक्रिय नहीं है।`,
              roman: `${place.name} ke liye is waqt koi sarkari chetavni active nahi hai.`,
            });

    const events = derived.map((alert) => alert.event).join(", ");
    const derivedLine =
      derived.length > 0
        ? say(mode, {
            en: ` Based on the forecast, ${derived.length} threshold advisory(ies) apply: ${events}. These are not official warnings.`,
            hi: ` पूर्वानुमान के आधार पर ${derived.length} सलाह मिली: ${events}। ये सरकारी चेतावनी नहीं हैं।`,
            roman: ` Forecast ke aadhar par ${derived.length} advisory bani: ${events}. Ye sarkari chetavni nahi hain.`,
          })
        : say(mode, {
            en: " No forecast-based advisories were triggered either.",
            hi: " पूर्वानुमान में कोई सीमा-आधारित सलाह भी नहीं बनी।",
            roman: " Forecast se koi threshold advisory bhi nahi bani.",
          });

    emit({ t: "text", d: officialLine + derivedLine });
    return;
  }

  if (intent === "current") {
    const result = await getCurrentWeather(place, language);
    if (!result.ok) {
      emit({ t: "text", d: unavailable(mode, place.name, result.reason) });
      return;
    }
    const current = result.data.bundle.current;
    const condition = conditionText(current?.weatherCode, language);
    emit({ t: "card", card: result.data.card });
    emit({
      t: "text",
      d: say(mode, {
        en: `Right now ${place.name} is ${fmtTemp(current?.temperatureC)} with ${condition.toLowerCase()}, feeling like ${fmtTemp(
          current?.apparentTemperatureC,
        )}. Humidity is ${fmtPct(current?.humidityPct)} and wind ${fmtWind(
          current?.windSpeedKmh,
        )}. (Current observation.)`,
        hi: `${place.name} में अभी ${fmtTemp(current?.temperatureC)} है, ${condition}, महसूस ${fmtTemp(
          current?.apparentTemperatureC,
        )}। नमी ${fmtPct(current?.humidityPct)}, हवा ${fmtWind(
          current?.windSpeedKmh,
        )}। (वर्तमान अवलोकन)`,
        roman: `${place.name} mein abhi ${fmtTemp(current?.temperatureC)} hai, ${condition.toLowerCase()}, mehsoos ${fmtTemp(
          current?.apparentTemperatureC,
        )} hota hai. Namee ${fmtPct(current?.humidityPct)}, hawa ${fmtWind(
          current?.windSpeedKmh,
        )}. (Abhi ka observation.)`,
      }),
    });
    return;
  }

  const date = addDays(isoDateInZone(new Date(), timezone), offsetDays);
  const result = await getForecast(place, { date, days: 7, language });
  if (!result.ok) {
    emit({ t: "text", d: unavailable(mode, place.name, result.reason) });
    return;
  }
  const day = result.data.bundle.daily.find((row) => row.date === date);
  const when = dayLabel(date, language);
  const condition = conditionText(day?.weatherCode, language);
  emit({ t: "card", card: result.data.card });
  emit({
    t: "text",
    d: say(mode, {
      en: `The forecast for ${place.name} on ${when} is ${fmtTemp(day?.tempMaxC)} / ${fmtTemp(
        day?.tempMinC,
      )} with ${condition.toLowerCase()}. Rain chance ${fmtPct(
        day?.precipitationProbabilityMaxPct,
      )}, expected precipitation ${fmtMm(day?.precipitationSumMm)}. (Forecast, not an observation.)`,
      hi: `${when} को ${place.name} में ${fmtTemp(day?.tempMaxC)} / ${fmtTemp(
        day?.tempMinC,
      )} रहने का पूर्वानुमान है, ${condition}। बारिश की संभावना ${fmtPct(
        day?.precipitationProbabilityMaxPct,
      )}, कुल वर्षा ${fmtMm(day?.precipitationSumMm)}। (पूर्वानुमान, अवलोकन नहीं)`,
      roman: `${when} ko ${place.name} mein ${fmtTemp(day?.tempMaxC)} / ${fmtTemp(
        day?.tempMinC,
      )} rehne ka forecast hai, ${condition.toLowerCase()}. Baarish ki sambhavna ${fmtPct(
        day?.precipitationProbabilityMaxPct,
      )}, kul varsha ${fmtMm(day?.precipitationSumMm)}. (Forecast hai, observation nahi.)`,
    }),
  });
}

function unavailable(mode: Mode, placeName: string, reason: string): string {
  const why = shortReason(reason);
  return say(mode, {
    en: `Reliable data could not be retrieved for ${placeName} (${why}). I will not estimate it.`,
    hi: `${placeName} के लिए विश्वसनीय डेटा नहीं मिल सका (${why}). मैं अनुमान नहीं लगाऊंगा।`,
    roman: `${placeName} ke liye bharosemand data nahi mil saka (${why}). Main andaaza nahi lagaunga.`,
  });
}
