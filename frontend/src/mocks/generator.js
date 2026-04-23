// Générateur procédural déterministe.
// Même seed → même sortie. Aucune dépendance réseau. Appelé 1× au bootstrap du
// connector correspondant.

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

// --- RNG déterministe (LCG) ----------------------------------------------
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}
const rand = (rng) => rng();
const randInt = (rng, min, max) => Math.floor(rand(rng) * (max - min + 1)) + min;
const pick = (rng, arr) => arr[Math.floor(rand(rng) * arr.length)];
const chance = (rng, p) => rand(rng) < p;

// --- Modèle de prix réaliste ---------------------------------------------
// depreciation: 70% sur 6 ans environ → 1 - 0.18 * age pour les premières années,
// plancher à 20% du MSRP, puis kmPenalty = 0.04€/km.
function estimatePrice(msrp, year, km) {
  const age = Math.max(0, CURRENT_YEAR - year);
  const ageFactor = Math.max(0.35, 0.95 - 0.055 * age);
  const base = msrp * ageFactor;
  const kmPenalty = Math.min(base * 0.25, km * 0.02);
  return Math.max(1500, Math.round((base - kmPenalty) / 50) * 50);
}

function jitter(rng, value, pct) {
  const delta = value * pct * (rand(rng) * 2 - 1);
  return Math.round(value + delta);
}

// Km typique pour l'âge : ~15 000 km/an ± 6 000.
function estimateKm(rng, year) {
  const age = Math.max(0, CURRENT_YEAR - year);
  const mean = age * 15000 + 2000;
  return Math.max(500, Math.round((mean + (rand(rng) * 14000 - 7000)) / 100) * 100);
}

// --- Génération brute par modèle, puis reformat par source ---------------
// On produit d'abord une forme canonique puis on traduit vers le format natif
// de chaque source. Ça garde le catalogue DRY.
function generateCanonical(rng, { perModelTarget = 8 } = {}) {
  const out = [];
  for (const brand of CATALOG) {
    for (const model of brand.models) {
      const [minY, maxY] = model.years;
      const yearsSpan = maxY - minY + 1;
      // Distribution : plus de variantes sur les années récentes.
      const count = perModelTarget + randInt(rng, -2, 3);
      for (let i = 0; i < count; i++) {
        const year = randInt(rng, minY, maxY);
        const km = estimateKm(rng, year);
        const basePrice = estimatePrice(model.msrp, year, km);
        const price = jitter(rng, basePrice, 0.08);
        const fuel = pick(rng, model.fuels || DEFAULT_FUELS);
        const transmission = pick(rng, model.transmissions || DEFAULT_TRANSMISSIONS);
        const seats = model.seats ?? (chance(rng, 0.03) ? 7 : 5);
        const doors = seats === 7 ? 5 : chance(rng, 0.05) ? 3 : 5;
        out.push({
          make: brand.make,
          model: model.name,
          year,
          km,
          price,
          fuel,
          transmission,
          seats,
          doors,
          firstHand: chance(rng, 0.35),
          accidentFree: chance(rng, 0.85) ? true : (chance(rng, 0.3) ? false : null),
          powerHp: estimateHp(rng, model.msrp),
        });
      }
    }
  }
  return out;
}

function estimateHp(rng, msrp) {
  // MSRP → ordre de grandeur de puissance
  if (msrp < 18000) return randInt(rng, 70, 100);
  if (msrp < 28000) return randInt(rng, 100, 140);
  if (msrp < 45000) return randInt(rng, 130, 200);
  if (msrp < 60000) return randInt(rng, 180, 280);
  return randInt(rng, 250, 440);
}

