import { useEffect, useState } from 'react';
import { BarChart3, Database, Radio, TrendingUp } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import LoadingState from '../components/ui/LoadingState.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import { apiClient } from '../services/api/client.js';
import { SOURCE_META_BY_ID } from '../constants/sources.js';
import { formatNumber } from '../utils/formatters.js';
import styles from './StatsPage.module.css';

export default function StatsPage() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  useEffect(() => {
    (async () => {
      try {
        const [overview, top, volume] = await Promise.all([
          apiClient.stats.overview(),
          apiClient.stats.topModels({ limit: 10 }),
          apiClient.stats.volume(30),
        ]);
        setState({ status: 'ready', data: { overview, top, volume } });
      } catch (err) {
        if (err.status === 503) {
          setState({ status: 'not_configured', error: err.payload?.message || 'Firestore non configure' });
        } else {
          setState({ status: 'error', error: err.message });
        }
      }
    })();
  }, []);

  if (state.status === 'loading') return <div className="container"><LoadingState count={2} /></div>;
  if (state.status === 'not_configured') return (
    <div className="container">
      <ErrorState
        icon={<Database size={22} />}
        title="Statistiques indisponibles"
        description="Firebase Firestore n'est pas configure cote backend. Les stats sont generees a partir des annonces scrappees et persistees."
      />
    </div>
  );
  if (state.status === 'error') return <div className="container"><ErrorState title="Erreur" description={state.error} /></div>;

  const { overview, top, volume } = state.data;
  const maxVol = Math.max(...(volume.volume?.map((v) => v.count) || [1]), 1);

  return (
    <div className="container">
      <header className={styles.header}>
        <span className={styles.kicker}>Marche · agregat</span>
        <h1>Statistiques du marche</h1>
        <p className="text-muted">
          Donnees agregees depuis Firestore, alimentees par le scraping continu des sources actives.
        </p>
      </header>

      <div className={styles.kpis}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}><Database size={18} /></div>
          <div className={styles.kpiLabel}>Annonces en base</div>
          <div className={`${styles.kpiValue} tabular`}>{formatNumber(overview.total)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}><Radio size={18} /></div>
          <div className={styles.kpiLabel}>Sources actives</div>
          <div className={`${styles.kpiValue} tabular`}>{overview.coverage?.length || 0}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}><TrendingUp size={18} /></div>
          <div className={styles.kpiLabel}>Nouvelles / 30j</div>
          <div className={`${styles.kpiValue} tabular`}>
            {formatNumber((volume.volume || []).reduce((s, v) => s + v.count, 0))}
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <Card padding="md">
          <h3 className={styles.sectionTitle}>Couverture par source</h3>
          <ul className={styles.bars}>
            {(overview.coverage || []).map((c) => {
              const meta = SOURCE_META_BY_ID[c.sourceId];
              const pct = overview.total ? (c.count / overview.total) * 100 : 0;
              return (
                <li key={c.sourceId}>
                  <div className={styles.barRow}>
                    <span className={styles.barLabel}>{meta?.label || c.sourceId}</span>
                    <span className={`${styles.barCount} tabular`}>{formatNumber(c.count)}</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${pct}%`, background: meta?.color || 'var(--color-accent)' }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card padding="md">
          <h3 className={styles.sectionTitle}>Top modeles scrappes</h3>
          <ol className={styles.topList}>
            {(top.models || []).map((m, i) => (
              <li key={`${m.make}-${m.model}`}>
                <span className={styles.topRank}>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.topLabel}>{m.make} {m.model}</span>
                <span className={`${styles.topCount} tabular`}>{formatNumber(m.count)}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card padding="md" className={styles.fullWidth}>
          <h3 className={styles.sectionTitle}>Volume d'annonces nouvelles · 30 derniers jours</h3>
          <div className={styles.chart}>
            {(volume.volume || []).map((v) => (
              <div key={v.date} className={styles.chartBar} style={{ height: `${(v.count / maxVol) * 100}%` }} title={`${v.date} — ${v.count}`}>
                <span className={styles.chartTooltip}>{v.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className={styles.hint}>
        <BarChart3 size={13} /> Stats enrichies a chaque recherche · scheduler 24/7
      </div>
    </div>
  );
}
