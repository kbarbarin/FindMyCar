// Catalogue unique de toutes les sources supportées.
//
// Un scraper a :
//   - implementation: identifiant dans IMPL_REGISTRY (registry.js)
//       'leboncoin' / 'autoscout24' / ... : classe dédiée
//       'generic'   : utilise GenericScraper + la config `generic` ci-dessous
//       null        : aucun scraper → PendingSourceScraper (désactivé)
//   - status:
//       'live'        : marche sans proxy
//       'experimental': scraper présent, fiabilité variable
//       'needs_proxy' : bloqué sans IP résidentielle
//       'pending'     : pas encore testé / sélecteurs à confirmer
//   - preferredEngine: 'fetch' | 'browser'
//   - reason: string expliquant pourquoi c'est bloqué ou pending
//   - generic: config passée au GenericScraper (stratégies, sélecteurs CSS, etc.)

const genericDefault = { strategies: ['json-ld', 'next-data', 'nuxt-data', 'selectors'] };

export const SOURCES_CATALOG = [
  // === France ===
  {
    id: 'leboncoin', label: 'Leboncoin', country: 'FR',
    baseUrl: 'https://www.leboncoin.fr',
    implementation: 'leboncoin', status: 'live', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.leboncoin.fr/recherche?category=2${q ? `&text=${encodeURIComponent(q)}` : ''}`;
    },
  },
  {
    id: 'lacentrale', label: 'La Centrale', country: 'FR',
    baseUrl: 'https://www.lacentrale.fr',
    implementation: 'lacentrale', status: 'needs_proxy', preferredEngine: 'browser',
    reason: 'Akamai Bot Manager',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.lacentrale.fr/listing${q ? `?searchQuery=${encodeURIComponent(q)}` : ''}`;
    },
  },
  {
    id: 'paruvendu', label: 'ParuVendu', country: 'FR',
    baseUrl: 'https://www.paruvendu.fr',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.paruvendu.fr/a/voiture-occasion${q ? `/?p=${encodeURIComponent(q)}` : ''}`;
    },
    generic: {
      ...genericDefault,
      selectors: {
        cards: 'article.annonce, li.annonce, div[data-classified-id]',
        title: 'h3, h2, .title',
        price: '.prix, .price',
        mileage: '.km',
        year: '.annee',
        fuel: '.carburant',
        city: '.ville, .location',
      },
    },
  },

  // === Allemagne ===
  {
    id: 'mobilede', label: 'Mobile.de', country: 'DE',
    baseUrl: 'https://suchen.mobile.de',
    implementation: 'mobilede', status: 'needs_proxy', preferredEngine: 'browser',
    reason: 'Akamai Bot Manager',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://suchen.mobile.de/fahrzeuge/search.html?s=Car${q ? `&query=${encodeURIComponent(q)}` : ''}`;
    },
  },
  {
    id: 'autoscout24', label: 'AutoScout24', country: 'DE',
    baseUrl: 'https://www.autoscout24.com',
    implementation: 'autoscout24', status: 'live', preferredEngine: 'fetch',
    international: true,
    searchUrl: ({ make, model }) => {
      let p = 'https://www.autoscout24.com/lst';
      if (make) p += `/${encodeURIComponent(make.toLowerCase())}`;
      if (make && model) p += `/${encodeURIComponent(model.toLowerCase().replace(/\s+/g, '-'))}`;
      return p;
    },
  },
  {
    id: 'ebay_kleinanzeigen', label: 'eBay Kleinanzeigen', country: 'DE',
    baseUrl: 'https://www.kleinanzeigen.de',
    implementation: 'generic', status: 'needs_proxy', preferredEngine: 'browser',
    reason: 'DataDome',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join('-').toLowerCase();
      return `https://www.kleinanzeigen.de/s-auto${q ? `/${encodeURIComponent(q)}` : ''}/k0`;
    },
    generic: { ...genericDefault, selectors: { cards: 'article.aditem', title: '.ellipsis', price: '.aditem-main--middle--price-shipping--price' } },
  },
  {
    id: 'pkwde', label: 'PKW.de', country: 'DE',
    baseUrl: 'https://www.pkw.de',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.pkw.de/gebrauchtwagen${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, selectors: { cards: '.car-listing, article.offer', title: 'h3, .title', price: '.price', year: '.year', mileage: '.mileage' } },
  },

  // === Espagne ===
  {
    id: 'coches_net', label: 'Coches.net', country: 'ES',
    baseUrl: 'https://www.coches.net',
    implementation: 'generic', status: 'needs_proxy', preferredEngine: 'browser',
    reason: 'DataDome',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.coches.net/segunda-mano/${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: genericDefault,
  },
  {
    id: 'milanuncios', label: 'Milanuncios', country: 'ES',
    baseUrl: 'https://www.milanuncios.com',
    implementation: 'generic', status: 'needs_proxy', preferredEngine: 'browser',
    reason: 'DataDome',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.milanuncios.com/coches-de-segunda-mano/${q ? `?s=${encodeURIComponent(q)}` : ''}`;
    },
    generic: genericDefault,
  },
  {
    id: 'wallapop', label: 'Wallapop', country: 'ES',
    baseUrl: 'https://es.wallapop.com',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://es.wallapop.com/app/search?category_ids=100${q ? `&keywords=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, selectors: { cards: 'tsl-public-profile-card, a.ItemCardList__item', title: '.ItemCard__title, h3', price: '.ItemCard__price' } },
  },
  {
    id: 'coches_com', label: 'Coches.com', country: 'ES',
    baseUrl: 'https://www.coches.com',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join('-').toLowerCase();
      return `https://www.coches.com/coches-segunda-mano${q ? `/${encodeURIComponent(q)}` : ''}.html`;
    },
    generic: genericDefault,
  },

  // === Belgique ===
  {
    id: 'gocar', label: 'Gocar', country: 'BE',
    baseUrl: 'https://www.gocar.be',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.gocar.be/fr/annonces${q ? `?search=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, selectors: { cards: 'article.classified-card, .listing-item', title: 'h2, .title', price: '.price' } },
  },
  {
    id: '2ememain', label: '2ememain', country: 'BE',
    baseUrl: 'https://www.2ememain.be',
    implementation: 'generic', status: 'needs_proxy', preferredEngine: 'browser',
    reason: 'DataDome',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.2ememain.be/l/autos/${q ? `#q:${encodeURIComponent(q)}` : ''}`;
    },
    generic: genericDefault,
  },

  // === Italie ===
  {
    id: 'subito', label: 'Subito', country: 'IT',
    baseUrl: 'https://www.subito.it',
    implementation: 'subito', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.subito.it/annunci-italia/vendita/auto/${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
  },
  {
    id: 'automobile_it', label: 'Automobile.it', country: 'IT',
    baseUrl: 'https://www.automobile.it',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const m = make ? `/${encodeURIComponent(make.toLowerCase())}` : '';
      const mo = model ? `/${encodeURIComponent(model.toLowerCase())}` : '';
      return `https://www.automobile.it/annunci${m}${mo}`;
    },
    generic: genericDefault,
  },
  {
    id: 'bakeca', label: 'Bakeca', country: 'IT',
    baseUrl: 'https://auto.bakeca.it',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://auto.bakeca.it/annunci${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, selectors: { cards: 'li.annuncio, article.card', title: 'h3', price: '.prezzo, .price' } },
  },
  {
    id: 'kijiji', label: 'Kijiji', country: 'IT',
    baseUrl: 'https://www.kijiji.it',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.kijiji.it/auto/${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: genericDefault,
  },

  // === Suisse ===
  {
    id: 'anibis', label: 'Anibis', country: 'CH',
    baseUrl: 'https://www.anibis.ch',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.anibis.ch/fr/c/voitures${q ? `?query=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, currency: 'CHF' },
  },
  {
    id: 'tutti', label: 'Tutti', country: 'CH',
    baseUrl: 'https://www.tutti.ch',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.tutti.ch/fr/q/vehicules-voitures${q ? `?query=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, currency: 'CHF' },
  },

  // === Luxembourg ===
  {
    id: 'luxauto', label: 'Luxauto', country: 'LU',
    baseUrl: 'https://www.luxauto.lu',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.luxauto.lu/voitures${q ? `?search=${encodeURIComponent(q)}` : ''}`;
    },
    generic: genericDefault,
  },

  // === Portugal ===
  {
    id: 'standvirtual', label: 'Standvirtual', country: 'PT',
    baseUrl: 'https://www.standvirtual.com',
    implementation: 'generic', status: 'needs_proxy', preferredEngine: 'browser',
    reason: 'Cloudflare',
    searchUrl: ({ make, model }) => {
      const m = make ? encodeURIComponent(make.toLowerCase()) : '';
      const mo = model ? `/${encodeURIComponent(model.toLowerCase())}` : '';
      return `https://www.standvirtual.com/carros${m ? `/${m}${mo}` : ''}`;
    },
    generic: genericDefault,
  },
  {
    id: 'olx_pt', label: 'OLX PT', country: 'PT',
    baseUrl: 'https://www.olx.pt',
    implementation: 'generic', status: 'needs_proxy', preferredEngine: 'browser',
    reason: 'DataDome',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.olx.pt/carros-motos-e-barcos/carros/${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: genericDefault,
  },
  {
    id: 'custojusto', label: 'CustoJusto', country: 'PT',
    baseUrl: 'https://www.custojusto.pt',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.custojusto.pt/autos${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: genericDefault,
  },

  // === Pays-Bas ===
  {
    id: 'marktplaats', label: 'Marktplaats', country: 'NL',
    baseUrl: 'https://www.marktplaats.nl',
    implementation: 'marktplaats', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.marktplaats.nl/l/auto-s/${q ? `#q:${encodeURIComponent(q)}` : ''}`;
    },
  },
  {
    id: 'autowereld', label: 'Autowereld', country: 'NL',
    baseUrl: 'https://www.autowereld.nl',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.autowereld.nl/zoeken${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: genericDefault,
  },
  {
    id: 'speurders', label: 'Speurders', country: 'NL',
    baseUrl: 'https://www.speurders.nl',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.speurders.nl/auto${q ? `/?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: genericDefault,
  },

  // === Pologne ===
  {
    id: 'otomoto', label: 'Otomoto', country: 'PL',
    baseUrl: 'https://www.otomoto.pl',
    implementation: 'generic', status: 'needs_proxy', preferredEngine: 'browser',
    reason: 'DataDome',
    searchUrl: ({ make, model }) => {
      const m = make ? encodeURIComponent(make.toLowerCase()) : '';
      const mo = model ? `/${encodeURIComponent(model.toLowerCase())}` : '';
      return `https://www.otomoto.pl/osobowe${m ? `/${m}${mo}` : ''}`;
    },
    generic: { ...genericDefault, currency: 'PLN' },
  },
  {
    id: 'allegro', label: 'Allegro', country: 'PL',
    baseUrl: 'https://allegro.pl',
    implementation: 'generic', status: 'needs_proxy', preferredEngine: 'browser',
    reason: 'DataDome',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://allegro.pl/kategoria/samochody-osobowe-4029${q ? `?string=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, currency: 'PLN' },
  },
  {
    id: 'gratka', label: 'Gratka', country: 'PL',
    baseUrl: 'https://gratka.pl',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://gratka.pl/motoryzacja/osobowe${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, currency: 'PLN' },
  },

  // === Suède ===
  {
    id: 'blocket', label: 'Blocket', country: 'SE',
    baseUrl: 'https://www.blocket.se',
    implementation: 'generic', status: 'needs_proxy', preferredEngine: 'browser',
    reason: 'Cloudflare',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.blocket.se/annonser/hela_sverige/fordon/bilar${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, currency: 'SEK' },
  },
  {
    id: 'bytbil', label: 'Bytbil', country: 'SE',
    baseUrl: 'https://bytbil.com',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://bytbil.com/bilar${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, currency: 'SEK' },
  },

  // === Norvège ===
  {
    id: 'finn', label: 'Finn.no', country: 'NO',
    baseUrl: 'https://www.finn.no',
    implementation: 'generic', status: 'needs_proxy', preferredEngine: 'browser',
    reason: 'Cloudflare + fingerprinting',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.finn.no/mobility/search/car${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, currency: 'NOK' },
  },

  // === Finlande ===
  {
    id: 'tori', label: 'Tori.fi', country: 'FI',
    baseUrl: 'https://www.tori.fi',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.tori.fi/autot${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: genericDefault,
  },

  // === Danemark ===
  {
    id: 'bilbasen', label: 'Bilbasen', country: 'DK',
    baseUrl: 'https://www.bilbasen.dk',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.bilbasen.dk/brugt/bil${q ? `?free=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, currency: 'DKK' },
  },

  // === Roumanie ===
  {
    id: 'autovit', label: 'Autovit', country: 'RO',
    baseUrl: 'https://www.autovit.ro',
    implementation: 'generic', status: 'needs_proxy', preferredEngine: 'browser',
    reason: 'DataDome',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.autovit.ro/autoturisme${q ? `?search%5Bfilter_enum_make%5D=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, currency: 'RON' },
  },
  {
    id: 'olx_ro', label: 'OLX RO', country: 'RO',
    baseUrl: 'https://www.olx.ro',
    implementation: 'generic', status: 'needs_proxy', preferredEngine: 'browser',
    reason: 'DataDome',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.olx.ro/auto-masini-moto-ambarcatiuni/autoturisme/${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, currency: 'RON' },
  },

  // === Bulgarie ===
  {
    id: 'cars_bg', label: 'Cars.bg', country: 'BG',
    baseUrl: 'https://www.cars.bg',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.cars.bg/carslist.php${q ? `?subm=1&add_search=1&q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, currency: 'BGN' },
  },

  // === Grèce ===
  {
    id: 'car_gr', label: 'Car.gr', country: 'GR',
    baseUrl: 'https://www.car.gr',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.car.gr/classifieds/cars${q ? `/?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: genericDefault,
  },
  {
    id: 'vendora', label: 'Vendora', country: 'GR',
    baseUrl: 'https://www.vendora.gr',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.vendora.gr/cars${q ? `/?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: genericDefault,
  },

  // === Lituanie ===
  {
    id: 'autoplius', label: 'Autoplius', country: 'LT',
    baseUrl: 'https://autoplius.lt',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://autoplius.lt/skelbimai/naudoti-automobiliai${q ? `?make_keyword=${encodeURIComponent(q)}` : ''}`;
    },
    generic: genericDefault,
  },
  {
    id: 'autogidas', label: 'Autogidas', country: 'LT',
    baseUrl: 'https://autogidas.lt',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://autogidas.lt/paieska${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: genericDefault,
  },

  // === Lettonie ===
  {
    id: 'ss_lv', label: 'SS.lv', country: 'LV',
    baseUrl: 'https://www.ss.lv',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.ss.lv/lv/transport/cars/${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, selectors: { cards: 'tr[id^="tr_"]', title: 'a.am', price: '.pp1, .msg2', city: '.msga2' } },
  },

  // === Estonie ===
  {
    id: 'auto24', label: 'Auto24', country: 'EE',
    baseUrl: 'https://www.auto24.ee',
    implementation: 'auto24', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.auto24.ee/kasutatud/nimekiri.php${q ? `?otsingSona=${encodeURIComponent(q)}` : ''}`;
    },
  },

  // === Hongrie ===
  {
    id: 'hasznaltauto', label: 'Hasznaltauto', country: 'HU',
    baseUrl: 'https://www.hasznaltauto.hu',
    implementation: 'generic', status: 'experimental', preferredEngine: 'fetch',
    searchUrl: ({ make, model }) => {
      const q = [make, model].filter(Boolean).join(' ');
      return `https://www.hasznaltauto.hu/auto${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    },
    generic: { ...genericDefault, currency: 'HUF' },
  },
];

export function getCatalogById(id) {
  return SOURCES_CATALOG.find((s) => s.id === id) ?? null;
}

export function getLiveSources() {
  return SOURCES_CATALOG.filter((s) => s.status === 'live');
}

export function getActiveSources() {
  return SOURCES_CATALOG.filter((s) => s.implementation && (s.status === 'live' || s.status === 'experimental'));
}
