import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Globe2,
  Loader2,
  Pause,
  Radar,
  Rocket,
  ScanSearch,
} from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import { useDeepScrape } from '../hooks/useDeepScrape.js';
import { parseText } from '../services/search/queryParser.js';
import { SOURCES_META } from '../constants/sources.js';
import { COUNTRY_LABEL } from '../constants/countries.js';
import { formatNumber } from '../utils/formatters.js';
import { useCountUp } from '../hooks/useCountUp.js';
import styles from './DeepScrapePage.module.css';

const PAGE_PRESETS = [
  { value: 5, label: '5 pages · ~2 min' },
  { value: 10, label: '10 pages · ~5 min' },
  { value: 20, label: '20 pages · ~10 min' },
  { value: 50, label: '50 pages · ~25 min' },
  { value: 100, label: '100 pages · ~50 min (max)' },
];

export default function DeepScrapePage() {
  const [query, setQuery] = useState('Toyota Prius');
  const [maxPages, setMaxPages] = useState(20);
  const { state, start, stop } = useDeepScrape();

  const sourceList = useMemo(() => Object.values(state.sources || {}), [state.sources]);
  const isRunning = state.phase === 'running' || state.phase === 'starting';

  function onLaunch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    const criteria = parseText(query);
    start(criteria, { maxPages });
  }

  return (
    <div className="container">
      <Header />

      <Card padding="md" className={styles.controlCard}>
        <form className={styles.form} onSubmit={onLaunch}>
          <div className={styles.formRow}>
            <div className={styles.queryField}>
              <Input
                label="Recherche"
                placeholder="Ex : Toyota Prius, BMW Serie 3, Renault Clio..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isRunning}
                leftIcon={<ScanSearch size={16} />}
              />
            </div>
            <div className={styles.depthField}>
              <Select
                label="Profondeur"
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                disabled={isRunning}
                options={PAGE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
              />
            </div>
            <div className={styles.actions}>
              {isRunning ? (
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  size="lg"
                  leftIcon={<Pause size={16} />}
                  onClick={stop}
                >
                  Arreter
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  size="lg"
                  leftIcon={<Rocket size={16} />}
                  disabled={!query.trim()}
                >
                  Lancer le scrape profond
                </Button>
              )}
            </div>
          </div>
          <div className={styles.formNote}>
            <Radar size={12} /> Pagine sur chaque source avec delais aleatoires (1.5–3.5s entre pages) pour
            simuler une navigation humaine. Chaque annonce est immediatement persistee en Firestore — meme si
            tu fermes la page, ce qui a deja ete scrappe est conserve.
          </div>
        </form>
      </Card>

      {state.phase !== 'idle' && (
        <SessionSummary state={state} />
      )}

      <div className={styles.sourcesGrid}>
        {sourceList.map((s) => (
          <SourceCard key={s.id} source={s} maxPages={state.maxPages} />
        ))}
      </div>

      {state.phase === 'done' && (
        <Card padding="md" className={styles.doneCard}>
          <div className={styles.doneRow}>
            <div>
              <div className={styles.doneKicker}>scrape termine</div>
              <div className={styles.doneTitle}>
                <span className="tabular">{formatNumber(state.totals.listings)}</span> annonces collectees
              </div>
              <div className={styles.doneSub}>
                {state.totals.pagesScanned} pages analysees · {(state.durationMs / 1000).toFixed(1)}s · stockees en Firestore
              </div>
            </div>
            <Link to={`/search?${encodeQuery(query)}`} className={styles.doneCta}>
              Voir les annonces collectees →
            </Link>
          </div>
        </Card>
      )}

      {state.phase === 'error' && (
        <Card padding="md" className={styles.errorCard}>
          <AlertTriangle size={18} />
          <div>
            <strong>Erreur :</strong> {state.error || 'connexion perdue'}
          </div>
        </Card>
      )}
    </div>
  );
}

// ---- Header ----
function Header() {
  return (
    <header className={styles.header}>
      <span className={styles.kicker}>Cockpit · scrap profond</span>
      <h1>Scrape exhaustif sur plusieurs pages</h1>
      <p className="text-muted">
        La recherche standard ne lit que la 1re page de chaque source. Ici, tu paginates a fond
        — jusqu'a 100 pages par source — et chaque annonce part directement en base. Adapte aux
        gros volumes (Leboncoin Prius : milliers de resultats) et aux usages analytiques.
      </p>
    </header>
  );
}

