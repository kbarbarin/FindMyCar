// Endpoint interne déclenché par Cloud Scheduler. Itère des requêtes populaires
// pour alimenter Firestore en données fraîches indépendamment du trafic user.
//
// Sécurisé par un header X-Scheduler-Secret (valeur = env SCHEDULER_SECRET).
// Cloud Scheduler permet d'envoyer ce header dans la config du job.

import { aggregatedSearch } from '../services/aggregator.service.js';
import { firestoreService } from '../services/firestore.service.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ controller: 'internal' });

// Requêtes alimentées régulièrement. Adapté pour le marché FR+EU.
// En prod, ces listes viendraient d'une Firestore collection /scheduledQueries
// qu'un admin peut éditer sans redeploy.
const POPULAR_QUERIES = [
  { make: 'Toyota', model: 'Prius+' },
  { make: 'Toyota', model: 'Yaris' },
  { make: 'Toyota', model: 'Corolla' },
  { make: 'Peugeot', model: '308' },
  { make: 'Peugeot', model: '3008' },
  { make: 'Peugeot', model: '208' },
  { make: 'Renault', model: 'Clio' },
  { make: 'Renault', model: 'Megane' },
  { make: 'Renault', model: 'Zoe' },
  { make: 'Volkswagen', model: 'Golf' },
  { make: 'Volkswagen', model: 'Polo' },
  { make: 'Volkswagen', model: 'Passat' },
  { make: 'BMW', model: 'Serie 3' },
  { make: 'BMW', model: 'X1' },
  { make: 'Audi', model: 'A3' },
  { make: 'Audi', model: 'A4' },
  { make: 'Mercedes', model: 'Classe C' },
  { make: 'Tesla', model: 'Model 3' },
  { make: 'Volvo', model: 'V60' },
  { make: 'Volvo', model: 'XC60' },
  { make: 'Citroën', model: 'C3' },
  { make: 'Dacia', model: 'Duster' },
];

function requireSecret(req, res) {
  const expected = process.env.SCHEDULER_SECRET;
  if (!expected) {
    res.status(503).json({ error: 'scheduler_not_configured' });
    return false;
  }
  const got = req.header('x-scheduler-secret');
  if (got !== expected) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

export async function runBatch(req, res) {
  if (!requireSecret(req, res)) return;

  if (!firestoreService.isEnabled()) {
    return res.status(503).json({ error: 'firestore_disabled' });
  }

  // On ne bloque pas Cloud Scheduler : on accuse réception immédiatement et
  // on traite en background. Cloud Scheduler a un timeout de 1800s par défaut
  // mais on reste sous les 60s pour la réponse HTTP.
  res.status(202).json({ status: 'started', queries: POPULAR_QUERIES.length });

  // On ne dépasse pas l'event-loop, on laisse finir.
  (async () => {
    let total = 0, errors = 0;
    for (const q of POPULAR_QUERIES) {
      try {
        const r = await aggregatedSearch(q);
        total += r.total;
        log.info('scheduler.query_done', { make: q.make, model: q.model, total: r.total });
      } catch (err) {
        errors++;
        log.warn('scheduler.query_failed', { make: q.make, model: q.model, msg: err.message });
      }
      // Petit délai pour ne pas saturer les sources.
      await new Promise((r) => setTimeout(r, 2000));
    }
    log.info('scheduler.batch_done', { totalListings: total, errors });
  })().catch((err) => log.error('scheduler.fatal', { msg: err.message }));
}

export async function status(_req, res) {
  res.json({
    firestoreEnabled: firestoreService.isEnabled(),
    scheduledQueries: POPULAR_QUERIES.length,
    secretConfigured: Boolean(process.env.SCHEDULER_SECRET),
  });
}
