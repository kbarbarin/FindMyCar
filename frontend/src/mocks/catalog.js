// Catalogue marque / modèle / plages réalistes pour la génération procédurale.
// Prix = MSRP approximatif d'un modèle récent ; le générateur déprécie en fonction
// de l'âge et du kilométrage.

export const CATALOG = [
  { make: 'Toyota', models: [
    { name: 'Prius+',  years: [2013, 2021], msrp: 28000, fuels: ['hybrid'],                transmissions: ['automatic'], seats: 7 },
    { name: 'Prius',   years: [2010, 2024], msrp: 27000, fuels: ['hybrid', 'plugin_hybrid'], transmissions: ['automatic'] },
    { name: 'Yaris',   years: [2011, 2024], msrp: 18000, fuels: ['petrol', 'hybrid'],      transmissions: ['manual', 'automatic'] },
    { name: 'Corolla', years: [2010, 2024], msrp: 24000, fuels: ['petrol', 'hybrid'],      transmissions: ['manual', 'automatic'] },
    { name: 'RAV4',    years: [2013, 2024], msrp: 35000, fuels: ['hybrid', 'plugin_hybrid', 'petrol'], transmissions: ['automatic'] },
    { name: 'C-HR',    years: [2016, 2024], msrp: 28000, fuels: ['hybrid'],                transmissions: ['automatic'] },
    { name: 'Auris',   years: [2008, 2018], msrp: 22000, fuels: ['hybrid', 'diesel', 'petrol'], transmissions: ['manual', 'automatic'] },
  ]},
  { make: 'Peugeot', models: [
    { name: '208',    years: [2012, 2024], msrp: 20000 },
    { name: '308',    years: [2010, 2024], msrp: 25000 },
    { name: '308 SW', years: [2011, 2022], msrp: 27000 },
    { name: '3008',   years: [2012, 2024], msrp: 33000 },
    { name: '5008',   years: [2012, 2024], msrp: 36000, seats: 7 },
    { name: '508',    years: [2012, 2024], msrp: 35000 },
  ]},
  { make: 'Renault', models: [
    { name: 'Clio',    years: [2010, 2024], msrp: 19000 },
    { name: 'Megane',  years: [2010, 2024], msrp: 24000 },
    { name: 'Captur',  years: [2013, 2024], msrp: 25000 },
    { name: 'Zoe',     years: [2013, 2023], msrp: 27000, fuels: ['electric'],          transmissions: ['automatic'] },
    { name: 'Kadjar',  years: [2015, 2022], msrp: 28000 },
    { name: 'Scenic',  years: [2011, 2023], msrp: 26000 },
  ]},
  { make: 'Volvo', models: [
    { name: 'V60',  years: [2011, 2024], msrp: 42000 },
    { name: 'V90',  years: [2016, 2024], msrp: 55000 },
    { name: 'XC60', years: [2010, 2024], msrp: 55000 },
    { name: 'XC90', years: [2003, 2024], msrp: 65000, seats: 7 },
    { name: 'S60',  years: [2010, 2024], msrp: 40000 },
  ]},
  { make: 'BMW', models: [
    { name: '320d',    years: [2012, 2022], msrp: 42000 },
    { name: 'Serie 3', years: [2012, 2024], msrp: 45000 },
    { name: 'Serie 5', years: [2010, 2024], msrp: 58000 },
    { name: 'X1',      years: [2012, 2024], msrp: 40000 },
    { name: 'X3',      years: [2011, 2024], msrp: 50000 },
  ]},
  { make: 'Volkswagen', models: [
    { name: 'Golf',    years: [2010, 2024], msrp: 26000 },
    { name: 'Passat',  years: [2010, 2024], msrp: 35000 },
    { name: 'Polo',    years: [2010, 2024], msrp: 18000 },
    { name: 'Tiguan',  years: [2010, 2024], msrp: 35000 },
    { name: 'T-Roc',   years: [2017, 2024], msrp: 29000 },
  ]},
  { make: 'Tesla', models: [
    { name: 'Model 3', years: [2018, 2024], msrp: 48000, fuels: ['electric'], transmissions: ['automatic'] },
    { name: 'Model Y', years: [2021, 2024], msrp: 55000, fuels: ['electric'], transmissions: ['automatic'] },
    { name: 'Model S', years: [2014, 2024], msrp: 85000, fuels: ['electric'], transmissions: ['automatic'] },
  ]},
  { make: 'Skoda', models: [
    { name: 'Octavia',       years: [2010, 2024], msrp: 26000 },
    { name: 'Octavia Combi', years: [2010, 2024], msrp: 28000 },
    { name: 'Superb',        years: [2010, 2024], msrp: 36000 },
    { name: 'Fabia',         years: [2010, 2024], msrp: 18000 },
    { name: 'Kodiaq',        years: [2017, 2024], msrp: 38000, seats: 7 },
  ]},
  { make: 'Citroën', models: [
    { name: 'C3',          years: [2010, 2024], msrp: 18000 },
    { name: 'C4',          years: [2010, 2024], msrp: 24000 },
    { name: 'C4 Picasso',  years: [2010, 2022], msrp: 27000 },
    { name: 'C5 Aircross', years: [2018, 2024], msrp: 32000 },
  ]},
  { make: 'Audi', models: [
    { name: 'A3', years: [2010, 2024], msrp: 35000 },
    { name: 'A4', years: [2010, 2024], msrp: 42000 },
    { name: 'A6', years: [2010, 2024], msrp: 58000 },
    { name: 'Q3', years: [2012, 2024], msrp: 40000 },
    { name: 'Q5', years: [2010, 2024], msrp: 52000 },
  ]},
  { make: 'Mercedes', models: [
    { name: 'Classe A', years: [2012, 2024], msrp: 35000 },
    { name: 'Classe C', years: [2010, 2024], msrp: 48000 },
    { name: 'GLA',      years: [2014, 2024], msrp: 40000 },
    { name: 'GLC',      years: [2015, 2024], msrp: 55000 },
  ]},
  { make: 'Kia', models: [
    { name: 'Ceed',     years: [2012, 2024], msrp: 22000 },
    { name: 'Sportage', years: [2010, 2024], msrp: 30000 },
    { name: 'Niro',     years: [2016, 2024], msrp: 30000, fuels: ['hybrid', 'plugin_hybrid', 'electric'] },
    { name: 'e-Niro',   years: [2019, 2024], msrp: 38000, fuels: ['electric'], transmissions: ['automatic'] },
  ]},
  { make: 'Hyundai', models: [
    { name: 'i20',     years: [2012, 2024], msrp: 18000 },
    { name: 'i30',     years: [2012, 2024], msrp: 22000 },
    { name: 'Tucson',  years: [2010, 2024], msrp: 30000 },
    { name: 'Kona',    years: [2017, 2024], msrp: 25000 },
    { name: 'Ioniq',   years: [2017, 2024], msrp: 32000, fuels: ['hybrid', 'plugin_hybrid', 'electric'] },
  ]},
  { make: 'Ford', models: [
    { name: 'Fiesta', years: [2010, 2023], msrp: 17000 },
    { name: 'Focus',  years: [2010, 2024], msrp: 22000 },
    { name: 'Kuga',   years: [2012, 2024], msrp: 30000 },
    { name: 'Puma',   years: [2019, 2024], msrp: 24000 },
  ]},
  { make: 'Dacia', models: [
    { name: 'Sandero', years: [2010, 2024], msrp: 13000 },
    { name: 'Duster',  years: [2010, 2024], msrp: 18000 },
    { name: 'Lodgy',   years: [2012, 2022], msrp: 16000, seats: 7 },
  ]},
  { make: 'Nissan', models: [
    { name: 'Qashqai', years: [2010, 2024], msrp: 28000 },
    { name: 'Juke',    years: [2010, 2024], msrp: 22000 },
    { name: 'Leaf',    years: [2013, 2024], msrp: 32000, fuels: ['electric'], transmissions: ['automatic'] },
  ]},
  { make: 'Opel', models: [
    { name: 'Astra',  years: [2010, 2024], msrp: 22000 },
    { name: 'Corsa',  years: [2010, 2024], msrp: 17000 },
    { name: 'Mokka',  years: [2013, 2024], msrp: 24000 },
  ]},
  { make: 'Fiat', models: [
    { name: '500',   years: [2010, 2024], msrp: 15000 },
    { name: 'Panda', years: [2012, 2024], msrp: 13000 },
    { name: '500X',  years: [2015, 2024], msrp: 19000 },
  ]},
  { make: 'SEAT', models: [
    { name: 'Ibiza', years: [2010, 2024], msrp: 18000 },
    { name: 'Leon',  years: [2010, 2024], msrp: 23000 },
    { name: 'Ateca', years: [2016, 2024], msrp: 27000 },
  ]},
];

