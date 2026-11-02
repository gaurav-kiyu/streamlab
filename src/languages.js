// Indian content languages. `tmdb` is the original-language code used to filter TMDB.
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
export const langByCode = (c) => LANGS.find((l) => l.code === c) || LANGS[1];
