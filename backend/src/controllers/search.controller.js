import { criteriaFromQuery } from '../models/searchCriteria.model.js';
import { aggregatedSearch } from '../services/aggregator.service.js';
import { cacheService } from '../services/cache.service.js';
import { computeEstimate } from '../services/estimate.service.js';

export async function search(req, res) {
  const criteria = criteriaFromQuery(req.query);
  const key = `search:${cacheService.key(criteria)}`;
  const cached = cacheService.get(key);
  if (cached) {
    res.set('X-Cache', 'HIT');
    return res.json(cached);
  }

  const { total, partialSources, sourceStats, results } = await aggregatedSearch(criteria);

  // Pagination
  const page = Math.max(1, parseInt(criteria.page ?? 1, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(criteria.pageSize ?? 24, 10) || 24));
  const offset = (page - 1) * pageSize;
  const paged = results.slice(offset, offset + pageSize);

  const estimation = computeEstimate(results);

  const body = {
    criteria,
    total,
    page, pageSize,
    partialSources,
    sourceStats,
    estimation,
    results: paged,
  };
  cacheService.set(key, body);
  res.set('X-Cache', 'MISS');
  res.json(body);
}
