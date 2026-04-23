// Schéma cible unique : toute source, après normalisation, produit cette forme.
// Aucun ORM : on se contente d'une fonction factory + validations légères.

/**
 * @typedef {Object} NormalizedListing
 * @property {string} id                  - `${sourceId}:${sourceRef}`
 * @property {{id:string,label:string,country:string}} source
 * @property {string|null} url            - URL canonique ou URL de recherche si mock
 * @property {string} title
 * @property {string|null} make
 * @property {string|null} model
 * @property {string|null} version
 * @property {number|null} year
 * @property {string|null} firstRegistration
 * @property {number|null} mileageKm
 * @property {{amount:number|null,currency:string}} price
 * @property {string|null} fuel           - enum canonique (petrol, diesel, hybrid...)
 * @property {string|null} transmission   - enum canonique (manual, automatic...)
 * @property {number|null} powerHp
 * @property {number|null} powerKw
 * @property {string|null} bodyType
 * @property {number|null} doors
 * @property {number|null} seats
 * @property {string|null} color
 * @property {string|null} country        - ISO2
 * @property {string|null} region
 * @property {string|null} city
 * @property {{type:string|null,name:string|null,rating:number|null}} seller
 * @property {string[]} features
 * @property {{firstHand:boolean|null,accidentFree:boolean|null,serviceBookComplete:boolean|null}} history
 * @property {string[]} photos
 * @property {string|null} postedAt
 * @property {number|null} rawScore
 * @property {Object} meta
 */

export function emptyListing(overrides = {}) {
  return {
    id: null,
    source: { id: null, label: null, country: null },
    url: null,
    title: null,
    make: null,
    model: null,
    version: null,
    year: null,
    firstRegistration: null,
    mileageKm: null,
    price: { amount: null, currency: 'EUR' },
    fuel: null,
    transmission: null,
    powerHp: null,
    powerKw: null,
    bodyType: null,
    doors: null,
    seats: null,
    color: null,
    country: null,
    region: null,
    city: null,
    seller: { type: null, name: null, rating: null },
    features: [],
    history: { firstHand: null, accidentFree: null, serviceBookComplete: null },
    photos: [],
    postedAt: null,
    rawScore: null,
    meta: { normalizedAt: new Date().toISOString(), fieldsMissing: [], reconstructed: [] },
    ...overrides,
  };
}

export function makeListingId(sourceId, sourceRef) {
  return `${sourceId}:${sourceRef}`;
}
