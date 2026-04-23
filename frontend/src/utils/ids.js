// Clé canonique pour une annonce normalisée.
export function makeListingId(sourceId, sourceRef) {
  return `${sourceId}:${sourceRef}`;
}

export function parseListingId(id) {
  const idx = id.indexOf(':');
  if (idx < 0) return { sourceId: null, sourceRef: id };
  return { sourceId: id.slice(0, idx), sourceRef: id.slice(idx + 1) };
}

// Fingerprint pour dédup inter-sources quand l'id diffère (même annonce republiée).
export function fingerprint(listing) {
  const priceBucket = listing.price?.amount ? Math.round(listing.price.amount / 500) : 'na';
  const kmBucket = listing.mileageKm ? Math.round(listing.mileageKm / 10000) : 'na';
  return [
    (listing.make || '').toLowerCase(),
    (listing.model || '').toLowerCase(),
    listing.year || 'na',
    kmBucket,
    priceBucket,
  ].join('|');
}
