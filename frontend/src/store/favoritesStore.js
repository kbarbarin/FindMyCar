import { create } from 'zustand';
import { persistenceStore } from '../services/persistence/store.js';

// Favoris côté client. V1 : localStorage via persistenceStore.
// V2 : même API, backend Firestore par swap d'adapter.
export const useFavoritesStore = create((set, get) => ({
  favorites: persistenceStore.getFavorites(),

  isFavorite(listingId) {
    return get().favorites.some((f) => f.listingId === listingId);
  },

  toggle(listing) {
    const { favorites } = get();
    const exists = favorites.find((f) => f.listingId === listing.id);
    let next;
    if (exists) {
      next = favorites.filter((f) => f.listingId !== listing.id);
    } else {
      next = [
        ...favorites,
        {
          id: `fav_${Date.now()}`,
          userId: null,
          listingId: listing.id,
          listingSnapshot: listing,
          addedAt: new Date().toISOString(),
          note: '',
        },
      ];
    }
    persistenceStore.setFavorites(next);
    set({ favorites: next });
  },

  clear() {
    persistenceStore.setFavorites([]);
    set({ favorites: [] });
  },
}));
