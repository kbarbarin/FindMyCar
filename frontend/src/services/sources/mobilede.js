import staticData from '../../mocks/mobilede.json';
import { generateForSource } from '../../mocks/generator.js';
import { normalizeMobilede } from '../normalization/normalizeListing.js';

const DATA = [...staticData, ...generateForSource('mobilede', { perModelTarget: 12 })];

export const mobiledeConnector = {
  id: 'mobilede',
  label: 'Mobile.de',
  country: 'DE',
  enabled: true,
  priority: 2,
  capabilities: ['search_by_make', 'filter_year', 'filter_price', 'filter_mileage', 'filter_fuel', 'filter_transmission'],

  async fetchListings() {
    await new Promise((r) => setTimeout(r, 160));
    return DATA;
  },

  normalize: normalizeMobilede,
};
