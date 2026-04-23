import staticData from '../../mocks/lacentrale.json';
import { generateForSource } from '../../mocks/generator.js';
import { normalizeLacentrale } from '../normalization/normalizeListing.js';

const DATA = [...staticData, ...generateForSource('lacentrale', { perModelTarget: 14 })];

export const lacentraleConnector = {
  id: 'lacentrale',
  label: 'La Centrale',
  country: 'FR',
  enabled: true,
  priority: 1,
  capabilities: ['search_by_make', 'filter_year', 'filter_price', 'filter_mileage', 'filter_fuel'],

  async fetchListings() {
    await new Promise((r) => setTimeout(r, 120));
    return DATA;
  },

  normalize: normalizeLacentrale,
};
