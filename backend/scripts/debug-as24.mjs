// Affiche la structure pertinente du 1er ad AutoScout24 live.
import { Autoscout24Scraper } from '../src/scrapers/autoscout24.scraper.js';
import { load } from 'cheerio';

const s = new Autoscout24Scraper();
const url = s.buildSearchUrl({ make: 'Toyota', model: 'Prius+' });
console.log('URL:', url);

const html = await s.fetchHtml(url, 'fetch');
const $ = load(html);
const data = JSON.parse($('#__NEXT_DATA__').html());
const listings = data.props.pageProps.listings;
console.log('\nTotal:', listings.length);
const ad = listings[0];

// Redact the images (on sait déjà ce que c'est) pour une sortie lisible
const clean = { ...ad, images: `[${ad.images?.length} urls]`, ocsImagesA: undefined };
console.log('\nClean ad shape:');
console.log(JSON.stringify(clean, null, 2));
process.exit(0);
