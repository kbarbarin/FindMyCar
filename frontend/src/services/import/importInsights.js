// Calculs liés à l'import. Volontairement simplifiés en V1 — à remplacer par
// un vrai modèle fiscal + un tarif transport en V2 (Cloud Function).

import { APP_CONFIG } from '../../config/app.config.js';
import { APPROX_DISTANCE_TO_PARIS_KM } from '../../constants/countries.js';

const DESTINATION = APP_CONFIG.importDefaults.destinationCountry;

export function computeImportMetadata(listing) {
  const origin = listing.country;
  if (!origin || origin === DESTINATION) return null;

  const distance = APPROX_DISTANCE_TO_PARIS_KM[origin];
  const transportCost = distance != null
    ? Math.round(distance * APP_CONFIG.importDefaults.transportPerKm + APP_CONFIG.importDefaults.transportFlat)
    : null;
  const registrationFee = APP_CONFIG.importDefaults.registrationFeeFlat;

  // V1 : pas de malus réel, car il dépend du CO2 qu'on n'a pas. On met 0 et on l'affiche comme "estimé".
  const ecoTax = 0;

  const totalOverhead = (transportCost ?? 0) + registrationFee + ecoTax;
  const importedPriceEstimate = (listing.price?.amount ?? 0) + totalOverhead;

  return {
    originCountry: origin,
    destinationCountry: DESTINATION,
    fxRate: 1, // V1 : tout EUR. V2 : FX pour CHF, GBP.
    vatHandling: 'intra_eu_b2c',
    transportCostEstimate: transportCost,
    registrationFeeEstimate: registrationFee,
    ecoTaxEstimate: ecoTax,
    totalEstimatedOverhead: totalOverhead,
    importedPriceEstimate,
    marketDeltaEstimate: null, // sera rempli par enrichWithMarketDelta quand on a une médiane FR
  };
}

// Enrichit les annonces étrangères avec le delta par rapport au prix médian FR des annonces
// du même modèle (même make+model+year±1). Volumes mocks → calcul en mémoire.
export function enrichListingsWithImport(listings) {
  const frenchMedian = buildFrMedianIndex(listings);
  return listings.map((l) => {
    if (l.country === DESTINATION) return l;
    const meta = computeImportMetadata(l);
    if (!meta) return l;
    const key = makeMedianKey(l);
    const median = frenchMedian.get(key);
    if (median != null) {
      meta.marketDeltaEstimate = meta.importedPriceEstimate - median;
    }
    return { ...l, importMeta: meta };
  });
}

function buildFrMedianIndex(listings) {
  const buckets = new Map();
  for (const l of listings) {
    if (l.country !== DESTINATION) continue;
    if (!l.price?.amount || !l.make || !l.model) continue;
    const key = makeMedianKey(l);
    const arr = buckets.get(key) || [];
    arr.push(l.price.amount);
    buckets.set(key, arr);
  }
  const out = new Map();
  for (const [key, prices] of buckets.entries()) {
    prices.sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    out.set(key, prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2);
  }
  return out;
}

function makeMedianKey(l) {
  const yearBucket = l.year ? Math.round(l.year / 2) * 2 : 'na';
  return `${(l.make || '').toLowerCase()}|${(l.model || '').toLowerCase()}|${yearBucket}`;
}
