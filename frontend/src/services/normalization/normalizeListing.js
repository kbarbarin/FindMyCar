// Transforme une annonce brute (format source) en NormalizedListing.
// Un mapper par source. Tous retournent la MÊME forme.
// Champs inconnus → null. Champs reconstruits → tracés dans meta.reconstructed.

import { makeListingId } from '../../utils/ids.js';
import {
  normalizeFuel,
  normalizeTransmission,
  normalizeBody,
  normalizeFeatures,
  normalizeMake,
  normalizeModel,
  parseMileage,
  parseFirstRegistration,
  yearFromAny,
} from './taxonomy.js';

function baseMeta({ reconstructed = [], fieldsMissing = [] } = {}) {
  return {
    normalizedAt: new Date().toISOString(),
    reconstructed,
    fieldsMissing,
  };
}

function pickMissing(fields) {
  return Object.entries(fields)
    .filter(([, v]) => v == null || v === '')
    .map(([k]) => k);
}

// --- Leboncoin ---------------------------------------------------------------
export function normalizeLeboncoin(raw) {
  const reconstructed = [];
  const mileageKm = parseMileage(raw.kilometrage);
  const firstRegistration = parseFirstRegistration(raw.mise_en_circulation);
  const year = yearFromAny({ year: raw.annee, firstRegistration });
  const [makeFromTitle, modelFromTitle] = splitMakeModelFromTitle(raw.titre);
  let make = normalizeMake(makeFromTitle);
  let model = normalizeModel(modelFromTitle);
  if (!make || !model) reconstructed.push('make_model_from_title');

  const powerHp = raw.puissance_ch ?? null;
  const powerKw = powerHp ? Math.round(powerHp * 0.7355) : null;
  if (powerKw && !raw.puissance_kw) reconstructed.push('powerKw');

  const fields = {
    id: makeListingId('leboncoin', raw.id),
    source: { id: 'leboncoin', label: 'Leboncoin', country: 'FR' },
    url: raw.url ?? null,
    title: raw.titre ?? null,
    make,
    model,
    version: extractVersion(raw.titre, make, model),
    year,
    firstRegistration,
    mileageKm,
    price: { amount: raw.prix ?? null, currency: 'EUR' },
    fuel: normalizeFuel(raw.carburant),
    transmission: normalizeTransmission(raw.boite),
    powerHp,
    powerKw,
    bodyType: null,
    doors: raw.portes ?? null,
    seats: raw.places ?? null,
    color: raw.couleur ?? null,
    country: 'FR',
    region: null,
    city: raw.ville ?? null,
    seller: { type: raw.vendeur === 'pro' ? 'dealer' : 'private', name: null, rating: null },
    features: normalizeFeatures(raw.options),
    history: {
      firstHand: raw.premiere_main ?? null,
      accidentFree: null,
      serviceBookComplete: null,
    },
    photos: raw.photos ?? [],
    postedAt: raw.publie_le ?? null,
    rawScore: null,
  };
  return { ...fields, meta: baseMeta({ reconstructed, fieldsMissing: pickMissing(fields) }) };
}

// --- LaCentrale -------------------------------------------------------------
export function normalizeLacentrale(raw) {
  const reconstructed = [];
  const firstRegistration = parseFirstRegistration(raw.mec);
  const year = yearFromAny({ year: raw.annee_modele, firstRegistration });
  const powerHp = raw.ch_din ?? null;
  const powerKw = powerHp ? Math.round(powerHp * 0.7355) : null;
  if (powerKw) reconstructed.push('powerKw');

  const fields = {
    id: makeListingId('lacentrale', raw.reference),
    source: { id: 'lacentrale', label: 'La Centrale', country: 'FR' },
    url: raw.deeplink ?? null,
    title: [raw.marque, raw.modele, raw.finition].filter(Boolean).join(' '),
    make: normalizeMake(raw.marque),
    model: normalizeModel(raw.modele),
    version: raw.finition ?? null,
    year,
    firstRegistration,
    mileageKm: parseMileage(raw.km),
    price: { amount: raw.prix_ttc ?? null, currency: 'EUR' },
    fuel: normalizeFuel(raw.energie),
    transmission: normalizeTransmission(raw.transmission),
    powerHp,
    powerKw,
    bodyType: null,
    doors: raw.nb_portes ?? null,
    seats: raw.nb_places ?? null,
    color: raw.couleur_ext ?? null,
    country: 'FR',
    region: null,
    city: raw.localite ?? null,
    seller: { type: raw.type_vendeur === 'pro' ? 'dealer' : 'private', name: null, rating: null },
    features: normalizeFeatures(raw.equipements),
    history: {
      firstHand: raw.premiere_main ?? null,
      accidentFree: raw.historique?.accident === true ? false : raw.historique?.accident === false ? true : null,
      serviceBookComplete: raw.historique?.carnet_complet ?? null,
    },
    photos: raw.photos ?? [],
    postedAt: raw.mis_en_ligne ?? null,
    rawScore: null,
  };
  return { ...fields, meta: baseMeta({ reconstructed, fieldsMissing: pickMissing(fields) }) };
}

