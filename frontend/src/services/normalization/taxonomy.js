// Mappings des enums et labels hétérogènes vers nos enums canoniques.

export const FUEL_MAP = {
  // canonique → variantes rencontrées (insensibles à la casse)
  petrol: ['essence', 'petrol', 'benzin', 'benzine', 'benzina', 'gasoline'],
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
  semi_automatic: ['semi-automatique', 'semi_auto', 'semi-auto', 'dsg', 'edc'],
};

export const BODY_MAP = {
  hatchback: ['hatchback', 'berline compacte'],
  sedan: ['sedan', 'berline'],
  wagon: ['wagon', 'break', 'sw', 'touring', 'combi', 'kombi'],
  suv: ['suv', '4x4'],
  mpv: ['mpv', 'monospace', '7 places'],
  coupe: ['coupe', 'coupé'],
  convertible: ['convertible', 'cabriolet', 'roadster'],
  pickup: ['pickup', 'pick-up'],
};

// Libellés de features normalisées. Les tokens bruts par source sont ramenés à ces ids.
export const FEATURE_MAP = {
  gps: ['gps', 'navigation', 'navi'],
  camera: ['camera', 'camera de recul', 'rear_camera', 'rueckfahrkamera', 'camera 360', '360_camera'],
  leather: ['cuir', 'leather', 'leder', 'cuir partiel'],
  sunroof: ['toit ouvrant', 'panorama_roof', 'toit panoramique', 'panoramic_roof', 'toit vitre'],
  carplay: ['apple carplay', 'apple_carplay', 'carplay'],
  heated_seats: ['sieges chauffants', 'heated_seats'],
  adaptive_cruise: ['regulateur adaptatif', 'adaptive_cruise', 'acc'],
  cruise_control: ['regulateur', 'cruise_control', 'tempomat'],
  bluetooth: ['bluetooth'],
  park_assist: ['park_assist', 'aide au stationnement'],
  autopilot: ['autopilot'],
  led: ['led_headlights', 'phares led'],
};

function normalizeFromMap(raw, map) {
  if (!raw) return null;
  const lower = String(raw).trim().toLowerCase();
  for (const [canonical, variants] of Object.entries(map)) {
    if (variants.some((v) => lower === v || lower.includes(v))) return canonical;
  }
  return null;
}

export function normalizeFuel(raw) { return normalizeFromMap(raw, FUEL_MAP); }
export function normalizeTransmission(raw) { return normalizeFromMap(raw, TRANSMISSION_MAP); }
export function normalizeBody(raw) { return normalizeFromMap(raw, BODY_MAP); }

export function normalizeFeatures(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = new Set();
  for (const raw of rawList) {
    const key = normalizeFromMap(raw, FEATURE_MAP);
    if (key) out.add(key);
  }
  return [...out];
}

// Parse km "215 000 km" | "215000" | 215000 → 215000 (number)
export function parseMileage(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw).replace(/[^\d.,]/g, '').replace(/\s/g, '').replace(/,/g, '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Parse "06/2014" | "2014-06" | "2014-06-01" → "2014-06-01" (ISO jour 01)
export function parseFirstRegistration(raw) {
  if (!raw) return null;
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(raw)) {
    return raw.length === 7 ? `${raw}-01` : raw;
  }
  const m = String(raw).match(/^(\d{2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1]}-01`;
  return null;
}

// Canonicalise un nom de marque/modèle : trim, suppression des espaces parasites,
// normalisation des variantes connues. "Prius +" → "Prius+", "Model 3" → "Model 3".
const MAKE_ALIASES = {
  vw: 'Volkswagen',
  'mercedes-benz': 'Mercedes',
  citroen: 'Citroën',
};

const MODEL_ALIASES = {
  'prius +': 'Prius+',
  'prius-plus': 'Prius+',
  'serie 3': 'Série 3',
  'serie 5': 'Série 5',
  'model3': 'Model 3',
};

export function normalizeMake(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const alias = MAKE_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  return trimmed;
}

export function normalizeModel(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim().replace(/\s+/g, ' ');
  const alias = MODEL_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  // Collapse whitespace around "+" : "Prius +" → "Prius+", "C-HR" reste intact.
  return trimmed.replace(/\s*\+\s*/g, '+');
}

export function yearFromAny({ year, firstRegistration }) {
  if (year) return year;
  if (firstRegistration) {
    const n = parseInt(firstRegistration.slice(0, 4), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
