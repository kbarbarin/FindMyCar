import { useMemo } from 'react';
import { Activity, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import { SOURCE_META_BY_ID } from '../../constants/sources.js';
import styles from './ScrapingProgressBar.module.css';

// Affiche un compte-tours façon tableau de bord : combien de sources ont
// répondu, combien d'annonces récupérées, et un état coloré par source.
// Reçoit sourceStats (objet { sourceId: { result, count, ... } }) + status global.
export default function ScrapingProgressBar({
  sourceStats,
  status,
  liveCount = 0,
  rawCount = 0,
  sourcesAttempted = 0,
  durationMs = null,
}) {
  const isLoading = status === 'loading';

  const breakdown = useMemo(() => {
    if (!sourceStats) return [];
    return Object.entries(sourceStats)
      .filter(([, s]) => s.attempted)
      .map(([id, s]) => {
        const meta = SOURCE_META_BY_ID[id];
        const ok = s.result === 'live';
        const fail = !ok && s.attempted;
        return {
          id,
          label: meta?.label || s.label || id,
          color: meta?.color || 'var(--color-text-subtle)',
          country: meta?.country || s.country || '',
          count: s.count ?? 0,
          state: ok ? 'ok' : fail ? 'fail' : 'pending',
          duration: s.durationMs,
        };
      });
  }, [sourceStats]);

  const total = breakdown.length || sourcesAttempted || 1;
  const okCount = breakdown.filter((b) => b.state === 'ok').length;
  const failCount = breakdown.filter((b) => b.state === 'fail').length;
  const completionPct = Math.min(100, Math.round((okCount + failCount) / total * 100));

  // Conversion compte-tours : 0..100 % devient -120deg..120deg
  const needleAngle = -120 + (completionPct / 100) * 240;

  return (
    <div className={styles.cluster}>
      <div className={styles.gauge}>
        <div className={styles.gaugeLabel}>
          <span className={styles.gaugeLabelTop}>scraping</span>
          <span className={styles.gaugeLabelBottom}>x10²</span>
        </div>

        <svg className={styles.gaugeSvg} viewBox="0 0 120 80" aria-hidden>
          {/* Arc de fond */}
          <path
            d="M 12 70 A 48 48 0 0 1 108 70"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Graduation */}
          {Array.from({ length: 11 }).map((_, i) => {
            const angle = -120 + i * 24;
            const rad = (angle * Math.PI) / 180;
            const x1 = 60 + Math.sin(rad) * 38;
            const y1 = 70 - Math.cos(rad) * 38;
            const x2 = 60 + Math.sin(rad) * 44;
            const y2 = 70 - Math.cos(rad) * 44;
            const isMajor = i % 2 === 0;
            const isHot = i >= 8;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isHot ? 'var(--color-danger)' : 'var(--color-text-subtle)'}
                strokeWidth={isMajor ? 1.4 : 0.8}
                opacity={isMajor ? 0.85 : 0.45}
              />
            );
          })}
          {/* Arc rempli */}
          <path
            d="M 12 70 A 48 48 0 0 1 108 70"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="150"
            strokeDashoffset={150 - (150 * completionPct) / 100}
            style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
          {/* Aiguille */}
          <g style={{
            transform: `rotate(${needleAngle}deg)`,
            transformOrigin: '60px 70px',
            transition: 'transform 800ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            <line x1="60" y1="70" x2="60" y2="22" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="60" cy="70" r="5" fill="var(--color-ink)" />
            <circle cx="60" cy="70" r="2" fill="var(--color-accent)" />
          </g>
        </svg>

        <div className={styles.gaugeReading}>
          <span className={`${styles.gaugeReadingValue} tabular`}>{completionPct}</span>
          <span className={styles.gaugeReadingUnit}>%</span>
        </div>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metricsHeader}>
          <span className={styles.metricsTitle}>
            {isLoading ? <Loader size={14} className={styles.spin} /> : <Activity size={14} />}
            <span>{isLoading ? 'Scraping en cours' : 'Scrap termine'}</span>
          </span>
          {durationMs != null && (
            <span className={`${styles.metricsTime} tabular`}>
              {(durationMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>

        <div className={styles.metricsGrid}>
          <Metric label="Sources OK" value={okCount} accent="success" />
          <Metric label="Echecs" value={failCount} accent={failCount > 0 ? 'danger' : 'neutral'} />
          <Metric label="Annonces brutes" value={rawCount} accent="neutral" />
          <Metric label="Annonces retenues" value={liveCount} accent="accent" />
        </div>

        {breakdown.length > 0 && (
          <div className={styles.tape}>
            {breakdown.map((b) => (
              <div
                key={b.id}
                className={[
                  styles.tapeCell,
                  b.state === 'ok' ? styles.tapeOk : '',
                  b.state === 'fail' ? styles.tapeFail : '',
                ].join(' ')}
                title={`${b.label} (${b.country}) — ${b.state === 'ok' ? `${b.count} annonces` : 'echec'}`}
              >
                <span className={styles.tapeDot} style={{ background: b.color }} />
                <span className={styles.tapeName}>{b.label}</span>
                <span className={styles.tapeStatus}>
                  {b.state === 'ok' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, accent = 'neutral' }) {
  return (
    <div className={[styles.metric, styles[`metric_${accent}`]].join(' ')}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={`${styles.metricValue} tabular`}>{value}</span>
    </div>
  );
}
