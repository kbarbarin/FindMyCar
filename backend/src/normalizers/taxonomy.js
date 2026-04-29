// Même logique que frontend : taxonomie → enum canoniques.

export const FUEL_MAP = {
  petrol: ['essence', 'petrol', 'benzin', 'benzine', 'gasoline'],
  diesel: ['diesel', 'die', 'gasoil', 'gazole'],
  hybrid: ['hybride', 'hybrid', 'hyb', 'hybrid_petrol', 'hybrid_diesel'],
  plugin_hybrid: ['hybride rechargeable', 'plug-in hybrid', 'phev', 'hybrid_plugin'],
  electric: ['electrique', 'électrique', 'electric', 'elektro', 'ele'],
  lpg: ['gpl', 'lpg'],
  cng: ['gnv', 'cng'],
};

export const TRANSMISSION_MAP = {
  manual: ['manuelle', 'manual', 'bvm', 'manual_gear', 'schaltgetriebe'],
  automatic: ['automatique', 'auto', 'automatic', 'bva', 'automatic_gear', 'automatik'],
  semi_automatic: ['semi-automatique', 'semi_auto', 'dsg', 'edc'],
};

function matchMap(raw, map) {
  if (!raw) return null;
  const lower = String(raw).trim().toLowerCase();
  for (const [canonical, variants] of Object.entries(map)) {
    if (variants.some((v) => lower === v || lower.includes(v))) return canonical;
  }
  return null;
}

export const normalizeFuel = (v) => matchMap(v, FUEL_MAP);
export const normalizeTransmission = (v) => matchMap(v, TRANSMISSION_MAP);

const MODEL_ALIASES = {
  'prius +': 'Prius+', 'prius-plus': 'Prius+',
  'serie 3': 'Série 3', 'serie 5': 'Série 5',
};

const MAKE_ALIASES = {
  vw: 'Volkswagen', 'mercedes-benz': 'Mercedes', mercedes: 'Mercedes',
  citroen: 'Citroën', 'citroën': 'Citroën',
  bmw: 'BMW', mg: 'MG', ds: 'DS', mini: 'MINI', seat: 'SEAT',
  audi: 'Audi', kia: 'Kia', vauxhall: 'Vauxhall',
  'alfa romeo': 'Alfa Romeo', alfa: 'Alfa Romeo',
};

// Title-case "intelligent" :
// - tokens purement alphabetiques de longueur <=3 → MAJUSCULES (RAV, GT, AMG)
// - tokens purement alphabetiques plus longs → Capitalisation simple (Prius, Auris)
// - tokens mixtes lettres+chiffres → preserve la casse d'origine avec premiere
//   lettre capitalisee (A4, M3, 320d, RAV4)
// Les separateurs (+, -, /, espaces) sont preserves tels quels.
function smartTitleCase(s) {
  return s.split(/(\s+|[+\-/])/).map((part) => {
    if (!part) return part;
    if (/^[+\-/\s]+$/.test(part)) return part;
    if (/^[a-zA-ZÀ-ÿ]+$/.test(part)) {
      if (part.length <= 3) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }
    // Mixte : capitalise la 1re lettre, garde le reste
    const firstAlpha = part.search(/[a-zA-ZÀ-ÿ]/);
    if (firstAlpha < 0) return part;
    return part.slice(0, firstAlpha) + part[firstAlpha].toUpperCase() + part.slice(firstAlpha + 1);
  }).join('');
}

export function normalizeMake(v) {
  if (!v) return null;
  const trimmed = String(v).trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (MAKE_ALIASES[lower]) return MAKE_ALIASES[lower];
  return smartTitleCase(trimmed);
}

export function normalizeModel(v) {
  if (!v) return null;
  // Retire les appendices entre parentheses : "RAV 4 (Toyota Prius)" -> "RAV 4"
  let s = String(v).replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  // Espaces multiples -> simple
  s = s.replace(/\s+/g, ' ');
  // Normalise les + colles : "Prius +" -> "Prius+"
  s = s.replace(/\s*\+\s*/g, '+');
  if (!s) return null;
  const alias = MODEL_ALIASES[s.toLowerCase()];
  if (alias) return alias;
  return smartTitleCase(s);
}

// Cle canonique pour grouper deux entrees identiques mais ecrites differemment.
// On garde alphanum + '+' (Prius+ != Prius), on jette le reste (espaces,
// hyphens, accents apres normalisation Unicode).
export function canonicalKey(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritiques
    .toLowerCase()
    .replace(/[^a-z0-9+]/g, '');
}

export function parseMileage(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const cleaned = String(v).replace(/[^\d.,]/g, '').replace(/\s/g, '').replace(/,/g, '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function parseFirstRegistration(raw) {
  if (!raw) return null;
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(raw)) return raw.length === 7 ? `${raw}-01` : raw;
  const m = String(raw).match(/^(\d{2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1]}-01`;
  return null;
}

export function yearFromAny({ year, firstRegistration }) {
  if (year) return year;
  if (firstRegistration) {
    const n = parseInt(firstRegistration.slice(0, 4), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normalizeFeatures(rawList) {
  if (!Array.isArray(rawList)) return [];
  const map = {
    gps: ['gps','navigation','navi'],
    camera: ['camera','camera de recul','rear_camera','rueckfahrkamera','360_camera'],
    leather: ['cuir','leather','leder'],
    sunroof: ['toit ouvrant','panorama_roof','panoramic_roof'],
    carplay: ['apple carplay','apple_carplay','carplay'],
    heated_seats: ['sieges chauffants','heated_seats'],
    adaptive_cruise: ['regulateur adaptatif','adaptive_cruise','acc'],
    cruise_control: ['regulateur','cruise_control','tempomat'],
    bluetooth: ['bluetooth'],
    park_assist: ['park_assist'],
    led: ['led_headlights','phares led'],
    autopilot: ['autopilot'],
  };
  const out = new Set();
  for (const raw of rawList) {
    const lower = String(raw).toLowerCase();
    for (const [key, vs] of Object.entries(map)) {
      if (vs.some((v) => lower.includes(v))) { out.add(key); break; }
    }
  }
  return [...out];
}
