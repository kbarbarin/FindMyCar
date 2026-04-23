import { aggregatedSearch } from '../services/aggregator.service.js';
import { computeEstimate } from '../services/estimate.service.js';
import { criteriaFromQuery } from '../models/searchCriteria.model.js';

// Renvoie une estimation prix (min/median/max) pour un make+model+year donné.
export async function estimate(req, res) {
  const input = { ...req.body, ...req.query };
  const criteria = criteriaFromQuery(input);
  if (!criteria.make && !criteria.model) {
    return res.status(400).json({ error: 'bad_request', message: 'make ou model requis' });
  }
  const { results } = await aggregatedSearch(criteria);
  const est = computeEstimate(results);
  res.json({ criteria, count: results.length, estimation: est });
}
