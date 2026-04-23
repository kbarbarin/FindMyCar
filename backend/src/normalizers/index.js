// Normalizers par source. Chaque source a son format natif (mock ou scraping).
// La signature est identique à la V1 front : (raw) → NormalizedListing.

import { emptyListing, makeListingId } from '../models/listing.model.js';
import {
  normalizeFuel, normalizeTransmission, normalizeMake, normalizeModel,
  parseMileage, parseFirstRegistration, yearFromAny, normalizeFeatures,
} from './taxonomy.js';

function missingFields(l) {
  return Object.entries(l)
    .filter(([k, v]) => v == null || v === '' || (k === 'price' && v?.amount == null))
    .map(([k]) => k);
}

// --- Leboncoin ---
export function normalizeLeboncoin(raw) {
  const reconstructed = [];
  const firstRegistration = parseFirstRegistration(raw.mise_en_circulation);
  const year = yearFromAny({ year: raw.annee, firstRegistration });
  const [makeFromTitle, modelFromTitle] = extractMakeModel(raw.titre);
  const make = normalizeMake(makeFromTitle);
  const model = normalizeModel(modelFromTitle);
  const powerHp = raw.puissance_ch ?? null;
  const powerKw = powerHp ? Math.round(powerHp * 0.7355) : null;
  if (powerKw) reconstructed.push('powerKw');

  return emptyListing({
    id: makeListingId('leboncoin', raw.id),
    source: { id: 'leboncoin', label: 'Leboncoin', country: 'FR' },
    url: raw.url ?? null,
    title: raw.titre ?? null,
    make, model,
    version: extractVersion(raw.titre, make, model),
    year, firstRegistration,
    mileageKm: parseMileage(raw.kilometrage),
    price: { amount: raw.prix ?? null, currency: 'EUR' },
    fuel: normalizeFuel(raw.carburant),
    transmission: normalizeTransmission(raw.boite),
    powerHp, powerKw,
    doors: raw.portes ?? null,
    seats: raw.places ?? null,
    color: raw.couleur ?? null,
    country: 'FR',
    city: raw.ville ?? null,
    seller: { type: raw.vendeur === 'pro' ? 'dealer' : 'private', name: null, rating: null },
    features: normalizeFeatures(raw.options),
    history: { firstHand: raw.premiere_main ?? null, accidentFree: null, serviceBookComplete: null },
    photos: raw.photos ?? [],
    postedAt: raw.publie_le ?? null,
    meta: { normalizedAt: new Date().toISOString(), reconstructed, fieldsMissing: [] },
  });
}

// --- LaCentrale ---
export function normalizeLacentrale(raw) {
  const reconstructed = [];
  const firstRegistration = parseFirstRegistration(raw.mec);
  const year = yearFromAny({ year: raw.annee_modele, firstRegistration });
  const powerHp = raw.ch_din ?? null;
  const powerKw = powerHp ? Math.round(powerHp * 0.7355) : null;
  if (powerKw) reconstructed.push('powerKw');

  return emptyListing({
    id: makeListingId('lacentrale', raw.reference),
    source: { id: 'lacentrale', label: 'La Centrale', country: 'FR' },
    url: raw.deeplink ?? null,
    title: [raw.marque, raw.modele, raw.finition].filter(Boolean).join(' '),
    make: normalizeMake(raw.marque),
    model: normalizeModel(raw.modele),
    version: raw.finition ?? null,
    year, firstRegistration,
    mileageKm: parseMileage(raw.km),
    price: { amount: raw.prix_ttc ?? null, currency: 'EUR' },
    fuel: normalizeFuel(raw.energie),
    transmission: normalizeTransmission(raw.transmission),
    powerHp, powerKw,
    doors: raw.nb_portes ?? null,
    seats: raw.nb_places ?? null,
    color: raw.couleur_ext ?? null,
    country: 'FR',
    city: raw.localite ?? null,
    seller: { type: raw.type_vendeur === 'pro' ? 'dealer' : 'private', name: null, rating: null },
    features: normalizeFeatures(raw.equipements),
    history: {
      firstHand: raw.premiere_main ?? null,
      accidentFree: raw.historique?.accident === true ? false :
                    raw.historique?.accident === false ? true : null,
      serviceBookComplete: raw.historique?.carnet_complet ?? null,
    },
    photos: raw.photos ?? [],
    postedAt: raw.mis_en_ligne ?? null,
    meta: { normalizedAt: new Date().toISOString(), reconstructed, fieldsMissing: [] },
  });
}

