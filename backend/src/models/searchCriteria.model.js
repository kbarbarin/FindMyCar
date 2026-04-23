// Parse les query params HTTP en critères structurés.
// Miroir du format URL utilisé côté frontend.

const ARRAY_KEYS = new Set(['fuel', 'transmission', 'countries', 'sources', 'features']);
const NUMBER_KEYS = new Set(['yearMin','yearMax','mileageMin','mileageMax','priceMin','priceMax','page','pageSize']);
const BOOL_KEYS = new Set(['firstHandOnly', 'importFriendly']);

export function criteriaFromQuery(query) {
  const out = {};
  for (const [key, rawValue] of Object.entries(query)) {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (value == null || value === '') continue;
    if (ARRAY_KEYS.has(key)) {
      out[key] = String(value).split(',').map((s) => s.trim()).filter(Boolean);
    } else if (NUMBER_KEYS.has(key)) {
      const n = Number(value);
      if (Number.isFinite(n)) out[key] = n;
    } else if (BOOL_KEYS.has(key)) {
      out[key] = value === '1' || value === 'true';
    } else if (key === 'make' || key === 'model') {
      out[key] = String(value).trim().replace(/\s*\+\s*/g, '+');
    } else {
      out[key] = String(value);
    }
  }
  return out;
}