// --- Format Leboncoin ----------------------------------------------------
function toLeboncoin(entry, idx, rng) {
  const depRng = [75, 92, 13, 69, 33, 31, 44, 59, 6, 67];
  const cities = { 75: 'Paris', 92: 'Nanterre', 13: 'Marseille', 69: 'Lyon', 33: 'Bordeaux', 31: 'Toulouse', 44: 'Nantes', 59: 'Lille', 6: 'Nice', 67: 'Strasbourg' };
  const dep = pick(rng, depRng);
  const month = String(randInt(rng, 1, 12)).padStart(2, '0');
  return {
    id: `lbc_gen_${idx}`,
    titre: `${entry.make} ${entry.model}${entry.seats === 7 ? ' 7 places' : ''}`,
    prix: entry.price,
    kilometrage: `${entry.km.toLocaleString('fr-FR')} km`,
    annee: entry.year,
    mise_en_circulation: `${month}/${entry.year}`,
    carburant: fuelToFr(entry.fuel),
    boite: transmissionToFr(entry.transmission),
    puissance_ch: entry.powerHp,
    portes: entry.doors,
    places: entry.seats,
    couleur: pick(rng, DEFAULT_COLORS_FR),
    departement: String(dep),
    ville: cities[dep] || 'Paris',
    vendeur: chance(rng, 0.55) ? 'pro' : 'particulier',
    premiere_main: entry.firstHand,
    options: sample(rng, COMMON_FEATURES_FR, randInt(rng, 2, 6)),
    photos: [],
    url: `https://www.leboncoin.fr/recherche?category=2&text=${encodeURIComponent(entry.make + ' ' + entry.model)}`,
    publie_le: randomRecentIso(rng),
  };
}