// --- Mobile.de ---
export function normalizeMobilede(raw) {
  const reconstructed = [];
  const firstRegistration = parseFirstRegistration(raw.firstRegistration);
  const year = yearFromAny({ year: null, firstRegistration });
  if (year) reconstructed.push('year_from_first_registration');
  const powerKw = raw.powerKW ?? null;
  const powerHp = powerKw ? Math.round(powerKw / 0.7355) : null;
  if (powerHp) reconstructed.push('powerHp');

  return emptyListing({
    id: makeListingId('mobilede', raw.ref),
    source: { id: 'mobilede', label: 'Mobile.de', country: 'DE' },
    url: raw.url ?? null,
    title: [raw.make, raw.model, raw.trim].filter(Boolean).join(' '),
    make: normalizeMake(raw.make),
    model: normalizeModel(raw.model),
    version: raw.trim ?? null,
    year, firstRegistration,
    mileageKm: parseMileage(raw.mileageKm),
    price: { amount: raw.priceEUR ?? null, currency: 'EUR' },
    fuel: normalizeFuel(raw.fuelType),
    transmission: normalizeTransmission(raw.gearbox),
    powerHp, powerKw,
    doors: raw.doors ?? null,
    seats: raw.seats ?? null,
    color: raw.color ?? null,
    country: raw.country ?? 'DE',
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
    meta: { normalizedAt: new Date().toISOString(), reconstructed, fieldsMissing: [] },
  });
}

// --- AutoScout24 ---
export function normalizeAutoscout24(raw) {
  const firstRegistration = parseFirstRegistration(raw.firstRegistration);
  const year = yearFromAny({ year: raw.modelYear, firstRegistration });
  return emptyListing({
    id: makeListingId('autoscout24', raw.id),
    source: { id: 'autoscout24', label: 'AutoScout24', country: 'DE' },
    url: raw.listingUrl ?? null,
    title: [raw.brand, raw.modelName, raw.version].filter(Boolean).join(' '),
    make: normalizeMake(raw.brand),
    model: normalizeModel(raw.modelName),
    version: raw.version ?? null,
    year, firstRegistration,
    mileageKm: raw.mileage?.value ?? null,
    price: { amount: raw.price?.value ?? null, currency: raw.price?.currency ?? 'EUR' },
    fuel: normalizeFuel(raw.fuel),
    transmission: normalizeTransmission(raw.transmission),
    powerHp: raw.power?.hp ?? null,
    powerKw: raw.power?.kw ?? null,
    bodyType: raw.body?.type ?? null,
    doors: raw.body?.doors ?? null,
    seats: raw.body?.seats ?? null,
    color: raw.body?.color ?? null,
    country: raw.location?.country ?? null,
    region: raw.location?.region ?? null,
    city: raw.location?.city ?? null,
    seller: { type: raw.seller?.type ?? null, name: null, rating: raw.seller?.rating ?? null },
    features: normalizeFeatures(raw.equipment),
    history: { firstHand: null, accidentFree: raw.damageFree ?? null, serviceBookComplete: null },
    photos: raw.photos ?? [],
    postedAt: raw.publishedAt ?? null,
    meta: { normalizedAt: new Date().toISOString(), reconstructed: [], fieldsMissing: [] },
  });
}

// --- ParuVendu ---
// ParuVendu renvoie du HTML simple. Le scraper extrait par sélecteur.
export function normalizeParuVendu(raw) {
  const [makeFromTitle, modelFromTitle] = extractMakeModel(raw.titre || '');
  return emptyListing({
    id: makeListingId('paruvendu', raw.id),
    source: { id: 'paruvendu', label: 'ParuVendu', country: 'FR' },
    url: raw.url ?? null,
    title: raw.titre ?? null,
    make: normalizeMake(makeFromTitle),
    model: normalizeModel(modelFromTitle),
    version: null,
    year: raw.annee ?? null,
    firstRegistration: null,
    mileageKm: parseMileage(raw.km),
    price: { amount: raw.prix ?? null, currency: 'EUR' },
    fuel: normalizeFuel(raw.carburant),
    transmission: normalizeTransmission(raw.boite),
    powerHp: raw.puissance ?? null,
    powerKw: raw.puissance ? Math.round(raw.puissance * 0.7355) : null,
    country: 'FR',
    city: raw.ville ?? null,
    seller: { type: raw.vendeur || 'private', name: null, rating: null },
    features: [],
    history: { firstHand: null, accidentFree: null, serviceBookComplete: null },
    photos: raw.photos ?? [],
    postedAt: raw.publie_le ?? null,
    meta: { normalizedAt: new Date().toISOString(), reconstructed: [], fieldsMissing: [] },
  });
}

