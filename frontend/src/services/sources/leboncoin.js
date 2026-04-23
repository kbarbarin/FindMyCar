import staticData from '../../mocks/leboncoin.json';
import { generateForSource } from '../../mocks/generator.js';
import { normalizeLeboncoin } from '../normalization/normalizeListing.js';

const DATA = [...staticData, ...generateForSource('leboncoin', { perModelTarget: 18 })];

export const leboncoinConnector = {
  id: 'leboncoin',
  label: 'Leboncoin',
  country: 'FR',
  enabled: true,
  priority: 1,
  capabilities: ['search_by_make', 'filter_year', 'filter_price', 'filter_mileage'],

  async fetchListings() {
    await new Promise((r) => setTimeout(r, 80));
    return DATA;
  },

  normalize: normalizeLeboncoin,
};
