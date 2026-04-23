// Les 22 pays couverts par le catalogue de sources.
export const COUNTRIES = [
  { code: 'FR', label: 'France',     currency: 'EUR', euMember: true },
  { code: 'DE', label: 'Allemagne',  currency: 'EUR', euMember: true },
  { code: 'ES', label: 'Espagne',    currency: 'EUR', euMember: true },
  { code: 'BE', label: 'Belgique',   currency: 'EUR', euMember: true },
  { code: 'IT', label: 'Italie',     currency: 'EUR', euMember: true },
  { code: 'CH', label: 'Suisse',     currency: 'CHF', euMember: false },
  { code: 'LU', label: 'Luxembourg', currency: 'EUR', euMember: true },
  { code: 'PT', label: 'Portugal',   currency: 'EUR', euMember: true },
  { code: 'NL', label: 'Pays-Bas',   currency: 'EUR', euMember: true },
  { code: 'PL', label: 'Pologne',    currency: 'PLN', euMember: true },
  { code: 'SE', label: 'Suède',      currency: 'SEK', euMember: true },
  { code: 'NO', label: 'Norvège',    currency: 'NOK', euMember: false },
  { code: 'FI', label: 'Finlande',   currency: 'EUR', euMember: true },
  { code: 'DK', label: 'Danemark',   currency: 'DKK', euMember: true },
  { code: 'RO', label: 'Roumanie',   currency: 'RON', euMember: true },
  { code: 'BG', label: 'Bulgarie',   currency: 'BGN', euMember: true },
  { code: 'GR', label: 'Grèce',      currency: 'EUR', euMember: true },
  { code: 'LT', label: 'Lituanie',   currency: 'EUR', euMember: true },
  { code: 'LV', label: 'Lettonie',   currency: 'EUR', euMember: true },
  { code: 'EE', label: 'Estonie',    currency: 'EUR', euMember: true },
  { code: 'HU', label: 'Hongrie',    currency: 'HUF', euMember: true },
];

export const COUNTRY_LABEL = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.label]));
export const COUNTRY_CODES = COUNTRIES.map((c) => c.code);

// Distances approximatives depuis Paris (km), utilisées pour l'estimation d'import.
export const APPROX_DISTANCE_TO_PARIS_KM = {
  FR: 0,
  BE: 300, LU: 380, CH: 550, DE: 900, NL: 500,
  IT: 1050, ES: 1250, PT: 1700,
  PL: 1600, SE: 1700, NO: 1900, FI: 2500, DK: 1300,
  GR: 2800, HU: 1600, RO: 2200, BG: 2400,
  LT: 1900, LV: 2100, EE: 2400,
};