// --- Mobile.de --------------------------------------------------------------
export function normalizeMobilede(raw) {
  const reconstructed = [];
  const firstRegistration = parseFirstRegistration(raw.firstRegistration);
  const year = yearFromAny({ year: null, firstRegistration });
  if (year) reconstructed.push('year_from_first_registration');
  const powerKw = raw.powerKW ?? null;
  const powerHp = powerKw ? Math.round(powerKw / 0.7355) : null;
  if (powerHp) reconstructed.push('powerHp');

  const fields = {
    id: makeListingId('mobilede', raw.ref),
    source: { id: 'mobilede', label: 'Mobile.de', country: 'DE' },
    url: raw.url ?? null,
    title: [raw.make, raw.model, raw.trim].filter(Boolean).join(' '),
    make: normalizeMake(raw.make),
    model: normalizeModel(raw.model),
    version: raw.trim ?? null,
    year,
    firstRegistration,
    mileageKm: parseMileage(raw.mileageKm),
    price: { amount: raw.priceEUR ?? null, currency: 'EUR' },
    fuel: normalizeFuel(raw.fuelType),
    transmission: normalizeTransmission(raw.gearbox),
    powerHp,
    powerKw,
    bodyType: null,
    doors: raw.doors ?? null,
    seats: raw.seats ?? null,
    color: raw.color ?? null,
    country: raw.country ?? 'DE',
    region: null,
    city: raw.city ?? null,
    seller: { type: raw.sellerType === 'dealer' ? 'dealer' : 'private', name: null, rating: null },
    features: normalizeFeatures(raw.features),
    history: {
      firstHand: null,
      accidentFree: raw.accidentFree ?? null,
      serviceBookComplete: raw.fullServiceHistory ?? null,
    },
    photos: raw.images ?? [],
    postedAt: raw.listedAt ?? null,
    rawScore: null,
  };
  return { ...fields, meta: baseMeta({ reconstructed, fieldsMissing: pickMissing(fields) }) };
}

// --- AutoScout24 ------------------------------------------------------------
export function normalizeAutoscout24(raw) {
  const firstRegistration = parseFirstRegistration(raw.firstRegistration);
  const year = yearFromAny({ year: raw.modelYear, firstRegistration });

  const fields = {
    id: makeListingId('autoscout24', raw.id),
    source: { id: 'autoscout24', label: 'AutoScout24', country: 'DE' },
    url: raw.listingUrl ?? null,
    title: [raw.brand, raw.modelName, raw.version].filter(Boolean).join(' '),
    make: normalizeMake(raw.brand),
    model: normalizeModel(raw.modelName),
    version: raw.version ?? null,
    year,
    firstRegistration,
    mileageKm: raw.mileage?.value ?? null,
    price: { amount: raw.price?.value ?? null, currency: raw.price?.currency ?? 'EUR' },
    fuel: normalizeFuel(raw.fuel),
    transmission: normalizeTransmission(raw.transmission),
    powerHp: raw.power?.hp ?? null,
    powerKw: raw.power?.kw ?? null,
    bodyType: normalizeBody(raw.body?.type),
    doors: raw.body?.doors ?? null,
    seats: raw.body?.seats ?? null,
    color: raw.body?.color ?? null,
    country: raw.location?.country ?? null,
    region: raw.location?.region ?? null,
    city: raw.location?.city ?? null,
    seller: { type: raw.seller?.type ?? null, name: null, rating: raw.seller?.rating ?? null },
    features: normalizeFeatures(raw.equipment),
    history: {
      firstHand: null,
      accidentFree: raw.damageFree ?? null,
      serviceBookComplete: null,
    },
    photos: raw.photos ?? [],
    postedAt: raw.publishedAt ?? null,
    rawScore: null,
  };
  return { ...fields, meta: baseMeta({ fieldsMissing: pickMissing(fields) }) };
}

// --- Helpers ----------------------------------------------------------------
// Extraction make/model paresseuse à partir d'un titre Leboncoin libre.
// V1 : heuristique sur la taxonomie connue. V2 : table marques/modèles et fuzzy matching.
const KNOWN_MAKES = ['Toyota', 'Peugeot', 'Renault', 'Volvo', 'BMW', 'Volkswagen', 'Skoda', 'Tesla', 'Citroën', 'Audi', 'Mercedes'];

function splitMakeModelFromTitle(title) {
  if (!title) return [null, null];
  const lower = title.toLowerCase();
  for (const make of KNOWN_MAKES) {
    if (lower.startsWith(make.toLowerCase())) {
      const rest = title.slice(make.length).trim();
      const model = rest.split(' ')[0] + (rest.startsWith(' Prius+') || rest.startsWith('Prius+') ? '' : '');
      // cas spécifique: Toyota "Prius+" qu'on veut garder tel quel
      if (rest.toLowerCase().startsWith('prius+')) return [make, 'Prius+'];
      return [make, rest.split(' ')[0] || null];
    }
  }
  return [null, null];
}

function extractVersion(title, make, model) {
  if (!title || !make || !model) return null;
  const prefix = `${make} ${model}`;
  if (!title.toLowerCase().startsWith(prefix.toLowerCase())) return null;
  const rest = title.slice(prefix.length).trim();
  return rest || null;
}
