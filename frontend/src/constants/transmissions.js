export const TRANSMISSIONS = [
  { id: 'manual', label: 'Manuelle' },
  { id: 'automatic', label: 'Automatique' },
  { id: 'semi_automatic', label: 'Semi-automatique' },
];

export const TRANSMISSION_IDS = TRANSMISSIONS.map((t) => t.id);
export const TRANSMISSION_LABEL = Object.fromEntries(TRANSMISSIONS.map((t) => [t.id, t.label]));
