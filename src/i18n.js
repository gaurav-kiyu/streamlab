import React, { createContext, useCallback, useContext, useState } from "react";
import { getSettings, saveSettings } from "./settings.js";
import { MORE } from "./strings.js";

// Short UI strings. Have native speakers review these before a public release.
const STR = {
  en: {
    browse: "Browse", search: "Search", settings: "Settings", play: "Play", playTest: "Play test stream",
    addList: "Add to My list", removeList: "Remove from My list", back: "Back", continue: "Continue watching",
    library: "Your library", myList: "My list", searchPlaceholder: "Search movies", whereIndia: "Where to watch in India",
    free: "Free", subscription: "With subscription", rent: "Rent or buy", noListings: "No listings found.",
    openWatch: "Open watch options", saveTest: "Save and test", dataSaver: "Data saver (limits video to about 1.2 Mbps)",
    playbackFailed: "Playback failed. Check your connection or the stream address, then go back and try again.",
    subs: "Subtitles", off: "off", audio: "Audio", quality: "Quality", auto: "Auto", uiLanguage: "App language",
    streamQuality: "Stream quality (Jellyfin)", noDesc: "No description available.", searching: "Searching...", noResults: "No results.",
  },
  hi: {
    browse: "ब्राउज़", search: "खोजें", settings: "सेटिंग्स", play: "चलाएँ", playTest: "टेस्ट स्ट्रीम चलाएँ",
    addList: "मेरी सूची में जोड़ें", removeList: "मेरी सूची से हटाएँ", back: "वापस", continue: "देखना जारी रखें",
    library: "आपकी लाइब्रेरी", myList: "मेरी सूची", searchPlaceholder: "फ़िल्में खोजें", whereIndia: "भारत में कहाँ देखें",
    free: "मुफ़्त", subscription: "सब्सक्रिप्शन के साथ", rent: "किराए या खरीद पर", noListings: "कोई विकल्प नहीं मिला।",
    openWatch: "देखने के विकल्प खोलें", saveTest: "सहेजें और जाँचें", dataSaver: "डेटा सेवर (वीडियो लगभग 1.2 Mbps तक सीमित)",
    playbackFailed: "प्लेबैक विफल रहा। अपना कनेक्शन या स्ट्रीम का पता जाँचें, फिर वापस जाकर दोबारा कोशिश करें।",
    subs: "उपशीर्षक", off: "बंद", audio: "ऑडियो", quality: "गुणवत्ता", auto: "ऑटो", uiLanguage: "ऐप की भाषा",
    streamQuality: "स्ट्रीम गुणवत्ता (Jellyfin)", noDesc: "कोई विवरण उपलब्ध नहीं।", searching: "खोज रहे हैं...", noResults: "कोई परिणाम नहीं।",
  },
  ta: {
    browse: "உலாவு", search: "தேடு", settings: "அமைப்புகள்", play: "இயக்கு", playTest: "சோதனை ஸ்ட்ரீமை இயக்கு",
    addList: "என் பட்டியலில் சேர்", removeList: "என் பட்டியலிலிருந்து நீக்கு", back: "பின்செல்", continue: "தொடர்ந்து பார்க்க",
    library: "உங்கள் நூலகம்", myList: "என் பட்டியல்", searchPlaceholder: "திரைப்படங்களைத் தேடுங்கள்", whereIndia: "இந்தியாவில் எங்கே பார்க்கலாம்",
    free: "இலவசம்", subscription: "சந்தாவுடன்", rent: "வாடகை அல்லது வாங்க", noListings: "எந்த விருப்பமும் இல்லை.",
    openWatch: "பார்க்கும் வழிகளைத் திற", saveTest: "சேமித்து சோதி", dataSaver: "டேட்டா சேவர் (வீடியோ சுமார் 1.2 Mbps வரை)",
    playbackFailed: "இயக்கம் தோல்வியடைந்தது. இணைப்பைச் சரிபார்த்து, பின்னால் சென்று மீண்டும் முயலவும்.",
    subs: "வசனங்கள்", off: "இல்லை", audio: "ஆடியோ", quality: "தரம்", auto: "தானியங்கி", uiLanguage: "ஆப் மொழி",
    streamQuality: "ஸ்ட்ரீம் தரம் (Jellyfin)", noDesc: "விளக்கம் இல்லை.", searching: "தேடுகிறது...", noResults: "முடிவுகள் இல்லை.",
  },
  te: {
    browse: "బ్రౌజ్", search: "శోధన", settings: "సెట్టింగ్‌లు", play: "ప్లే చేయండి", playTest: "టెస్ట్ స్ట్రీమ్ ప్లే చేయండి",
    addList: "నా జాబితాలో చేర్చండి", removeList: "నా జాబితా నుండి తొలగించండి", back: "వెనుకకు", continue: "చూడటం కొనసాగించండి",
    library: "మీ లైబ్రరీ", myList: "నా జాబితా", searchPlaceholder: "సినిమాలను వెతకండి", whereIndia: "భారతదేశంలో ఎక్కడ చూడాలి",
    free: "ఉచితం", subscription: "సబ్‌స్క్రిప్షన్‌తో", rent: "అద్దె లేదా కొనుగోలు", noListings: "ఎంపికలు కనుగొనబడలేదు.",
    openWatch: "చూసే ఎంపికలను తెరవండి", saveTest: "సేవ్ చేసి పరీక్షించండి", dataSaver: "డేటా సేవర్ (వీడియో సుమారు 1.2 Mbps వరకు)",
    playbackFailed: "ప్లేబ్యాక్ విఫలమైంది. మీ కనెక్షన్ తనిఖీ చేసి, వెనక్కి వెళ్లి మళ్లీ ప్రయత్నించండి.",
    subs: "ఉపశీర్షికలు", off: "ఆఫ్", audio: "ఆడియో", quality: "నాణ్యత", auto: "ఆటో", uiLanguage: "యాప్ భాష",
    streamQuality: "స్ట్రీమ్ నాణ్యత (Jellyfin)", noDesc: "వివరణ అందుబాటులో లేదు.", searching: "వెతుకుతోంది...", noResults: "ఫలితాలు లేవు.",
  },
};

for (const k of Object.keys(MORE)) STR[k] = { ...(STR[k] || {}), ...MORE[k] };

export const UI_LANGS = [
  { code: "en", label: "English" }, { code: "hi", label: "हिन्दी" }, { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" }, { code: "bn", label: "বাংলা" }, { code: "mr", label: "मराठी" },
  { code: "ml", label: "മലയാളം" }, { code: "kn", label: "ಕನ್ನಡ" }, { code: "pa", label: "ਪੰਜਾਬੀ" }, { code: "gu", label: "ગુજરાતી" },
];

const Ctx = createContext({ lang: "en", chosen: true, setLang: () => {} });

export function LangProvider({ children }) {
  const [lang, setL] = useState(getSettings().uiLang || "en");
  const [chosen, setChosen] = useState(!!getSettings().uiLang);
  const setLang = useCallback((c) => {
    // first run: also start the content shelves in the same language
    if (!chosen) saveSettings({ uiLang: c, lang: c === "en" ? "all" : c });
    else saveSettings({ uiLang: c });
    setL(c); setChosen(true);
  }, [chosen]);
  return <Ctx.Provider value={{ lang, chosen, setLang }}>{children}</Ctx.Provider>;
}

export const useUiLang = () => useContext(Ctx);
export function useT() {
  const { lang } = useContext(Ctx);
  return (k) => (STR[lang] && STR[lang][k]) || STR.en[k] || k;
}
