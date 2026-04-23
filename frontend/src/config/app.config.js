// Feature flags et constantes produit.
// Flag-driven pour faciliter la bascule V1 → V2 (Firebase) sans toucher à l'UI.

export const APP_CONFIG = {
  appName: 'FindMyCar',
  defaultPageSize: 20,
  defaultCountry: 'FR',
  defaultCurrency: 'EUR',
  // URL du backend. VITE_API_URL l'emporte. Vide = mode 100% local (V1).
  apiUrl: '',

  features: {
    // V1 : tout tourne localement. Passer ces flags à true quand Firebase est branché.
    useFirebasePersistence: false,
    useFirebaseSources: false,
    enableAuth: false,
    enableSavedSearches: false,
    enableAlerts: false,
    enableComparator: false,
  },

  search: {
    debounceMs: 200,
    maxSuggestions: 5,
    zeroResultsThreshold: 5, // au-dessous, on propose des élargissements agressifs
  },

  importDefaults: {
    destinationCountry: 'FR',
    // Frais indicatifs V1 (simplifiés — à raffiner avec un vrai modèle fiscal en V2)
    transportPerKm: 0.6,
    transportFlat: 250,
    registrationFeeFlat: 320,
  },
};
