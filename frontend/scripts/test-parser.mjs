// Test Node qui simule le pipeline complet :
//   texte libre → parser → aggregator → filtre + normalisation → comptes.
// Lancé via `npm run test:parser` (alias vers `node scripts/test-parser.mjs`).

import { readFile } from 'node:fs/promises';
import { parseText } from '../src/services/search/queryParser.js';
import { filterListings, scoreAndSort } from '../src/services/search/searchEngine.js';
import {
  normalizeLeboncoin,
  normalizeLacentrale,
  normalizeMobilede,
  normalizeAutoscout24,
} from '../src/services/normalization/normalizeListing.js';
import { generateForSource } from '../src/mocks/generator.js';
import { criteriaToParams, paramsToCriteria } from '../src/utils/url.js';

const BASE = new URL('../src/mocks/', import.meta.url);
async function loadStatic(name) {
  return JSON.parse(await readFile(new URL(`${name}.json`, BASE), 'utf8'));
}

const [lbcStatic, lacStatic, mobStatic, as24Static] = await Promise.all([
  loadStatic('leboncoin'), loadStatic('lacentrale'), loadStatic('mobilede'), loadStatic('autoscout24'),
]);

const lbc = [...lbcStatic, ...generateForSource('leboncoin',   { perModelTarget: 18 })];
const lac = [...lacStatic, ...generateForSource('lacentrale',  { perModelTarget: 14 })];
const mob = [...mobStatic, ...generateForSource('mobilede',    { perModelTarget: 12 })];
const as24 = [...as24Static, ...generateForSource('autoscout24', { perModelTarget: 10 })];

const allNormalized = [
  ...lbc.map(normalizeLeboncoin),
  ...lac.map(normalizeLacentrale),
  ...mob.map(normalizeMobilede),
  ...as24.map(normalizeAutoscout24),
];

console.log(`\nDataset total : ${allNormalized.length} annonces`);
console.log(`  leboncoin   : ${lbc.length}`);
console.log(`  lacentrale  : ${lac.length}`);
console.log(`  mobilede    : ${mob.length}`);
console.log(`  autoscout24 : ${as24.length}\n`);

const CASES = [
  { q: 'Toyota Prius+ moins de 10 ans plus de 200 000 km', minResults: 20 },
  { q: 'Toyota Prius+',                                    minResults: 50 },
  { q: 'Toyota',                                            minResults: 200 },
  { q: 'Peugeot 308 SW diesel',                             minResults: 10 },
  { q: 'Volvo V90 Allemagne',                               minResults: 5 },
  { q: 'Tesla Model 3',                                     minResults: 30 },
  { q: 'SUV hybride budget 25 000 €',                       minResults: 30 },
  { q: 'voiture électrique moins de 5 ans',                 minResults: 50 },
  { q: 'Renault Clio moins de 100 000 km',                  minResults: 30 },
  { q: 'BMW Serie 3 automatique',                           minResults: 20 },
  { q: 'Volkswagen Golf entre 2018 et 2022',                minResults: 20 },
  { q: 'Audi A4 après 2019',                                minResults: 15 },
  { q: 'hybride',                                           minResults: 100 },
];

let allPass = true;
console.log('Requête'.padEnd(55) + 'parsed'.padEnd(75) + 'count | min   result');
console.log('─'.repeat(155));
for (const c of CASES) {
  const patch = parseText(c.q);
  const params = criteriaToParams(patch);
  const criteria = paramsToCriteria(new URLSearchParams(params.toString()));

  const filtered = filterListings(allNormalized, criteria);
  const sorted = scoreAndSort(filtered, criteria);

  const parsedSummary = compactCriteria(patch);
  const passed = sorted.length >= c.minResults;
  if (!passed) allPass = false;
  console.log(
    c.q.padEnd(55) +
    parsedSummary.padEnd(75) +
    String(sorted.length).padStart(5) + ' | ' + String(c.minResults).padStart(4) + '  ' +
    (passed ? '✔ PASS' : '✘ FAIL'),
  );
}

console.log('\n' + (allPass ? '✔ All cases passed.' : '✘ Some cases failed.'));
process.exit(allPass ? 0 : 1);

function compactCriteria(p) {
  const keys = ['make','model','yearMin','yearMax','mileageMin','mileageMax','priceMin','priceMax','fuel','transmission','countries','firstHandOnly'];
  const parts = [];
  for (const k of keys) {
    const v = p[k];
    if (v == null || (Array.isArray(v) && !v.length) || v === false) continue;
    parts.push(`${k}=${Array.isArray(v) ? v.join(',') : v}`);
  }
  return parts.join(' ');
}
