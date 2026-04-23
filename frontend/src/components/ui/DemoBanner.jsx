import { Info, Radio, AlertTriangle } from 'lucide-react';
import styles from './DemoBanner.module.css';

// Affiche un bandeau adapté au mode d'exécution :
//   - fromBackend=true, fromBackend.stats = sources en live  → "Scraping live"
//   - fromBackend=true mais certaines sources en erreur       → "Partiel"
//   - fromBackend=false (mode offline sans API)               → "Démo locale"
export default function DemoBanner({ fromBackend, sourceStats, partialSources }) {
  if (!fromBackend) {
    return (
      <div className={[styles.banner, styles.demo].join(' ')} role="note">
        <Info size={14} aria-hidden />
        <span>
          <strong>Mode démo</strong> — Le backend n'est pas joignable. Les annonces
          affichées sont générées localement pour valider l'UX.
        </span>
      </div>
    );
  }

  const live = [], offline = [];
  if (sourceStats) {
    for (const [id, s] of Object.entries(sourceStats)) {
      if (s.source === 'live') live.push(id);
      else offline.push(id);
    }
  }

  if (offline.length === 0 && live.length > 0) {
    return (
      <div className={[styles.banner, styles.live].join(' ')} role="note">
        <Radio size={14} aria-hidden />
        <span>
          <strong>Scraping live</strong> — Annonces récupérées en direct depuis{' '}
          {live.join(', ')}. Données réelles, prix et photos inclus.
        </span>
      </div>
    );
  }

  if (live.length > 0) {
    return (
      <div className={[styles.banner, styles.partial].join(' ')} role="note">
        <AlertTriangle size={14} aria-hidden />
        <span>
          <strong>Scraping partiel</strong> — Données live : {live.join(', ')}.
          Sources indisponibles : {offline.join(', ')} (anti-bot, nécessitent un proxy).
        </span>
      </div>
    );
  }

  return (
    <div className={[styles.banner, styles.partial].join(' ')} role="note">
      <AlertTriangle size={14} aria-hidden />
      <span>
        <strong>Aucune source joignable</strong> — Les marketplaces ciblées bloquent les
        requêtes. Configurez un proxy résidentiel pour passer en production.
      </span>
    </div>
  );
}