export const DEFAULT_FUELS = ['petrol', 'diesel'];
export const DEFAULT_TRANSMISSIONS = ['manual', 'automatic'];
export const DEFAULT_COLORS_FR = ['Blanc', 'Noir', 'Gris', 'Bleu', 'Rouge', 'Beige', 'Argent'];
export const DEFAULT_COLORS_DE = ['Weiss', 'Schwarz', 'Grau', 'Blau', 'Rot', 'Silber'];

export const COMMON_FEATURES_FR = ['GPS', 'Camera de recul', 'Regulateur', 'Bluetooth', 'Apple CarPlay', 'Sieges chauffants', 'Cuir', 'Toit ouvrant', 'Regulateur adaptatif', 'Climatisation auto'];
export const COMMON_FEATURES_DE = ['NAVI', 'REAR_CAMERA', 'CRUISE_CONTROL', 'BLUETOOTH', 'LEATHER', 'HEATED_SEATS', 'PANORAMA_ROOF', 'ADAPTIVE_CRUISE'];
export const COMMON_FEATURES_ASC = ['navigation', 'rear_camera', 'cruise_control', 'bluetooth', 'leather', 'heated_seats', 'panoramic_roof', 'adaptive_cruise', 'apple_carplay', 'led_headlights'];

export const CURRENT_YEAR = 2026;