// ---- Session summary (top compteurs) ----
function SessionSummary({ state }) {
  const totalListings = useCountUp(state.totals.listings, { duration: 600 });
  const totalPages = useCountUp(state.totals.pagesScanned, { duration: 400 });
  const totalSources = Object.keys(state.sources).length;
  const sourcesDone = state.totals.sourcesDone;
  const elapsedMs = state.startedAt ? (state.finishedAt || Date.now()) - state.startedAt : 0;

  return (
    <div className={styles.summary}>
      <SummaryCard
        kicker="annonces"
        value={formatNumber(totalListings)}
        sub="recuperees a date"
        glow
      />
      <SummaryCard
        kicker="pages"
        value={formatNumber(totalPages)}
        sub="analysees"
      />
      <SummaryCard
        kicker="sources"
        value={`${sourcesDone} / ${totalSources}`}
        sub="terminees"
      />
      <SummaryCard
        kicker="duree"
        value={`${(elapsedMs / 1000).toFixed(0)}s`}
        sub={state.phase === 'running' ? 'en cours…' : 'totale'}
      />
    </div>
  );
}

function SummaryCard({ kicker, value, sub, glow }) {
  return (
    <div className={[styles.sumCard, glow ? styles.sumCardGlow : ''].join(' ')}>
      <span className={styles.sumKicker}>{kicker}</span>
      <span className={`${styles.sumValue} tabular`}>{value}</span>
      <span className={styles.sumSub}>{sub}</span>
    </div>
  );
}

// ---- Per-source progress card ----
function SourceCard({ source, maxPages }) {
  const meta = SOURCES_META.find((s) => s.id === source.id);
  const color = meta?.color || 'var(--color-accent)';
  const pct = maxPages ? Math.min(100, (source.page / maxPages) * 100) : 0;
  const statusInfo = getStatusInfo(source);
  const avgMs = source.pageDurations?.length
    ? source.pageDurations.reduce((a, b) => a + b, 0) / source.pageDurations.length
    : 0;
  const animatedCount = useCountUp(source.count || 0, { duration: 400 });

  return (
    <div className={[styles.sourceCard, statusInfo.cardClass].join(' ')}>
      <div className={styles.sourceTop}>
        <div className={styles.sourceIdent}>
          <span className={styles.sourceDot} style={{ background: color }} />
          <span className={styles.sourceLabel}>{source.label}</span>
          <span className={styles.sourceCountry}>{source.country}</span>
        </div>
        <span className={[styles.sourceStatus, statusInfo.statusClass].join(' ')}>
          {statusInfo.icon}
          <span>{statusInfo.text}</span>
        </span>
      </div>

      <div className={styles.sourceMain}>
        <div className={styles.sourceCount}>
          <span className={`${styles.sourceCountValue} tabular`}>{formatNumber(animatedCount)}</span>
          <span className={styles.sourceCountLabel}>annonces</span>
        </div>
      </div>

      <div className={styles.sourceProgress}>
        <div className={styles.progressLabel}>
          <span>page {source.page} / {maxPages}</span>
          {avgMs > 0 && <span className="tabular">{(avgMs / 1000).toFixed(1)}s/page</span>}
        </div>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${pct}%`, background: color }}
          />
          {/* Marqueurs des pages atteintes */}
          {source.status === 'running' && (
            <div className={styles.progressShimmer} aria-hidden />
          )}
        </div>
      </div>

      {source.error && (
        <div className={styles.sourceError}>
          <AlertTriangle size={11} /> {source.errorCode || 'error'} · {source.error.slice(0, 60)}
        </div>
      )}

      {source.status === 'done' && source.reason && source.reason !== 'completed' && (
        <div className={styles.sourceFinishReason}>
          arrete : {humanReason(source.reason)}
        </div>
      )}
    </div>
  );
}

function getStatusInfo(source) {
  if (source.status === 'running') {
    return {
      icon: <Loader2 size={12} className={styles.spin} />,
      text: 'scrap…',
      statusClass: styles.statusRunning,
      cardClass: styles.cardRunning,
    };
  }
  if (source.status === 'done') {
    if (source.reason === 'blocked' || source.reason === 'rate_limited' || source.reason === 'too_many_errors') {
      return {
        icon: <AlertTriangle size={12} />,
        text: 'partiel',
        statusClass: styles.statusWarning,
        cardClass: styles.cardWarning,
      };
    }
    return {
      icon: <CheckCircle2 size={12} />,
      text: 'termine',
      statusClass: styles.statusDone,
      cardClass: styles.cardDone,
    };
  }
  return {
    icon: <Globe2 size={12} />,
    text: 'en attente',
    statusClass: styles.statusPending,
    cardClass: '',
  };
}

function humanReason(reason) {
  const map = {
    no_more_results: 'plus de resultats',
    blocked: 'bloque par anti-bot',
    rate_limited: 'rate limit atteint',
    too_many_errors: 'trop d\'erreurs',
    aborted: 'arrete par l\'utilisateur',
  };
  return map[reason] || reason;
}

function encodeQuery(s) {
  const c = parseText(s);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(c)) {
    if (v == null || v === '') continue;
    params.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  return params.toString();
}
