import { listingsCache } from '../services/listings.cache.js';

// Lecture O(1) dans le cache alimenté par l'aggrégateur. Si l'annonce n'est
// pas (ou plus) en cache, on renvoie 404 — le client saura qu'il faut
// re-lancer une recherche ou utiliser le state de navigation.
export async function getById(req, res) {
  const id = decodeURIComponent(req.params.id);
  const found = listingsCache.get(id);
  if (!found) {
    return res.status(404).json({
      error: 'listing_not_found',
      id,
      hint: 'Relancez une recherche pour remettre l\'annonce en cache, ou ouvrez-la depuis la liste.',
    });
  }
  res.set('X-Cache', 'HIT');
  res.json(found);
}
