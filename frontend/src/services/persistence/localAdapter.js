// Adapter localStorage. Zéro logique métier, juste lecture/écriture sérialisée.

const KEYS = {
  favorites: 'fmc.favorites.v1',
  savedSearches: 'fmc.savedSearches.v1',
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[localAdapter] write failed', err);
  }
}

export const localAdapter = {
  getFavorites() { return readJson(KEYS.favorites, []); },
  setFavorites(list) { writeJson(KEYS.favorites, list); },

  getSavedSearches() { return readJson(KEYS.savedSearches, []); },
  setSavedSearches(list) { writeJson(KEYS.savedSearches, list); },
};
