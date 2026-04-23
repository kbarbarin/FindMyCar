import { getAllMeta } from '../scrapers/registry.js';

export async function list(_req, res) {
  res.json({ sources: getAllMeta() });
}