// --- Format LaCentrale ---------------------------------------------------
function toLacentrale(entry, idx, rng) {
  return {
    reference: `LC-GEN-${idx}`,
    marque: entry.make,
    modele: entry.model,
    finition: pick(rng, ['Active', 'Allure', 'Business', 'Dynamic', 'Lounge', 'Edition', 'Style']),
    prix_ttc: entry.price,
    km: entry.km,
    annee_modele: entry.year,
    mec: `${entry.year}-${String(randInt(rng, 1, 12)).padStart(2, '0')}-01`,
    energie: fuelToLcCode(entry.fuel),
    transmission: entry.transmission === 'automatic' ? 'BVA' : entry.transmission === 'manual' ? 'BVM' : 'BVA',
    ch_din: entry.powerHp,
    nb_portes: entry.doors,
    nb_places: entry.seats,
    couleur_ext: pick(rng, DEFAULT_COLORS_FR),
    departement: pick(rng, ['75', '92', '13', '69', '44', '31', '59']),
    localite: pick(rng, ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Toulouse', 'Nantes', 'Lille']),
    type_vendeur: 'pro',
    premiere_main: entry.firstHand,
    equipements: sample(rng, COMMON_FEATURES_FR, randInt(rng, 3, 6)),
    photos: [],
    deeplink: `https://www.lacentrale.fr/listing?searchQuery=${encodeURIComponent(entry.make + ' ' + entry.model)}`,
    mis_en_ligne: randomRecentIso(rng),
    historique: {
      accident: entry.accidentFree === null ? null : !entry.accidentFree,
      carnet_complet: chance(rng, 0.7),
    },
  };
}

// --- Format Mobile.de (allemand) -----------------------------------------
function toMobilede(entry, idx, rng) {
  const cities = ['München', 'Hamburg', 'Berlin', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig'];
  return {
    ref: `md-gen-${idx}`,
    make: entry.make,
    model: entry.model,
    trim: pick(rng, ['Comfort', 'Edition', 'Executive', 'Style', 'Sport', 'Premium']),
    firstRegistration: `${entry.year}-${String(randInt(rng, 1, 12)).padStart(2, '0')}`,
    mileageKm: entry.km,
    priceEUR: entry.price,
    fuelType: fuelToMdCode(entry.fuel),
    gearbox: entry.transmission === 'automatic' ? 'AUTOMATIC_GEAR' : 'MANUAL_GEAR',
    powerKW: Math.round(entry.powerHp * 0.7355),
    doors: entry.doors,
    seats: entry.seats,
    color: pick(rng, DEFAULT_COLORS_DE),
    country: 'DE',
    city: pick(rng, cities),
    sellerType: 'dealer',
    features: sample(rng, COMMON_FEATURES_DE, randInt(rng, 2, 5)),
    images: [],
    url: `https://suchen.mobile.de/fahrzeuge/search.html?s=Car&query=${encodeURIComponent(entry.make + ' ' + entry.model)}`,
    listedAt: randomRecentIso(rng),
    accidentFree: entry.accidentFree,
    fullServiceHistory: chance(rng, 0.7) ? true : null,
  };
}

// --- Format AutoScout24 --------------------------------------------------
function toAutoscout24(entry, idx, rng) {
  const countries = ['BE', 'NL', 'DE', 'LU', 'IT'];
  const cityByCountry = {
    BE: ['Bruxelles', 'Antwerpen', 'Leuven', 'Gent'],
    NL: ['Amsterdam', 'Rotterdam', 'Utrecht'],
    DE: ['München', 'Berlin', 'Hamburg'],
    LU: ['Luxembourg'],
    IT: ['Milano', 'Torino', 'Roma'],
  };
  const country = pick(rng, countries);
  return {
    id: `as24-gen-${idx}`,
    brand: entry.make,
    // variation volontaire : 10% du temps on écrit "Prius +" (espace) pour tester la normalisation.
    modelName: (chance(rng, 0.1) && entry.model === 'Prius+') ? 'Prius +' : entry.model,
    version: `${entry.powerHp}cv ${pick(rng, ['Active', 'Sport', 'Style', 'Premium'])}`,
    price: { value: entry.price, currency: 'EUR', vatDeductible: chance(rng, 0.3) },
    mileage: { value: entry.km, unit: 'km' },
    firstRegistration: `${entry.year}-${String(randInt(rng, 1, 12)).padStart(2, '0')}`,
    modelYear: entry.year,
    fuel: entry.fuel,
    transmission: entry.transmission,
    power: { hp: entry.powerHp, kw: Math.round(entry.powerHp * 0.7355) },
    body: { type: entry.seats === 7 ? 'mpv' : 'hatchback', doors: entry.doors, seats: entry.seats, color: 'grey' },
    location: { country, region: null, city: pick(rng, cityByCountry[country]) },
    seller: { type: 'dealer', rating: Math.round((3.5 + rand(rng) * 1.5) * 10) / 10 },
    equipment: sample(rng, COMMON_FEATURES_ASC, randInt(rng, 2, 5)),
    photos: [],
    listingUrl: `https://www.autoscout24.com/lst/${encodeURIComponent(entry.make.toLowerCase())}/${encodeURIComponent(entry.model.toLowerCase().replace(/\s+/g, '-'))}`,
    publishedAt: randomRecentIso(rng),
    damageFree: entry.accidentFree,
  };
}

// --- Helpers format -----------------------------------------------------
function fuelToFr(f) {
  return { petrol: 'Essence', diesel: 'Diesel', hybrid: 'Hybride', plugin_hybrid: 'Hybride rechargeable', electric: 'Electrique', lpg: 'GPL', cng: 'GNV' }[f] || 'Essence';
}
function fuelToLcCode(f) {
  return { petrol: 'ESS', diesel: 'DIE', hybrid: 'HYB', plugin_hybrid: 'HYR', electric: 'ELE', lpg: 'GPL' }[f] || 'ESS';
}
function fuelToMdCode(f) {
  return { petrol: 'PETROL', diesel: 'DIESEL', hybrid: 'HYBRID_PETROL', plugin_hybrid: 'HYBRID_PLUGIN', electric: 'ELECTRIC' }[f] || 'PETROL';
}
function transmissionToFr(t) {
  return { manual: 'Manuelle', automatic: 'Automatique', semi_automatic: 'Semi-automatique' }[t] || 'Manuelle';
}
function sample(rng, arr, n) {
  const shuffled = arr.map((v) => [rand(rng), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  return shuffled.slice(0, n);
}
function randomRecentIso(rng) {
  const daysAgo = randInt(rng, 0, 30);
  const d = new Date(Date.UTC(CURRENT_YEAR, 3, 22) - daysAgo * 86400000);
  return d.toISOString();
}

// --- API publique --------------------------------------------------------
// Chaque source a sa propre seed pour diversifier les tirages
export function generateForSource(sourceId, { perModelTarget } = {}) {
  const seed = {
    leboncoin: 101,
    lacentrale: 202,
    mobilede: 303,
    autoscout24: 404,
  }[sourceId] ?? 42;
  const rng = makeRng(seed);
  const canonical = generateCanonical(rng, { perModelTarget });

  switch (sourceId) {
    case 'leboncoin':  return canonical.map((e, i) => toLeboncoin(e, i, rng));
    case 'lacentrale': return canonical.map((e, i) => toLacentrale(e, i, rng));
    case 'mobilede':
      // Mobile.de = source allemande → ne garder qu'une part cohérente des marques.
      return canonical.map((e, i) => toMobilede(e, i, rng));
    case 'autoscout24':
      return canonical.map((e, i) => toAutoscout24(e, i, rng));
    default: return [];
  }
}
