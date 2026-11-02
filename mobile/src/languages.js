// Indian content languages. `tmdb` is the original-language code used to filter TMDB.
// Preserves original 10-language UI catalog for backwards compatibility while supporting Assamese and Odia for content discovery.

export const LANGS = [
  { code: "all", label: "All India", native: "", tmdb: "hi|ta|te|ml|kn|bn|mr|pa|gu" },
  { code: "hi", label: "Hindi", native: "हिन्दी", tmdb: "hi" },
  { code: "ta", label: "Tamil", native: "தமிழ்", tmdb: "ta" },
  { code: "te", label: "Telugu", native: "తెలుగు", tmdb: "te" },
  { code: "ml", label: "Malayalam", native: "മലയാളം", tmdb: "ml" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", tmdb: "kn" },
  { code: "bn", label: "Bengali", native: "বাংলা", tmdb: "bn" },
  { code: "mr", label: "Marathi", native: "मराठी", tmdb: "mr" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ", tmdb: "pa" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી", tmdb: "gu" },
];

// Expanded Phase 22 India-First content discovery languages (including Assamese & Odia)
export const INDIAN_CONTENT_LANGUAGES = [
  { code: "all", label: "All India", native: "भारत", tmdb: "hi|ta|te|ml|kn|bn|mr|pa|gu|as|or" },
  { code: "hi", label: "Hindi", native: "हिन्दी", tmdb: "hi" },
  { code: "ta", label: "Tamil", native: "தமிழ்", tmdb: "ta" },
  { code: "te", label: "Telugu", native: "తెలుగు", tmdb: "te" },
  { code: "ml", label: "Malayalam", native: "മലയാളം", tmdb: "ml" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", tmdb: "kn" },
  { code: "bn", label: "Bengali", native: "বাংলা", tmdb: "bn" },
  { code: "mr", label: "Marathi", native: "मराठी", tmdb: "mr" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ", tmdb: "pa" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી", tmdb: "gu" },
  { code: "as", label: "Assamese", native: "অসমীয়া", tmdb: "as" },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ", tmdb: "or" },
];

export const langByCode = (c) => {
  if (c === "as") return { code: "as", label: "Assamese", native: "অসমীয়া", tmdb: "as" };
  if (c === "or") return { code: "or", label: "Odia", native: "ଓଡ଼ିଆ", tmdb: "or" };
  return LANGS.find((l) => l.code === c) || LANGS[1];
};

export const contentLangByCode = (c) =>
  INDIAN_CONTENT_LANGUAGES.find((l) => l.code === c) || INDIAN_CONTENT_LANGUAGES[0];

// Distinguishes original language from verified dubbed audio and subtitle tracks
export function getVerifiedAudioInfo(item) {
  if (!item) return { verified: false, text: "Audio language information unavailable" };
  if (Array.isArray(item.audio_languages) && item.audio_languages.length > 0) {
    return {
      verified: true,
      languages: item.audio_languages,
      text: item.audio_languages.join(", ")
    };
  }
  if (Array.isArray(item.verified_audio_languages) && item.verified_audio_languages.length > 0) {
    return {
      verified: true,
      languages: item.verified_audio_languages,
      text: item.verified_audio_languages.join(", ")
    };
  }
  return {
    verified: false,
    text: "Audio language information unavailable"
  };
}

export function getVerifiedSubtitleInfo(item) {
  if (!item) return { verified: false, text: "Subtitle information unavailable" };
  if (Array.isArray(item.subtitle_languages) && item.subtitle_languages.length > 0) {
    return {
      verified: true,
      languages: item.subtitle_languages,
      text: item.subtitle_languages.join(", ")
    };
  }
  return {
    verified: false,
    text: "Subtitle information unavailable"
  };
}
