// Enum canonique des carburants. Toute normalisation des sources cible ces valeurs.
export const FUELS = [
  { id: 'petrol', label: 'Essence' },
  { id: 'diesel', label: 'Diesel' },
  { id: 'hybrid', label: 'Hybride' },
  { id: 'plugin_hybrid', label: 'Hybride rechargeable' },
  { id: 'electric', label: 'Électrique' },
  { id: 'lpg', label: 'GPL' },
  { id: 'cng', label: 'GNV' },
  { id: 'other', label: 'Autre' },
];

export const FUEL_IDS = FUELS.map((f) => f.id);
export const FUEL_LABEL = Object.fromEntries(FUELS.map((f) => [f.id, f.label]));

// Familles de carburants utilisées par le suggestion engine pour proposer des alternatives.
export const FUEL_FAMILIES = {
  hybrid: ['hybrid', 'plugin_hybrid'],
  thermal: ['petrol', 'diesel'],
  electric: ['electric'],
};
