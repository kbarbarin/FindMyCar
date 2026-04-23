// Catalogue complet des 38 sources du monoprojet.
// Couleur = branding de la source (utilisée dans SourceBadge pour la pastille colorée).

export const SOURCES_META = [
  // France
  { id: 'leboncoin',         label: 'Leboncoin',         country: 'FR', color: '#FF6E14' },
  { id: 'lacentrale',        label: 'La Centrale',       country: 'FR', color: '#E60000' },
  { id: 'paruvendu',         label: 'ParuVendu',         country: 'FR', color: '#005BBB' },
  // Allemagne
  { id: 'mobilede',          label: 'Mobile.de',         country: 'DE', color: '#F9A826' },
  { id: 'autoscout24',       label: 'AutoScout24',       country: 'DE', color: '#FFCB05' },
  { id: 'ebay_kleinanzeigen',label: 'eBay Kleinanzeigen',country: 'DE', color: '#86B817' },
  { id: 'pkwde',             label: 'PKW.de',            country: 'DE', color: '#003399' },
  // Espagne
  { id: 'coches_net',        label: 'Coches.net',        country: 'ES', color: '#E53935' },
  { id: 'milanuncios',       label: 'Milanuncios',       country: 'ES', color: '#F5A623' },
  { id: 'wallapop',          label: 'Wallapop',          country: 'ES', color: '#13C1AC' },
  { id: 'coches_com',        label: 'Coches.com',        country: 'ES', color: '#4A90E2' },
  // Belgique
  { id: 'gocar',             label: 'Gocar',             country: 'BE', color: '#F57C00' },
  { id: '2ememain',          label: '2ememain',          country: 'BE', color: '#00A6D6' },
  // Italie
  { id: 'subito',            label: 'Subito',            country: 'IT', color: '#E80028' },
  { id: 'automobile_it',     label: 'Automobile.it',     country: 'IT', color: '#1E88E5' },
  { id: 'bakeca',            label: 'Bakeca',            country: 'IT', color: '#8BC34A' },
  { id: 'kijiji',            label: 'Kijiji',            country: 'IT', color: '#7CB342' },
  // Suisse
  { id: 'anibis',            label: 'Anibis',            country: 'CH', color: '#D32F2F' },
  { id: 'tutti',             label: 'Tutti',             country: 'CH', color: '#FBC02D' },
  // Luxembourg
  { id: 'luxauto',           label: 'Luxauto',           country: 'LU', color: '#00538A' },
  // Portugal
  { id: 'standvirtual',      label: 'Standvirtual',      country: 'PT', color: '#FF6B00' },
  { id: 'olx_pt',            label: 'OLX PT',            country: 'PT', color: '#2E7D32' },
  { id: 'custojusto',        label: 'CustoJusto',        country: 'PT', color: '#3F51B5' },
  // Pays-Bas
  { id: 'marktplaats',       label: 'Marktplaats',       country: 'NL', color: '#CC2E27' },
  { id: 'autowereld',        label: 'Autowereld',        country: 'NL', color: '#1976D2' },
  { id: 'speurders',         label: 'Speurders',         country: 'NL', color: '#5C6BC0' },
  // Pologne
  { id: 'otomoto',           label: 'Otomoto',           country: 'PL', color: '#ED1C24' },
  { id: 'allegro',           label: 'Allegro',           country: 'PL', color: '#FF5A00' },
  { id: 'gratka',            label: 'Gratka',            country: 'PL', color: '#0066CC' },
  // Suède
  { id: 'blocket',           label: 'Blocket',           country: 'SE', color: '#FFB300' },
  { id: 'bytbil',            label: 'Bytbil',            country: 'SE', color: '#1E88E5' },
  // Norvège
  { id: 'finn',              label: 'Finn.no',           country: 'NO', color: '#EF6C00' },
  // Finlande
  { id: 'tori',              label: 'Tori.fi',           country: 'FI', color: '#FF5722' },
  // Danemark
  { id: 'bilbasen',          label: 'Bilbasen',          country: 'DK', color: '#C62828' },
  // Roumanie
  { id: 'autovit',           label: 'Autovit',           country: 'RO', color: '#FFA000' },
  { id: 'olx_ro',            label: 'OLX RO',            country: 'RO', color: '#2E7D32' },
  // Bulgarie
  { id: 'cars_bg',           label: 'Cars.bg',           country: 'BG', color: '#D32F2F' },
  // Grèce
  { id: 'car_gr',            label: 'Car.gr',            country: 'GR', color: '#1565C0' },
  { id: 'vendora',           label: 'Vendora',           country: 'GR', color: '#E53935' },
  // Lituanie
  { id: 'autoplius',         label: 'Autoplius',         country: 'LT', color: '#FF9800' },
  { id: 'autogidas',         label: 'Autogidas',         country: 'LT', color: '#388E3C' },
  // Lettonie
  { id: 'ss_lv',             label: 'SS.lv',             country: 'LV', color: '#546E7A' },
  // Estonie
  { id: 'auto24',            label: 'Auto24',            country: 'EE', color: '#0277BD' },
  // Hongrie
  { id: 'hasznaltauto',      label: 'Hasznaltauto',      country: 'HU', color: '#4CAF50' },
];

export const SOURCE_META_BY_ID = Object.fromEntries(SOURCES_META.map((s) => [s.id, s]));
export const SOURCES_BY_COUNTRY = SOURCES_META.reduce((acc, s) => {
  (acc[s.country] = acc[s.country] || []).push(s);
  return acc;
}, {});
