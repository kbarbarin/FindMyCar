// Générateur procédural côté backend.
// Filtre à la volée sur les critères pour ne pas renvoyer 5 000 items par requête.

import {
  CATALOG,
  DEFAULT_FUELS,
  DEFAULT_TRANSMISSIONS,
  DEFAULT_COLORS_FR,
  DEFAULT_COLORS_DE,
  COMMON_FEATURES_FR,
  COMMON_FEATURES_DE,
  COMMON_FEATURES_ASC,
  CURRENT_YEAR,
} from './catalog.js';

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}
const randInt = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const chance = (rng, p) => rng() < p;
const sample = (rng, arr, n) => arr.map((v) => [rng(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, n);

function estimatePrice(msrp, year, km) {
  // Dépréciation réaliste : forte la première année, puis linéaire ~5-6%/an,
  // plancher à 35% du MSRP.
  const age = Math.max(0, CURRENT_YEAR - year);
  const ageFactor = Math.max(0.35, 0.95 - 0.055 * age);
  const base = msrp * ageFactor;
  // Pénalité km adoucie : jamais plus de 25% du prix de base.
  const kmPenalty = Math.min(base * 0.25, km * 0.02);
  return Math.max(1500, Math.round((base - kmPenalty) / 50) * 50);
}
function jitter(rng, v, pct) { return Math.round(v + v * pct * (rng() * 2 - 1)); }
function estimateKm(rng, year) {
  const age = Math.max(0, CURRENT_YEAR - year);
  const mean = age * 15000 + 2000;
  return Math.max(500, Math.round((mean + (rng() * 14000 - 7000)) / 100) * 100);
}
function estimateHp(rng, msrp) {
  if (msrp < 18000) return randInt(rng, 70, 100);
  if (msrp < 28000) return randInt(rng, 100, 140);
  if (msrp < 45000) return randInt(rng, 130, 200);
  if (msrp < 60000) return randInt(rng, 180, 280);
  return randInt(rng, 250, 440);
}

// Précalcule un gros dataset canonique unique par seed, réutilisé entre appels.
const CACHE = new Map();
function getCanonicalDataset(seed, perModelTarget) {
  const key = `${seed}:${perModelTarget}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const rng = makeRng(seed);
  const out = [];
  for (const brand of CATALOG) {
    for (const model of brand.models) {
      const [minY, maxY] = model.years;
      const count = perModelTarget + randInt(rng, -2, 3);
      for (let i = 0; i < count; i++) {
        const year = randInt(rng, minY, maxY);
        const km = estimateKm(rng, year);
        const basePrice = estimatePrice(model.msrp, year, km);
        const price = jitter(rng, basePrice, 0.08);
        out.push({
          make: brand.make,
          model: model.name,
          year, km, price,
          fuel: pick(rng, model.fuels || DEFAULT_FUELS),
          transmission: pick(rng, model.transmissions || DEFAULT_TRANSMISSIONS),
          seats: model.seats ?? (chance(rng, 0.03) ? 7 : 5),
          doors: (model.seats === 7) ? 5 : (chance(rng, 0.05) ? 3 : 5),
          firstHand: chance(rng, 0.35),
          accidentFree: chance(rng, 0.85) ? true : (chance(rng, 0.3) ? false : null),
          powerHp: estimateHp(rng, model.msrp),
        });
      }
    }
  }
  CACHE.set(key, out);
  return out;
}

// --- Format Leboncoin ----------------------------------------------------
function toLeboncoin(e, i, rng) {
  const dep = pick(rng, ['75','92','13','69','33','31','44','59','6','67']);
  const cityByDep = { '75':'Paris','92':'Nanterre','13':'Marseille','69':'Lyon','33':'Bordeaux','31':'Toulouse','44':'Nantes','59':'Lille','6':'Nice','67':'Strasbourg' };
  const fuelMap = { petrol:'Essence', diesel:'Diesel', hybrid:'Hybride', plugin_hybrid:'Hybride rechargeable', electric:'Electrique', lpg:'GPL', cng:'GNV' };
  const transMap = { manual:'Manuelle', automatic:'Automatique', semi_automatic:'Semi-automatique' };
  return {
    id: `lbc_gen_${i}`,
    titre: `${e.make} ${e.model}${e.seats === 7 ? ' 7 places' : ''}`,
    prix: e.price,
    kilometrage: `${e.km.toLocaleString('fr-FR')} km`,
    annee: e.year,
    mise_en_circulation: `${String(randInt(rng, 1, 12)).padStart(2, '0')}/${e.year}`,
    carburant: fuelMap[e.fuel] || 'Essence',
    boite: transMap[e.transmission] || 'Manuelle',
    puissance_ch: e.powerHp,
    portes: e.doors,
    places: e.seats,
    couleur: pick(rng, DEFAULT_COLORS_FR),
    departement: dep,
    ville: cityByDep[dep] || 'Paris',
    vendeur: chance(rng, 0.55) ? 'pro' : 'particulier',
    premiere_main: e.firstHand,
    options: sample(rng, COMMON_FEATURES_FR, randInt(rng, 2, 6)),
    photos: [],
    url: `https://www.leboncoin.fr/recherche?category=2&text=${encodeURIComponent(e.make + ' ' + e.model)}`,
    publie_le: recentIso(rng),
  };
}

function toLacentrale(e, i, rng) {
  const fuelMap = { petrol:'ESS', diesel:'DIE', hybrid:'HYB', plugin_hybrid:'HYR', electric:'ELE', lpg:'GPL' };
  return {
    reference: `LC-GEN-${i}`,
    marque: e.make, modele: e.model,
    finition: pick(rng, ['Active','Allure','Business','Dynamic','Lounge','Edition','Style']),
    prix_ttc: e.price,
    km: e.km,
    annee_modele: e.year,
    mec: `${e.year}-${String(randInt(rng, 1, 12)).padStart(2, '0')}-01`,
    energie: fuelMap[e.fuel] || 'ESS',
    transmission: e.transmission === 'automatic' ? 'BVA' : 'BVM',
    ch_din: e.powerHp,
    nb_portes: e.doors, nb_places: e.seats,
    couleur_ext: pick(rng, DEFAULT_COLORS_FR),
    departement: pick(rng, ['75','92','13','69','44','31','59']),
    localite: pick(rng, ['Paris','Lyon','Marseille','Bordeaux','Toulouse','Nantes','Lille']),
    type_vendeur: 'pro',
    premiere_main: e.firstHand,
    equipements: sample(rng, COMMON_FEATURES_FR, randInt(rng, 3, 6)),
    photos: [],
    deeplink: `https://www.lacentrale.fr/listing?searchQuery=${encodeURIComponent(e.make + ' ' + e.model)}`,
    mis_en_ligne: recentIso(rng),
    historique: { accident: e.accidentFree === null ? null : !e.accidentFree, carnet_complet: chance(rng, 0.7) },
  };
}

function toMobilede(e, i, rng) {
  const fuelMap = { petrol:'PETROL', diesel:'DIESEL', hybrid:'HYBRID_PETROL', plugin_hybrid:'HYBRID_PLUGIN', electric:'ELECTRIC' };
  return {
    ref: `md-gen-${i}`,
    make: e.make, model: e.model,
    trim: pick(rng, ['Comfort','Edition','Executive','Style','Sport','Premium']),
    firstRegistration: `${e.year}-${String(randInt(rng, 1, 12)).padStart(2, '0')}`,
    mileageKm: e.km,
    priceEUR: e.price,
    fuelType: fuelMap[e.fuel] || 'PETROL',
    gearbox: e.transmission === 'automatic' ? 'AUTOMATIC_GEAR' : 'MANUAL_GEAR',
    powerKW: Math.round(e.powerHp * 0.7355),
    doors: e.doors, seats: e.seats,
    color: pick(rng, DEFAULT_COLORS_DE),
    country: 'DE',
    city: pick(rng, ['München','Hamburg','Berlin','Köln','Frankfurt','Stuttgart','Düsseldorf']),
    sellerType: 'dealer',
    features: sample(rng, COMMON_FEATURES_DE, randInt(rng, 2, 5)),
    images: [],
    url: `https://suchen.mobile.de/fahrzeuge/search.html?s=Car&query=${encodeURIComponent(e.make + ' ' + e.model)}`,
    listedAt: recentIso(rng),
    accidentFree: e.accidentFree,
    fullServiceHistory: chance(rng, 0.7) ? true : null,
  };
}

function toAutoscout24(e, i, rng) {
  const cityByCountry = { BE:['Bruxelles','Antwerpen','Gent'], NL:['Amsterdam','Utrecht'], DE:['München','Berlin'], LU:['Luxembourg'], IT:['Milano','Torino'] };
  const country = pick(rng, Object.keys(cityByCountry));
  return {
    id: `as24-gen-${i}`,
    brand: e.make,
    modelName: (chance(rng, 0.1) && e.model === 'Prius+') ? 'Prius +' : e.model,
    version: `${e.powerHp}cv ${pick(rng, ['Active','Sport','Style','Premium'])}`,
    price: { value: e.price, currency: 'EUR', vatDeductible: chance(rng, 0.3) },
    mileage: { value: e.km, unit: 'km' },
    firstRegistration: `${e.year}-${String(randInt(rng, 1, 12)).padStart(2, '0')}`,
    modelYear: e.year,
    fuel: e.fuel, transmission: e.transmission,
    power: { hp: e.powerHp, kw: Math.round(e.powerHp * 0.7355) },
    body: { type: e.seats === 7 ? 'mpv' : 'hatchback', doors: e.doors, seats: e.seats, color: 'grey' },
    location: { country, region: null, city: pick(rng, cityByCountry[country]) },
    seller: { type: 'dealer', rating: Math.round((3.5 + rng() * 1.5) * 10) / 10 },
    equipment: sample(rng, COMMON_FEATURES_ASC, randInt(rng, 2, 5)),
    photos: [],
    listingUrl: `https://www.autoscout24.com/lst/${encodeURIComponent(e.make.toLowerCase())}/${encodeURIComponent(e.model.toLowerCase().replace(/\s+/g, '-'))}`,
    publishedAt: recentIso(rng),
    damageFree: e.accidentFree,
  };
}

function recentIso(rng) {
  const d = new Date(Date.UTC(CURRENT_YEAR, 3, 22) - randInt(rng, 0, 30) * 86400000);
  return d.toISOString();
}

// --- Pré-filtre par critères (limite le volume renvoyé au consommateur) ---
function matchesCriteria(entry, c) {
  if (!c) return true;
  if (c.make && String(entry.make).toLowerCase() !== String(c.make).toLowerCase()) return false;
  if (c.model && String(entry.model).toLowerCase() !== String(c.model).toLowerCase()) return false;
  if (c.yearMin != null && entry.year < c.yearMin) return false;
  if (c.yearMax != null && entry.year > c.yearMax) return false;
  if (c.mileageMin != null && entry.km < c.mileageMin) return false;
  if (c.mileageMax != null && entry.km > c.mileageMax) return false;
  if (c.priceMin != null && entry.price < c.priceMin) return false;
  if (c.priceMax != null && entry.price > c.priceMax) return false;
  if (c.fuel?.length && !c.fuel.includes(entry.fuel)) return false;
  if (c.transmission?.length && !c.transmission.includes(entry.transmission)) return false;
  return true;
}

// --- API publique ---
const SEEDS = { leboncoin: 101, lacentrale: 202, mobilede: 303, autoscout24: 404 };
const TARGETS = { leboncoin: 18, lacentrale: 14, mobilede: 12, autoscout24: 10 };
const ADAPTERS = { leboncoin: toLeboncoin, lacentrale: toLacentrale, mobilede: toMobilede, autoscout24: toAutoscout24 };

export function generateForSource(sourceId, criteria = {}) {
  const rngForFormat = makeRng(SEEDS[sourceId] ?? 42);
  const canonical = getCanonicalDataset(SEEDS[sourceId] ?? 42, TARGETS[sourceId] ?? 10);
  const filtered = canonical.filter((e) => matchesCriteria(e, criteria));
  const adapter = ADAPTERS[sourceId];
  if (!adapter) return [];
  return filtered.map((e, i) => adapter(e, i, rngForFormat));
}