// --- Subito ---
export function normalizeSubito(raw) {
  const year = raw.year ?? (raw.firstRegistration ? parseInt(String(raw.firstRegistration).slice(0, 4), 10) : null);
  return emptyListing({
    id: makeListingId('subito', raw.id),
    source: { id: 'subito', label: 'Subito', country: 'IT' },
    url: raw.url ?? null,
    title: raw.title ?? [raw.make, raw.model].filter(Boolean).join(' '),
    make: normalizeMake(raw.make),
    model: normalizeModel(raw.model),
    version: raw.version ?? null,
    year,
    firstRegistration: raw.firstRegistration ?? null,
    mileageKm: parseMileage(raw.mileage),
    price: { amount: raw.price ?? null, currency: 'EUR' },
    fuel: normalizeFuel(raw.fuel),
    transmission: normalizeTransmission(raw.transmission),
    powerHp: raw.powerHp ?? null,
    powerKw: raw.powerHp ? Math.round(raw.powerHp * 0.7355) : null,
    country: 'IT',
    region: raw.region ?? null,
    city: raw.city ?? null,
    seller: { type: raw.seller || 'private', name: null, rating: null },
    features: [],
    history: { firstHand: null, accidentFree: null, serviceBookComplete: null },
    photos: raw.photos ?? [],
    postedAt: raw.postedAt ?? null,
    meta: { normalizedAt: new Date().toISOString(), reconstructed: [], fieldsMissing: [] },
  });
}

// --- Marktplaats ---
export function normalizeMarktplaats(raw) {
  return emptyListing({
    id: makeListingId('marktplaats', raw.id),
    source: { id: 'marktplaats', label: 'Marktplaats', country: 'NL' },
    url: raw.url ?? null,
    title: raw.title ?? null,
    make: normalizeMake(raw.make),
    model: normalizeModel(raw.model),
    version: null,
    year: raw.year ?? null,
    mileageKm: parseMileage(raw.mileage),
    price: { amount: raw.price ?? null, currency: 'EUR' },
    fuel: normalizeFuel(raw.fuel),
    transmission: normalizeTransmission(raw.transmission),
    powerHp: null, powerKw: null,
    country: 'NL',
    city: raw.city ?? null,
    seller: { type: raw.seller || 'private', name: raw.sellerName ?? null, rating: null },
    features: [],
    history: { firstHand: null, accidentFree: null, serviceBookComplete: null },
    photos: raw.photos ?? [],
    postedAt: raw.postedAt ?? null,
    meta: { normalizedAt: new Date().toISOString(), reconstructed: [], fieldsMissing: [] },
  });
}

// --- Auto24.ee ---
export function normalizeAuto24(raw) {
  return emptyListing({
    id: makeListingId('auto24', raw.id),
    source: { id: 'auto24', label: 'Auto24', country: 'EE' },
    url: raw.url ?? null,
    title: raw.title ?? [raw.make, raw.model].filter(Boolean).join(' '),
    make: normalizeMake(raw.make),
    model: normalizeModel(raw.model),
    version: null,
    year: raw.year ?? null,
    mileageKm: parseMileage(raw.mileage),
    price: { amount: raw.price ?? null, currency: 'EUR' },
    fuel: normalizeFuel(raw.fuel),
    transmission: normalizeTransmission(raw.transmission),
    powerHp: raw.powerHp ?? null, powerKw: null,
    country: 'EE',
    city: raw.city ?? null,
    seller: { type: raw.seller || 'private', name: null, rating: null },
    features: [],
    history: { firstHand: null, accidentFree: null, serviceBookComplete: null },
    photos: raw.photos ?? [],
    postedAt: null,
    meta: { normalizedAt: new Date().toISOString(), reconstructed: [], fieldsMissing: [] },
  });
}

// Helpers pour Leboncoin (titre libre)
const KNOWN_MAKES = ['Toyota','Peugeot','Renault','Volvo','BMW','Volkswagen','Skoda','Tesla','Citroën','Audi','Mercedes','Kia','Hyundai','Ford','Dacia','Nissan','Opel','Fiat','SEAT'];
function extractMakeModel(title) {
  if (!title) return [null, null];
  const lower = title.toLowerCase();
  for (const make of KNOWN_MAKES) {
    if (lower.startsWith(make.toLowerCase())) {
      const rest = title.slice(make.length).trim();
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
  return title.slice(prefix.length).trim() || null;
}
