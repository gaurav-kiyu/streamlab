// StreamLab India-First Multi-OTT Provider Taxonomy and Deep-Link Registry
// Phase 22 Specification: Strict distinction between direct playback and external OTT handoff.

export const INDIAN_PROVIDERS = [
  {
    id: "jiohotstar",
    name: "JioHotstar",
    tmdbId: 122,
    altTmdbIds: [337],
    website: "https://www.hotstar.com/in",
    appScheme: "hotstar://",
    languages: ["hi", "ta", "te", "ml", "kn", "bn", "mr"],
    monetization: ["subscription", "free", "ads"],
    isPublicService: false,
    description: "Merged Disney+ Hotstar & JioCinema platform offering Indian entertainment, sports, and regional originals."
  },
  {
    id: "prime",
    name: "Prime Video",
    tmdbId: 119,
    website: "https://www.primevideo.com",
    appScheme: "primevideo://",
    languages: ["hi", "ta", "te", "ml", "kn", "bn", "mr", "gu", "pa"],
    monetization: ["subscription", "rent"],
    isPublicService: false,
    description: "Amazon Prime Video India catalog with Indian originals, blockbuster regional premieres, and TVOD rent store."
  },
  {
    id: "netflix",
    name: "Netflix",
    tmdbId: 8,
    website: "https://www.netflix.com/in",
    appScheme: "nflx://",
    languages: ["hi", "ta", "te", "ml", "kn", "bn", "mr"],
    monetization: ["subscription"],
    isPublicService: false,
    description: "Netflix India offering licensed Indian movies, Hindi series, and South Indian box-office acquisitions."
  },
  {
    id: "sonyliv",
    name: "SonyLIV",
    tmdbId: 237,
    website: "https://www.sonyliv.com",
    appScheme: "sonyliv://",
    languages: ["hi", "ta", "te", "ml", "mr", "bn"],
    monetization: ["subscription", "free", "ads"],
    isPublicService: false,
    description: "Sony Pictures Networks streaming service featuring acclaimed Hindi web originals, live sports, and regional content."
  },
  {
    id: "zee5",
    name: "ZEE5",
    tmdbId: 232,
    website: "https://www.zee5.com",
    appScheme: "zee5://",
    languages: ["hi", "ta", "te", "ml", "kn", "bn", "mr", "pa", "gu", "or"],
    monetization: ["subscription", "free", "ads"],
    isPublicService: false,
    description: "Extensive multi-lingual Indian OTT service with broadcast archives, original series, and regional cinema."
  },
  {
    id: "sunnxt",
    name: "Sun NXT",
    tmdbId: 309,
    website: "https://www.sunnxt.com",
    appScheme: "sunnxt://",
    languages: ["ta", "te", "ml", "kn"],
    monetization: ["subscription"],
    isPublicService: false,
    description: "Sun TV Network platform specializing exclusively in South Indian cinema, live television, and music."
  },
  {
    id: "aha",
    name: "aha",
    tmdbId: 532,
    website: "https://www.aha.video",
    appScheme: "aha://",
    languages: ["te", "ta"],
    monetization: ["subscription", "free"],
    isPublicService: false,
    description: "100% Telugu and Tamil on-demand video platform featuring proprietary originals and direct-to-digital films."
  },
  {
    id: "hoichoi",
    name: "Hoichoi",
    tmdbId: 315,
    website: "https://www.hoichoi.tv",
    appScheme: "hoichoi://",
    languages: ["bn"],
    monetization: ["subscription", "free"],
    isPublicService: false,
    description: "Dedicated Bengali entertainment streaming platform with classic films, modern dramas, and original series."
  },
  {
    id: "etvwin",
    name: "ETV Win",
    tmdbId: 615,
    website: "https://www.etvwin.com",
    appScheme: "etvwin://",
    languages: ["te"],
    monetization: ["subscription", "free"],
    isPublicService: false,
    description: "ETV Network's digital video arm focused on Telugu television shows, classic films, and digital exclusive films."
  },
  {
    id: "mxplayer",
    name: "MX Player",
    tmdbId: 494,
    website: "https://www.mxplayer.in",
    appScheme: "mxplayer://",
    languages: ["hi", "ta", "te", "bn", "mr", "pa", "gu"],
    monetization: ["free", "ads"],
    isPublicService: false,
    description: "Amazon MX Player offering ad-supported free streaming of Indian web shows, dubbed dramas, and regional cinema."
  },
  {
    id: "manoramamax",
    name: "ManoramaMAX",
    tmdbId: 440,
    website: "https://www.manoramamax.com",
    appScheme: "manoramamax://",
    languages: ["ml"],
    monetization: ["subscription", "free"],
    isPublicService: false,
    description: "Malayalam entertainment and news portal by MM TV featuring Mazhavil Manorama shows and Malayalam cinema."
  },
  {
    id: "chaupal",
    name: "Chaupal",
    tmdbId: 614,
    website: "https://chaupal.tv",
    appScheme: "chaupal://",
    languages: ["pa", "hi"],
    monetization: ["subscription"],
    isPublicService: false,
    description: "Specialized regional platform streaming Punjabi, Haryanvi, and Bhojpuri movies and web series."
  },
  {
    id: "planetmarathi",
    name: "Planet Marathi",
    tmdbId: 608,
    website: "https://www.planetmarathi.com",
    appScheme: "planetmarathi://",
    languages: ["mr"],
    monetization: ["subscription", "rent"],
    isPublicService: false,
    description: "First dedicated Marathi OTT platform streaming Marathi cinema, plays, web originals, and documentaries."
  },
  {
    id: "waves",
    name: "WAVES (Prasar Bharati)",
    tmdbId: null, // Public service aggregator
    website: "https://wavespb.com",
    appScheme: "wavespb://",
    languages: ["hi", "ta", "te", "ml", "kn", "bn", "mr", "pa", "gu", "as", "or"],
    monetization: ["free"],
    isPublicService: true,
    description: "Official public-service OTT platform by Prasar Bharati providing Doordarshan archives, Akashvani, cultural heritage, and regional public television."
  }
];

