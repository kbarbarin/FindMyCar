import { Database, Radio, RefreshCw } from 'lucide-react';
import Button from '../ui/Button.jsx';
import styles from './CacheStatusBar.module.css';

// Affiche : source = cache (avec ancienneté) ou live (avec durée), + bouton
// "Forcer un nouveau scrap" qui re-run avec fresh=true.
export default function CacheStatusBar({ cacheStatus, durationMs, status, onForceRescrape }) {
  if (!cacheStatus) return null;
  const isLoading = status === 'loading';
  const fromCache = cacheStatus.hit === true;

  return (
    <div className={[styles.bar, fromCache ? styles.cache : styles.live].join(' ')}>
      <div className={styles.left}>
        {fromCache ? (
          <>
            <Database size={14} />
            <span>
              <strong>Cache Firestore</strong> — annonces vues il y a {cacheStatus.ageMinutes ?? '?'} min
            </span>
          </>
        ) : (
          <>
            <Radio size={14} />
            <span>
              <strong>Scraping live</strong>
              {durationMs != null && <> — {(durationMs / 1000).toFixed(1)}s</>}
            </span>
          </>
        )}
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={onForceRescrape}
        disabled={isLoading}
        leftIcon={<RefreshCw size={14} className={isLoading ? styles.spinning : ''} />}
      >
        Forcer un nouveau scrap
      </Button>
    </div>
  );
}
