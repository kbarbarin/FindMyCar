// Placeholder V2. L'API est alignée sur localAdapter pour permettre un swap sans
// aucune modification côté UI / store.
//
// En V2 :
//  - importer getFirestore, doc, collection, setDoc, getDocs...
//  - remplacer les méthodes ci-dessous par des lectures/écritures Firestore
//  - conserver la signature synchrone en enveloppant un cache local (ou rendre tout async
//    et adapter le store qui pour l'instant est sync)

export const firebaseAdapter = {
  getFavorites() {
    console.warn('[firebaseAdapter] non implémenté en V1');
    return [];
  },
  setFavorites(/* list */) {
    console.warn('[firebaseAdapter] non implémenté en V1');
  },
  getSavedSearches() {
    console.warn('[firebaseAdapter] non implémenté en V1');
    return [];
  },
  setSavedSearches(/* list */) {
    console.warn('[firebaseAdapter] non implémenté en V1');
  },
};