export const MONETIZATION_TYPES = [
  { key: "all", label: "All Access Types" },
  { key: "free", label: "Free (No Subscription)" },
  { key: "ads", label: "Free with Ads" },
  { key: "subscription", label: "Subscription" },
  { key: "rent", label: "Rent or Buy" },
];

// Validates external URL safety: must use https or approved OTT app schemes
export function validateExternalUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.startsWith("https://")) return true;
  const allowedSchemes = [
    "hotstar://",
    "primevideo://",
    "nflx://",
    "sonyliv://",
    "zee5://",
    "sunnxt://",
    "aha://",
    "hoichoi://",
    "etvwin://",
    "mxplayer://",
    "manoramamax://",
    "chaupal://",
    "planetmarathi://",
    "wavespb://"
  ];
  return allowedSchemes.some((s) => trimmed.startsWith(s));
}

// Find provider by name or TMDB ID
export function findProvider(query) {
  if (!query) return null;
  const qStr = String(query).toLowerCase().trim();
  return (
    INDIAN_PROVIDERS.find(
      (p) =>
        p.id === qStr ||
        p.name.toLowerCase() === qStr ||
        String(p.tmdbId) === qStr ||
        (p.altTmdbIds && p.altTmdbIds.map(String).includes(qStr))
    ) || null
  );
}

// Build destination handoff link for external OTT provider
export function resolveProviderHandoffUrl(providerName, item, rawLink) {
  if (rawLink && validateExternalUrl(rawLink)) {
    return rawLink;
  }
  const provider = findProvider(providerName);
  if (provider && provider.website) {
    return provider.website;
  }
  return "https://www.justwatch.com/in";
}
