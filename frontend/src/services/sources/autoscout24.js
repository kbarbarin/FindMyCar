import staticData from '../../mocks/autoscout24.json';
import { generateForSource } from '../../mocks/generator.js';
import { normalizeAutoscout24 } from '../normalization/normalizeListing.js';

const DATA = [...staticData, ...generateForSource('autoscout24', { perModelTarget: 10 })];

export const autoscout24Connector = {
  id: 'autoscout24',
  label: 'AutoScout24',
  country: 'DE',
  enabled: true,
  priority: 2,
  capabilities: ['search_by_make', 'filter_year', 'filter_price', 'filter_mileage', 'filter_fuel', 'filter_country'],

  async fetchListings() {
    await new Promise((r) => setTimeout(r, 140));
    return DATA;
  },

  normalize: normalizeAutoscout24,
};
