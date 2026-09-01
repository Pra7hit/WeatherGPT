import type { Language } from "@/lib/types";

/**
 * UI chrome copy in English and Hindi.
 *
 * Only labels the interface owns live here. Everything the assistant *says* is
 * written by the model in the user's own language, and everything on a weather
 * card is labelled by the server that built it - so no answer text is ever
 * translated on the client.
 */

export type UiLang = "en" | "hi";

/** The language selector allows "auto"; the chrome itself has to pick one. */
export function uiLang(language: Language): UiLang {
  return language === "hi" ? "hi" : "en";
}

const TEXT = {
  en: {
    brand: "WeatherGPT",
    tagline: "Conversational weather, alerts & climate",
    newChat: "New chat",
    placeholder: "Ask about the weather…",
    send: "Send",
    stop: "Stop",
    mic: "Speak your question",
    micListening: "Listening… tap to stop",
    micUnsupported: "Voice input is not supported in this browser",
    theme: "Toggle dark mode",
    language: "Language",
    languageAuto: "Auto",
    location: "Location",
    locationNone: "No location set",
    useMyLocation: "Use my location",
    locating: "Getting your location…",
    searchPlaceholder: "Search a city…",
    searching: "Searching…",
    noResults: "No matching place found.",
    clearLocation: "Clear location",
    emptyTitle: "Ask about the weather, in your own words",
    emptyBody:
      "I answer from live forecast data and always tell you where a number came from. If reliable data is not available, I will say so instead of guessing.",
    suggestions: "Try one of these",
    thinking: "Working on it…",
    lookups: "Data lookups",
    retry: "Retry",
    stopped: "Response stopped.",
    disclaimer:
      "Answers come from live forecast data and can still be wrong. Advisories are suggestions, not safety guarantees — for life-threatening weather follow IMD and NDMA.",
    hourly: "Next hours",
    daily: "Coming days",
    official: "Official warning",
    advisory: "Forecast-based advisory",
    notOfficial: "Not an official warning",
    evidence: "Why this triggered",
    retrieved: "Retrieved",
    kind: {
      observation: "Current observation",
      forecast: "Forecast",
      historical: "Historical data",
      official_warning: "Official warning",
      derived_advisory: "AI advisory (from forecast)",
      nwp: "NWP model output",
      location: "Location lookup",
    },
  },
  hi: {
    brand: "WeatherGPT",
    tagline: "बातचीत में मौसम, चेतावनी और जलवायु",
    newChat: "नई चैट",
    placeholder: "मौसम के बारे में पूछें…",
    send: "भेजें",
    stop: "रोकें",
    mic: "बोलकर पूछें",
    micListening: "सुन रहा हूँ… रोकने के लिए दबाएँ",
    micUnsupported: "इस ब्राउज़र में वॉइस इनपुट उपलब्ध नहीं है",
    theme: "डार्क मोड बदलें",
    language: "भाषा",
    languageAuto: "स्वतः",
    location: "स्थान",
    locationNone: "कोई स्थान सेट नहीं",
    useMyLocation: "मेरा स्थान इस्तेमाल करें",
    locating: "आपका स्थान लिया जा रहा है…",
    searchPlaceholder: "शहर खोजें…",
    searching: "खोज रहा है…",
    noResults: "कोई मिलता-जुलता स्थान नहीं मिला।",
    clearLocation: "स्थान हटाएँ",
    emptyTitle: "अपने शब्दों में मौसम के बारे में पूछें",
    emptyBody:
      "मैं लाइव पूर्वानुमान डेटा से उत्तर देता हूँ और हर आंकड़े का स्रोत बताता हूँ। भरोसेमंद डेटा न मिलने पर मैं अनुमान नहीं लगाऊँगा, साफ़ बता दूँगा।",
    suggestions: "इनमें से कुछ पूछें",
    thinking: "देख रहा हूँ…",
    lookups: "डेटा स्रोत",
    retry: "फिर कोशिश करें",
    stopped: "उत्तर रोक दिया गया।",
    disclaimer:
      "उत्तर लाइव पूर्वानुमान डेटा से बनते हैं, फिर भी ग़लत हो सकते हैं। सलाह सुझाव है, सुरक्षा की गारंटी नहीं — जानलेवा मौसम में IMD और NDMA के निर्देश मानें।",
    hourly: "अगले घंटे",
    daily: "आने वाले दिन",
    official: "सरकारी चेतावनी",
    advisory: "पूर्वानुमान आधारित सलाह",
    notOfficial: "यह सरकारी चेतावनी नहीं है",
    evidence: "यह क्यों बना",
    retrieved: "प्राप्त",
    kind: {
      observation: "वर्तमान अवलोकन",
      forecast: "पूर्वानुमान",
      historical: "ऐतिहासिक डेटा",
      official_warning: "सरकारी चेतावनी",
      derived_advisory: "AI सलाह (पूर्वानुमान से)",
      nwp: "NWP मॉडल आउटपुट",
      location: "स्थान खोज",
    },
  },
} as const;

export function t(language: Language) {
  return TEXT[uiLang(language)];
}

/** The demo questions, in both languages, seeded into the empty state. */
export const SUGGESTIONS: Record<UiLang, string[]> = {
  en: [
    "What's the weather in Delhi right now?",
    "Will it rain in Delhi tomorrow?",
    "I'm travelling to Mumbai this weekend. What should I expect?",
    "Is there any severe weather warning for Chennai?",
    "Should I carry an umbrella tomorrow?",
    "Why does it feel hotter than the actual temperature?",
    "Should I irrigate my field in Nashik tomorrow?",
    "How has Delhi's temperature changed over the last 10 years?",
  ],
  hi: [
    "दिल्ली में अभी मौसम कैसा है?",
    "Kal Jaipur mein baarish hogi?",
    "इस weekend मुंबई जा रहा हूँ, कैसा मौसम रहेगा?",
    "क्या चेन्नई के लिए कोई भारी चेतावनी है?",
    "कल छाता ले जाना चाहिए?",
    "तापमान से ज़्यादा गर्मी क्यों महसूस होती है?",
    "Kal Nashik mein fasal ko paani dena chahiye?",
    "पिछले 10 साल में दिल्ली का तापमान कैसे बदला है?",
  ],
};
