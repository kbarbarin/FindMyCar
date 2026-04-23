// Estimations de prix (médiane marché) et coût total d'import.

const APPROX_DISTANCE_TO_PARIS_KM = {
  FR: 0, BE: 300, LU: 380, DE: 900, NL: 500, CH: 550, IT: 1050, ES: 1250,
};
const TRANSPORT_PER_KM = 0.6;
const TRANSPORT_FLAT = 250;
const REGISTRATION_FEE_FLAT = 320;
const DEST = 'FR';

export function computeEstimate(listings) {
  const prices = listings.map((l) => l.price?.amount).filter((p) => p != null).sort((a, b) => a - b);
  if (prices.length === 0) return null;
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  const average = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
  return {
    count: prices.length,
    min: prices[0],
    max: prices[prices.length - 1],
    median: Math.round(median),
    average,
    p25: prices[Math.floor(prices.length * 0.25)],
    p75: prices[Math.floor(prices.length * 0.75)],
  };
}

export function computeImport(listing) {
  const origin = listing.country;
  if (!origin || origin === DEST) return null;
  const distance = APPROX_DISTANCE_TO_PARIS_KM[origin];
  const transport = distance != null ? Math.round(distance * TRANSPORT_PER_KM + TRANSPORT_FLAT) : null;
  const overhead = (transport ?? 0) + REGISTRATION_FEE_FLAT;
  const imported = (listing.price?.amount ?? 0) + overhead;
  return {
    originCountry: origin,
    destinationCountry: DEST,
    transportCostEstimate: transport,
    registrationFeeEstimate: REGISTRATION_FEE_FLAT,
    ecoTaxEstimate: 0,
    totalEstimatedOverhead: overhead,
    importedPriceEstimate: imported,
  };
}

// Enrichit les annonces non-françaises avec la comparaison vs. médiane FR équivalente.
export function enrichWithImport(listings) {
  // médiane FR par (make, model, year±1)
  const buckets = new Map();
  for (const l of listings) {
    if (l.country !== DEST || !l.price?.amount) continue;
    const key = `${(l.make||'').toLowerCase()}|${(l.model||'').toLowerCase()}|${l.year ? Math.round(l.year/2)*2 : 'na'}`;
    const arr = buckets.get(key) || [];
    arr.push(l.price.amount);
    buckets.set(key, arr);
  }
  const medians = new Map();
  for (const [k, prices] of buckets) {
    prices.sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    medians.set(k, prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2);
  }

  return listings.map((l) => {
    if (l.country === DEST) return l;
    const meta = computeImport(l);
    if (!meta) return l;
    const key = `${(l.make||'').toLowerCase()}|${(l.model||'').toLowerCase()}|${l.year ? Math.round(l.year/2)*2 : 'na'}`;
    const median = medians.get(key);
    if (median != null) meta.marketDeltaEstimate = meta.importedPriceEstimate - median;
    return { ...l, importMeta: meta };
  });
}
