// Parser de requête naturelle → SearchCriteria.
//
// Pipeline (cf. parser.md pour les détails) :
//   1. Normaliser le texte (lowercase, diacritiques, ponctuation, nombres "k"/espaces)
//   2. Extraire les motifs structurés dans cet ordre (chacun "consomme" sa tranche) :
//        a) années       : "moins de 10 ans", "après 2018", "2016+", "entre 2015 et 2020"
//        b) kilométrage  : "plus de 200 000 km", "<150k km", "entre 50 000 et 100 000 km"
//        c) prix         : "budget 15 000 €", "< 20k", "moins de 18 000"
//        d) carburant    : "hybride", "diesel", "électrique"
//        e) boîte        : "automatique", "BVA", "manuelle", "BVM"
//        f) pays         : "France", "Allemagne", "FR", "DE"
//        g) options      : "première main", "sans accident"
//   3. Sur les tokens RESTANTS, fuzzy-match marque puis modèle (plus long d'abord).
//   4. Le texte restant devient q (utile seulement si aucun make/model trouvé).
//
// L'objectif est que le parser soit TOLÉRANT : une phrase partielle, une faute
// de frappe mineure, un ordre libre, doivent produire les mêmes critères.

import { CATALOG, CURRENT_YEAR } from '../../mocks/catalog.js';
import { FUELS } from '../../constants/fuels.js';
import { TRANSMISSIONS } from '../../constants/transmissions.js';
import { COUNTRIES } from '../../constants/countries.js';
import { normalizeMake, normalizeModel } from '../normalization/taxonomy.js';

