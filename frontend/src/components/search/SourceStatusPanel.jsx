import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, CheckCircle2, XCircle, ShieldAlert, Clock, MinusCircle } from 'lucide-react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { useSearchStore } from '../../store/searchStore.js';
import { COUNTRIES, COUNTRY_LABEL } from '../../constants/countries.js';
import styles from './SourceStatusPanel.module.css';

// Mapping résultat backend → couleur + icône + texte court
const RESULT_META = {
  live:           { label: 'Live',       icon: CheckCircle2, color: 'success' },
  fallback_mock:  { label: 'Mock',       icon: ShieldAlert,  color: 'warning' },
  mock:           { label: 'Mock',       icon: ShieldAlert,  color: 'warning' },
  blocked:        { label: 'Bloqué',     icon: ShieldAlert,  color: 'danger' },
  timeout:        { label: 'Timeout',    icon: Clock,        color: 'warning' },
  not_found:      { label: '404',        icon: XCircle,      color: 'danger' },
  rate_limited:   { label: 'Rate limit', icon: ShieldAlert,  color: 'warning' },
  unavailable:    { label: '503',        icon: XCircle,      color: 'danger' },
  network_error:  { label: 'Réseau',     icon: XCircle,      color: 'danger' },
  parse_failed:   { label: 'Parse fail', icon: XCircle,      color: 'danger' },
  normalize_failed:{ label:'Norm. fail', icon: XCircle,      color: 'danger' },
  empty:          { label: 'Vide',       icon: MinusCircle,  color: 'neutral' },
  error:          { label: 'Erreur',     icon: XCircle,      color: 'danger' },
  skipped:        { label: 'Désactivé',  icon: MinusCircle,  color: 'neutral' },
};

export default function SourceStatusPanel() {
  const sourceStats = useSearchStore((s) => s.sourceStats);
  const liveCount = useSearchStore((s) => s.liveCount);
  const sourcesAttempted = useSearchStore((s) => s.sourcesAttempted);
  const sourcesInCatalog = useSearchStore((s) => s.sourcesInCatalog);
  const rawCount = useSearchStore((s) => s.rawCount);
  const durationMs = useSearchStore((s) => s.durationMs);
  const triggeringSourceId = useSearchStore((s) => s.triggeringSourceId);
  const triggerSource = useSearchStore((s) => s.triggerSource);

  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const grouped = useMemo(() => {
    if (!sourceStats) return [];
    const byCountry = {};
    for (const [id, s] of Object.entries(sourceStats)) {
      const country = s.country || 'XX';
      (byCountry[country] = byCountry[country] || []).push({ id, ...s });
    }
    // Ordre des pays selon la liste de constantes
    const ordered = COUNTRIES.map((c) => c.code).filter((c) => byCountry[c]);
    return ordered.map((code) => ({
      code,
      label: COUNTRY_LABEL[code] || code,
      sources: byCountry[code].sort((a, b) => {
        // Tri : live d'abord, puis attempted, puis le reste
        const score = (s) => (s.result === 'live' ? 0 : s.attempted ? 1 : 2);
        return score(a) - score(b) || a.label.localeCompare(b.label);
      }),
    }));
  }, [sourceStats]);

  if (!sourceStats) return null;

  const visibleSources = (sources) => showAll
    ? sources
    : sources.filter((s) => s.attempted || s.result === 'live');

  return (
    <Card padding="md" className={styles.panel}>
      <button type="button" className={styles.header} onClick={() => setExpanded((e) => !e)}>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className={styles.title}>État des sources</span>
        <span className={styles.summary}>
          <strong>{liveCount}</strong> live · <strong>{sourcesAttempted}</strong> tentées · <strong>{sourcesInCatalog}</strong> au catalogue
          {rawCount > 0 && <> · <strong>{rawCount}</strong> annonces brutes</>}
          {durationMs != null && <> · <strong>{(durationMs / 1000).toFixed(1)}s</strong></>}
        </span>
      </button>

      {expanded && (
        <>
          <div className={styles.toolbar}>
            <button
              type="button"
              className={[styles.toggle, !showAll ? styles.toggleActive : ''].join(' ')}
              onClick={() => setShowAll(false)}
            >
              Tentées ({grouped.reduce((s, g) => s + g.sources.filter((x) => x.attempted).length, 0)})
            </button>
            <button
              type="button"
              className={[styles.toggle, showAll ? styles.toggleActive : ''].join(' ')}
              onClick={() => setShowAll(true)}
            >
              Toutes ({sourcesInCatalog})
            </button>
          </div>

          <div className={styles.grid}>
            {grouped.map((g) => {
              const sources = visibleSources(g.sources);
              if (!sources.length) return null;
              return (
                <div key={g.code} className={styles.group}>
                  <h4 className={styles.groupTitle}>{g.label}</h4>
                  <ul className={styles.list}>
                    {sources.map((s) => (
                      <SourceRow
                        key={s.id}
                        s={s}
                        isTriggering={triggeringSourceId === s.id}
                        onTrigger={() => triggerSource(s.id)}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

function SourceRow({ s, isTriggering, onTrigger }) {
  const meta = RESULT_META[s.result] || RESULT_META.error;
  const Icon = meta.icon;
  return (
    <li className={styles.row}>
      <span className={[styles.statusIcon, styles[`color_${meta.color}`]].join(' ')} title={s.reason || meta.label}>
        <Icon size={14} />
      </span>
      <span className={styles.sourceLabel}>{s.label}</span>
      <span className={styles.statusText}>
        {s.result === 'live'
          ? <><strong className="tabular">{s.count}</strong> annonces</>
          : <span title={s.reason || ''}>{meta.label}</span>}
      </span>
      <span className={styles.duration}>
        {s.durationMs != null ? `${(s.durationMs / 1000).toFixed(1)}s` : ''}
      </span>
      <button
        type="button"
        className={styles.retryBtn}
        onClick={onTrigger}
        disabled={isTriggering}
        title={s.enabled ? 'Relancer cette source' : 'Forcer cette source désactivée'}
      >
        <RefreshCw size={13} className={isTriggering ? styles.spinning : ''} />
      </button>
    </li>
  );
}
