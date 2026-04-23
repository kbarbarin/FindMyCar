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

export function normalizeMake(v) {
  if (!v) return null;
  const s = String(v).trim();
  const aliases = { vw: 'Volkswagen', 'mercedes-benz': 'Mercedes', citroen: 'Citroën' };
  return aliases[s.toLowerCase()] || s;
}

export function normalizeModel(v) {
  if (!v) return null;
  const s = String(v).trim().replace(/\s+/g, ' ');
  const alias = MODEL_ALIASES[s.toLowerCase()];
  if (alias) return alias;
  return s.replace(/\s*\+\s*/g, '+');
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