// --- 1. Normalisation ----------------------------------------------------
function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeInput(raw) {
  return stripDiacritics(String(raw))
    .toLowerCase()
    // virgules décimales → points (pour éviter les confusions dans les nombres)
    .replace(/(\d),(\d)/g, '$1.$2')
    // "15k" → "15000", "1.5k" → "1500"
    .replace(/(\d+(?:\.\d+)?)\s*k(?:m|€)?\b/g, (_, n) => String(Math.round(parseFloat(n) * 1000)))
    // "200 000" → "200000" (compact les nombres avec espaces internes)
    .replace(/(\d)\s+(\d{3}(?!\d))/g, '$1$2')
    .replace(/(\d)\s+(\d{3}(?!\d))/g, '$1$2') // second passage pour les grands nombres
    // ponctuation résiduelle (mais on garde + et - pour prix/km/modèles type "Prius+")
    .replace(/[.,;:!?"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- 2. Extracteurs ------------------------------------------------------
// Chaque extracteur consomme le texte et retourne { text: resteDuTexte, patch }.

const YEAR_NOW = CURRENT_YEAR;

function extractYears(text) {
  const patch = {};
  let remaining = text;

  // "moins de X ans" → yearMin
  remaining = remaining.replace(/(?:moins\s+de|max(?:imum)?|<=?)\s*(\d{1,2})\s*ans?/g, (_, n) => {
    patch.yearMin = YEAR_NOW - parseInt(n, 10);
    return ' ';
  });
  // "plus de X ans" → yearMax
  remaining = remaining.replace(/(?:plus\s+de|min(?:imum)?|>=?)\s*(\d{1,2})\s*ans?/g, (_, n) => {
    patch.yearMax = YEAR_NOW - parseInt(n, 10);
    return ' ';
  });
  // "après YYYY" → yearMin
  remaining = remaining.replace(/\b(?:apres|depuis|a\s+partir\s+de|from)\s+(20\d{2}|19\d{2})\b/g, (_, y) => {
    patch.yearMin = Math.max(patch.yearMin ?? 0, parseInt(y, 10));
    return ' ';
  });
  // "avant YYYY" → yearMax
  remaining = remaining.replace(/\b(?:avant|jusqu'?a|before)\s+(20\d{2}|19\d{2})\b/g, (_, y) => {
    patch.yearMax = Math.min(patch.yearMax ?? 9999, parseInt(y, 10));
    return ' ';
  });
  // "YYYY+" → yearMin
  remaining = remaining.replace(/\b(20\d{2}|19\d{2})\+\b/g, (_, y) => {
    patch.yearMin = parseInt(y, 10);
    return ' ';
  });
  // "entre YYYY et YYYY" → plage
  remaining = remaining.replace(/\bentre\s+(20\d{2}|19\d{2})\s+et\s+(20\d{2}|19\d{2})\b/g, (_, a, b) => {
    const [lo, hi] = [parseInt(a, 10), parseInt(b, 10)].sort((x, y) => x - y);
    patch.yearMin = lo;
    patch.yearMax = hi;
    return ' ';
  });
  // "YYYY-YYYY" ou "YYYY à YYYY" → plage
  remaining = remaining.replace(/\b(20\d{2})\s*(?:-|a)\s*(20\d{2})\b/g, (m, a, b) => {
    // On se méfie : "2018 a 2020" est une plage, mais "lbc a 2019" n'en est pas.
    const [lo, hi] = [parseInt(a, 10), parseInt(b, 10)].sort((x, y) => x - y);
    if (hi - lo <= 20) { patch.yearMin = lo; patch.yearMax = hi; return ' '; }
    return m;
  });

  return { text: remaining, patch };
}

function extractMileage(text) {
  const patch = {};
  let remaining = text;

  // "entre X et Y km"
  remaining = remaining.replace(/\bentre\s+(\d+)\s+et\s+(\d+)\s*(?:km|kms)?\b/g, (m, a, b) => {
    const lo = parseInt(a, 10); const hi = parseInt(b, 10);
    if (lo >= 1000 || hi >= 1000) {
      patch.mileageMin = Math.min(lo, hi);
      patch.mileageMax = Math.max(lo, hi);
      return ' ';
    }
    return m;
  });
  // "moins de X km", "<X km", "maxX km"
  remaining = remaining.replace(/(?:moins\s+de|max(?:imum)?|<=?|sous)\s*(\d+)\s*(?:km|kms)\b/g, (_, n) => {
    const v = parseInt(n, 10);
    if (v >= 1000) patch.mileageMax = v;
    return ' ';
  });
  // "plus de X km", ">X km", "minX km"
  remaining = remaining.replace(/(?:plus\s+de|min(?:imum)?|>=?|au\s+moins)\s*(\d+)\s*(?:km|kms)\b/g, (_, n) => {
    const v = parseInt(n, 10);
    if (v >= 1000) patch.mileageMin = v;
    return ' ';
  });
  return { text: remaining, patch };
}

function extractPrice(text) {
  const patch = {};
  let remaining = text;

  // "entre X et Y €"
  remaining = remaining.replace(/\bentre\s+(\d+)\s+et\s+(\d+)\s*(?:€|eur|euros?)\b/g, (m, a, b) => {
    const lo = parseInt(a, 10); const hi = parseInt(b, 10);
    patch.priceMin = Math.min(lo, hi);
    patch.priceMax = Math.max(lo, hi);
    return ' ';
  });
  // "budget X €" → priceMax
  remaining = remaining.replace(/\bbudget\s*(?:max\s*)?(\d+)\s*(?:€|eur|euros?)?\b/g, (_, n) => {
    const v = parseInt(n, 10);
    if (v >= 500 && v <= 500000) patch.priceMax = v;
    return ' ';
  });
  // "moins de X €", "<X €", "sous X€", "max X €"
  remaining = remaining.replace(/(?:moins\s+de|max(?:imum)?|<=?|sous|jusqu'?a)\s*(\d+)\s*(?:€|eur|euros?)\b/g, (_, n) => {
    const v = parseInt(n, 10);
    if (v >= 500 && v <= 500000) patch.priceMax = v;
    return ' ';
  });
  // "plus de X €", ">X €"
  remaining = remaining.replace(/(?:plus\s+de|min(?:imum)?|>=?|a\s+partir\s+de)\s*(\d+)\s*(?:€|eur|euros?)\b/g, (_, n) => {
    const v = parseInt(n, 10);
    if (v >= 500 && v <= 500000) patch.priceMin = v;
    return ' ';
  });

  return { text: remaining, patch };
}

function extractFuel(text) {
  const patch = {};
  let remaining = text;
  const found = new Set();
  for (const f of FUELS) {
    const label = stripDiacritics(f.label).toLowerCase();
    const re = new RegExp(`\\b${escapeRegExp(label)}\\b`, 'g');
    if (re.test(remaining)) {
      found.add(f.id);
      remaining = remaining.replace(re, ' ');
    }
  }
  if (found.size) patch.fuel = [...found];
  return { text: remaining, patch };
}

function extractTransmission(text) {
  const patch = {};
  let remaining = text;
  const aliases = {
    automatic: ['automatique', 'boite auto', 'bva', 'auto ', 'dsg'],
    manual: ['manuelle', 'boite manuelle', 'bvm'],
    semi_automatic: ['semi-automatique', 'semi automatique', 'pilotee'],
  };
  const found = new Set();
  for (const id of Object.keys(aliases)) {
    for (const alias of aliases[id]) {
      const re = new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'g');
      if (re.test(remaining)) { found.add(id); remaining = remaining.replace(re, ' '); }
    }
  }
  if (found.size) patch.transmission = [...found];
  return { text: remaining, patch };
}

function extractCountries(text) {
  const patch = {};
  let remaining = text;
  const aliases = {
    FR: ['france', 'francais', 'francaise'],
    DE: ['allemagne', 'allemand', 'germany', 'deutschland'],
    BE: ['belgique', 'belge', 'belgium'],
    NL: ['pays-bas', 'pays bas', 'hollande', 'netherlands'],
    IT: ['italie', 'italy'],
    ES: ['espagne', 'spain'],
    CH: ['suisse', 'switzerland'],
    LU: ['luxembourg'],
  };
  // Labels depuis la constante (sécurité cohérence)
  for (const c of COUNTRIES) {
    const lbl = stripDiacritics(c.label).toLowerCase();
    if (!aliases[c.code]) aliases[c.code] = [];
    if (!aliases[c.code].includes(lbl)) aliases[c.code].push(lbl);
  }

  const found = new Set();
  for (const code of Object.keys(aliases)) {
    for (const alias of aliases[code]) {
      const re = new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'g');
      if (re.test(remaining)) { found.add(code); remaining = remaining.replace(re, ' '); }
    }
  }
  // On ne tente PAS de matcher les codes ISO bruts ("fr", "de", "es") : trop de
  // collisions avec les mots de langue ("de" / "es" sont extrêmement courants en
  // français). Si l'utilisateur veut filtrer par pays, il écrit le nom complet.
  if (found.size) patch.countries = [...found];
  return { text: remaining, patch };
}

function extractFlags(text) {
  const patch = {};
  let remaining = text;
  if (/\bpremiere\s+main\b/.test(remaining)) {
    patch.firstHandOnly = true;
    remaining = remaining.replace(/\bpremiere\s+main\b/g, ' ');
  }
  if (/\bsans\s+accident\b/.test(remaining)) {
    // pas de filtre dédié en V1, on garde dans q
  }
  if (/\bimport(?:e|able|er)?\b/.test(remaining)) {
    patch.importFriendly = true;
    remaining = remaining.replace(/\bimport(?:e|able|er)?\b/g, ' ');
  }
  return { text: remaining, patch };
}

// --- 3. Fuzzy match marque + modèle --------------------------------------
// On construit des listes précompilées à partir du catalogue.
const KNOWN_MAKES = (() => {
  const set = new Set();
  for (const b of CATALOG) set.add(b.make);
  // alias manuels
  set.add('VW'); // → Volkswagen
  set.add('Citroen'); // sans cédille
  return [...set];
})();

const MODELS_BY_MAKE = (() => {
  const map = {};
  for (const b of CATALOG) map[b.make] = b.models.map((m) => m.name);
  return map;
})();

function fuzzyMakeModel(text) {
  // Normalise encore (les diacritiques sont déjà tombés, mais on refait lowercase pour sûreté)
  const hay = text.toLowerCase();
  let foundMake = null;
  let foundMakeRaw = null;
  for (const make of [...KNOWN_MAKES].sort((a, b) => b.length - a.length)) {
    const makeL = stripDiacritics(make).toLowerCase();
    const re = new RegExp(`\\b${escapeRegExp(makeL)}\\b`);
    if (re.test(hay)) {
      foundMakeRaw = make;
      foundMake = normalizeMake(make);
      break;
    }
  }
  if (!foundMake) return { make: null, model: null, consumed: null };

  // Lister les modèles possibles pour cette marque + alias
  const canonicalMake = foundMake;
  const modelAlias = { Volkswagen: 'Volkswagen', VW: 'Volkswagen', Citroen: 'Citroën' };
  const lookupMake = modelAlias[foundMakeRaw] || foundMakeRaw;
  const models = MODELS_BY_MAKE[lookupMake] || MODELS_BY_MAKE[canonicalMake] || [];

  let foundModel = null;
  for (const m of [...models].sort((a, b) => b.length - a.length)) {
    const mL = stripDiacritics(m).toLowerCase();
    // Tolérance aux variantes "Prius+" / "Prius +"
    const pattern = escapeRegExp(mL).replace(/\\\+/g, '\\s*\\+');
    const re = new RegExp(`(^|\\s)${pattern}(\\s|$|\\+)`);
    if (re.test(hay)) { foundModel = normalizeModel(m); break; }
  }

  return {
    make: canonicalMake,
    model: foundModel,
    consumed: `${foundMakeRaw}${foundModel ? ' ' + foundModel : ''}`,
  };
}

// --- 4. Orchestration ----------------------------------------------------
export function parseText(raw) {
  const patch = {};
  if (!raw || typeof raw !== 'string' || !raw.trim()) return patch;
  patch.q = raw.trim();

  let text = normalizeInput(raw);

  // Ordre d'extraction : structurés d'abord, pour nettoyer le bruit.
  const steps = [extractYears, extractMileage, extractPrice, extractFuel, extractTransmission, extractCountries, extractFlags];
  for (const step of steps) {
    const { text: rest, patch: p } = step(text);
    Object.assign(patch, p);
    text = rest;
  }

  // Fuzzy match marque/modèle sur ce qui reste.
  const { make, model } = fuzzyMakeModel(text);
  if (make) patch.make = make;
  if (model) patch.model = model;

  return patch;
}

// --- Utils ---------------------------------------------------------------
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
