import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  Database,
  Euro,
  Gauge,
  Globe2,
  Radio,
  Rocket,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import Button from '../components/ui/Button.jsx';
import LoadingState from '../components/ui/LoadingState.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ResultCard from '../components/results/ResultCard.jsx';
import { apiClient } from '../services/api/client.js';
import { SOURCE_META_BY_ID, SOURCES_META } from '../constants/sources.js';
import { COUNTRY_LABEL, COUNTRIES } from '../constants/countries.js';
import { formatNumber, formatPrice, formatMileage } from '../utils/formatters.js';
import { useCountUp } from '../hooks/useCountUp.js';
import styles from './StatsPage.module.css';

const CHART_COLORS = {
  accent: '#E8B042',
  accentDeep: '#B8841C',
  ink: '#101216',
  success: '#1F7A56',
  danger: '#C63B2A',
  border: '#E4DDC9',
  textSubtle: '#7C7466',
};
const SOURCE_PALETTE = [
  '#E8B042', '#1F7A56', '#101216', '#C63B2A', '#9B6B17',
  '#3A6A8C', '#5C5040', '#8B4F1E', '#46715E', '#664B2A',
];

const COUNTRY_OPTIONS = [
  { value: '', label: 'Tous pays' },
  ...COUNTRIES.map((c) => ({ value: c.code, label: c.label })),
];

const EMPTY_FILTERS = {
  make: '', model: '',
  yearMin: '', mileageMax: '', priceMax: '',
  country: '',
};

export default function StatsPage() {
  // Filtres en cours d'edition (l'utilisateur tape, mais la requete ne part
  // qu'au submit — evite de spammer la BDD a chaque keystroke).
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);

  const [overview, setOverview] = useState(null);
  const [match, setMatch] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  // Overview (stats globales : volume + coverage par source) chargee une fois
  useEffect(() => {
    apiClient.stats.overview()
      .then(setOverview)
      .catch((err) => {
        if (err.status === 503) {
          setStatus('not_configured');
          setError(err.payload?.message || 'Firestore non configure');
        } else {
          setStatus('error');
          setError(err.message);
        }
      });
  }, []);

  // Match : recharge a chaque changement des filtres appliques
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    apiClient.stats.match(toQuery(applied))
      .then((d) => { if (!cancelled) { setMatch(d); setStatus('ready'); } })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 503) { setStatus('not_configured'); setError(err.payload?.message || 'Firestore non configure'); }
        else { setStatus('error'); setError(err.message); }
      });
    return () => { cancelled = true; };
  }, [applied]);

  if (status === 'not_configured') {
    return (
      <div className="container">
        <ErrorState
          icon={<Database size={22} />}
          title="Statistiques indisponibles"
          description="Firebase Firestore n'est pas configure cote backend. Les stats se construisent au fil du scraping."
        />
      </div>
    );
  }

  return (
    <div className="container">
      <Header />

      <FilterBar
        draft={draft}
        setDraft={setDraft}
        onApply={() => setApplied(draft)}
        onReset={() => { setDraft(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); }}
        loading={status === 'loading'}
      />

      {applied && hasAnyFilter(applied) && (
        <FilterChips applied={applied} onClear={(k) => {
          const next = { ...applied, [k]: '' };
          setDraft(next); setApplied(next);
        }} />
      )}

      <KpiHero match={match} overview={overview} />

      {overview && (
        <Card padding="md" className={styles.fullCard}>
          <SectionTitle icon={<TrendingUp size={16} />} kicker="instrument 01">
            Volume d'annonces nouvelles · 30 derniers jours · global
          </SectionTitle>
          <VolumeChart data={overview.volume || []} />
          <VolumeFooter data={overview.volume || []} />
        </Card>
      )}

      <div className={styles.grid2}>
        <Card padding="md">
          <SectionTitle icon={<BarChart3 size={16} />} kicker="instrument 02">
            Top modeles · selection
          </SectionTitle>
          <TopModelsChart data={match?.topModels || []} />
        </Card>

        <Card padding="md">
          <SectionTitle icon={<Radio size={16} />} kicker="instrument 03">
            Couverture par source · global
          </SectionTitle>
          <SourceDonut data={overview?.coverage || []} />
        </Card>
      </div>

      <div className={styles.grid2}>
        <Card padding="md">
          <SectionTitle icon={<Globe2 size={16} />} kicker="instrument 04">
            Repartition par pays · selection
          </SectionTitle>
          <CountryBreakdown data={match?.countries || []} />
        </Card>

        <Card padding="md">
          <SectionTitle icon={<Euro size={16} />} kicker="instrument 05">
            Distribution des prix · selection
          </SectionTitle>
          {match?.distribution ? (
            <PriceDistribution data={match.distribution} />
          ) : (
            <div className={styles.empty}>Pas assez de donnees prix pour cette selection.</div>
          )}
        </Card>
      </div>

      <Card padding="md" className={styles.fullCard}>
        <SectionTitle icon={<Sparkles size={16} />} kicker="instrument 06">
          Spectre des prix · selection
        </SectionTitle>
        {match?.prices ? (
          <PriceSpread stats={match.prices} applied={applied} />
        ) : (
          <div className={styles.empty}>Pas de donnees prix pour cette selection.</div>
        )}
      </Card>

      <Card padding="md" className={styles.fullCard}>
        <SectionTitle icon={<Rocket size={16} />} kicker="instrument 07">
          {match?.listings?.length
            ? `Annonces correspondantes · top ${match.listings.length}`
            : 'Annonces correspondantes'}
        </SectionTitle>
        {match?.listings?.length ? (
          <div className={styles.matchesGrid}>
            {match.listings.map((l) => <ResultCard key={l.id} listing={l} />)}
          </div>
        ) : status === 'loading' ? (
          <LoadingState count={2} />
        ) : (
          <EmptyState
            title="Aucune annonce ne correspond"
            description="Elargis les criteres ou lance un scrape profond depuis l'onglet Scrape."
          />
        )}
      </Card>

      <div className={styles.hint}>
        <Activity size={13} /> Donnees enrichies par chaque recherche · scheduler Cloud Run 24/7
      </div>
    </div>
  );
}

// ---- Header ----
function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <span className={styles.kicker}>Marche · agregat live</span>
        <h1>Statistiques du marche</h1>
        <p className="text-muted">
          Donnees calculees en temps reel depuis Firestore. Filtre par marque, modele, annee,
          kilometrage, prix ou pays — tous les charts et le top des annonces s'adaptent.
        </p>
      </div>
    </header>
  );
}

// ---- FilterBar (multi-champs, fixe le double border) ----
function FilterBar({ draft, setDraft, onApply, onReset, loading }) {
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  function onSubmit(e) { e.preventDefault(); onApply(); }

  return (
    <Card padding="md" className={styles.filterCard}>
      <form onSubmit={onSubmit} className={styles.filterForm}>
        <div className={styles.filterGrid}>
          <Input
            label="Marque"
            placeholder="Toyota, BMW…"
            value={draft.make}
            onChange={set('make')}
          />
          <Input
            label="Modele"
            placeholder="Prius, Serie 3…"
            value={draft.model}
            onChange={set('model')}
          />
          <Input
            label="Annee min"
            type="number"
            min="1990"
            placeholder="2015"
            value={draft.yearMin}
            onChange={set('yearMin')}
            leftIcon={<Calendar size={14} />}
          />
          <Input
            label="Km max"
            type="number"
            min="0"
            step="5000"
            placeholder="150000"
            value={draft.mileageMax}
            onChange={set('mileageMax')}
            leftIcon={<Gauge size={14} />}
          />
          <Input
            label="Prix max"
            type="number"
            min="0"
            step="500"
            placeholder="8000"
            value={draft.priceMax}
            onChange={set('priceMax')}
            leftIcon={<Euro size={14} />}
          />
          <Select
            label="Pays"
            value={draft.country}
            onChange={set('country')}
            options={COUNTRY_OPTIONS}
          />
        </div>
        <div className={styles.filterActions}>
          <Button type="button" variant="ghost" size="sm" leftIcon={<RotateCcw size={14} />} onClick={onReset}>
            Reset
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={loading}>
            {loading ? 'Calcul…' : 'Appliquer'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ---- Filter chips (recap des filtres appliques) ----
function FilterChips({ applied, onClear }) {
  const chips = [];
  if (applied.make) chips.push({ key: 'make', label: 'marque', value: applied.make });
  if (applied.model) chips.push({ key: 'model', label: 'modele', value: applied.model });
  if (applied.yearMin) chips.push({ key: 'yearMin', label: 'annee min', value: applied.yearMin });
  if (applied.mileageMax) chips.push({ key: 'mileageMax', label: 'km max', value: formatMileage(applied.mileageMax) });
  if (applied.priceMax) chips.push({ key: 'priceMax', label: 'prix max', value: formatPrice(applied.priceMax, 'EUR') });
  if (applied.country) chips.push({ key: 'country', label: 'pays', value: COUNTRY_LABEL[applied.country] || applied.country });

  if (!chips.length) return null;

  return (
    <div className={styles.chipsRow}>
      <span className={styles.chipsLabel}>filtres actifs</span>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          className={styles.chip}
          onClick={() => onClear(c.key)}
          aria-label={`Retirer ${c.label}`}
        >
          <span className={styles.chipKey}>{c.label}</span>
          <span className={styles.chipValue}>{c.value}</span>
          <span className={styles.chipX}>×</span>
        </button>
      ))}
    </div>
  );
}

// ---- KPI hero ----
function KpiHero({ match, overview }) {
  const total = match?.total ?? 0;
  const median = match?.prices?.median ?? null;
  const avgYear = match?.years?.average ?? null;
  const avgKm = match?.mileage?.average ?? null;

  const totalA = useCountUp(total);
  const medianA = useCountUp(median ?? 0);
  const avgKmA = useCountUp(avgKm ?? 0, { duration: 1000 });

  return (
    <div className={styles.kpis}>
      <Kpi
        icon={<Database size={18} />}
        label="annonces selection"
        value={formatNumber(totalA)}
        sub={total > 0 ? `sur ${match?.daysWindow ?? 60}j fenetre glissante` : (overview?.total ? `${formatNumber(overview.total)} en base` : 'aucune annonce')}
      />
      <Kpi
        icon={<Euro size={18} />}
        label="mediane prix"
        value={median != null ? formatPrice(medianA, 'EUR') : '—'}
        sub={median != null ? 'sur la selection' : 'pas assez de donnees'}
      />
      <Kpi
        icon={<Calendar size={18} />}
        label="annee moyenne"
        value={avgYear != null ? avgYear : '—'}
        sub={avgYear != null ? 'sur la selection' : 'pas assez de donnees'}
        accent="success"
      />
      <Kpi
        icon={<Gauge size={18} />}
        label="km moyen"
        value={avgKm != null ? formatMileage(avgKmA) : '—'}
        sub={avgKm != null ? 'sur la selection' : 'pas assez de donnees'}
      />
    </div>
  );
}

function Kpi({ icon, label, value, sub, accent }) {
  return (
    <div className={[styles.kpiCard, accent === 'success' ? styles.kpiCardSuccess : ''].join(' ')}>
      <div className={styles.kpiTopRow}>
        <span className={styles.kpiIcon}>{icon}</span>
        <span className={styles.kpiLabel}>{label}</span>
      </div>
      <div className={`${styles.kpiValue} tabular`}>{value}</div>
      <div className={styles.kpiSub}>{sub}</div>
    </div>
  );
}

// ---- Section title ----
function SectionTitle({ icon, kicker, children }) {
  return (
    <div className={styles.sectionHead}>
      <div className={styles.sectionHeadInner}>
        <span className={styles.sectionKicker}>{kicker}</span>
        <h3 className={styles.sectionTitle}>{children}</h3>
      </div>
      <span className={styles.sectionIcon}>{icon}</span>
    </div>
  );
}

// ---- Volume area chart ----
function VolumeChart({ data }) {
  const formatted = useMemo(() => data.map((d) => ({ ...d, short: d.date.slice(5) })), [data]);
  if (!data.length) return <div className={styles.empty}>Aucun volume sur la periode.</div>;

  return (
    <div className={styles.chartArea}>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={formatted} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-volume" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.55} />
              <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke={CHART_COLORS.border} vertical={false} />
          <XAxis
            dataKey="short"
            tick={{ fill: CHART_COLORS.textSubtle, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.border }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: CHART_COLORS.textSubtle, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip content={<DarkTooltip suffix=" annonces" />} cursor={{ stroke: CHART_COLORS.accent, strokeWidth: 1, strokeDasharray: '3 3' }} />
          <Area
            type="monotone"
            dataKey="count"
            stroke={CHART_COLORS.accentDeep}
            strokeWidth={2}
            fill="url(#grad-volume)"
            isAnimationActive
            animationDuration={1100}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function VolumeFooter({ data }) {
  const total = data.reduce((s, v) => s + v.count, 0);
  const avg = data.length ? Math.round(total / data.length) : 0;
  const peak = data.reduce((max, v) => (v.count > max.count ? v : max), { count: 0, date: '—' });
  return (
    <div className={styles.metricsRow}>
      <Metric label="cumul" value={formatNumber(total)} />
      <Metric label="moyenne / jour" value={formatNumber(avg)} />
      <Metric label="pic" value={`${formatNumber(peak.count)} · ${peak.date}`} accent />
    </div>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div className={[styles.miniMetric, accent ? styles.miniMetricAccent : ''].join(' ')}>
      <span className={styles.miniMetricLabel}>{label}</span>
      <span className={`${styles.miniMetricValue} tabular`}>{value}</span>
    </div>
  );
}

// ---- Top models horizontal bar chart ----
function TopModelsChart({ data }) {
  if (!data.length) return <div className={styles.empty}>Aucun modele dans la selection.</div>;
  const formatted = data.slice(0, 10).map((m, i) => ({
    name: `${m.make} ${m.model}`,
    count: m.count,
    rank: i + 1,
  }));

  return (
    <div className={styles.chartArea}>
      <ResponsiveContainer width="100%" height={Math.max(220, formatted.length * 32)}>
        <BarChart data={formatted} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-bar-h" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={CHART_COLORS.ink} stopOpacity={0.95} />
              <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0.85} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke={CHART_COLORS.border} horizontal={false} />
          <XAxis type="number" tick={{ fill: CHART_COLORS.textSubtle, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fill: CHART_COLORS.ink, fontSize: 11 }} tickLine={false} axisLine={{ stroke: CHART_COLORS.border }} width={130} />
          <Tooltip content={<DarkTooltip suffix=" annonces" />} cursor={{ fill: 'rgba(232,176,66,0.08)' }} />
          <Bar dataKey="count" fill="url(#grad-bar-h)" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={1000} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---- Source donut ----
function SourceDonut({ data }) {
  if (!data.length) return <div className={styles.empty}>Aucune source active.</div>;
  const total = data.reduce((s, c) => s + c.count, 0);
  const formatted = data.slice(0, 8).map((c, i) => ({
    name: SOURCE_META_BY_ID[c.sourceId]?.label || c.sourceId,
    value: c.count,
    color: SOURCES_META.find((s) => s.id === c.sourceId)?.color || SOURCE_PALETTE[i % SOURCE_PALETTE.length],
  }));
  const others = data.slice(8).reduce((s, c) => s + c.count, 0);
  if (others > 0) formatted.push({ name: 'Autres', value: others, color: CHART_COLORS.textSubtle });

  return (
    <div className={styles.donutWrap}>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={formatted} innerRadius={62} outerRadius={102} paddingAngle={2} dataKey="value" stroke="var(--color-paper)" strokeWidth={2} isAnimationActive animationDuration={900} animationBegin={120}>
            {formatted.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip content={<DarkTooltip suffix=" annonces" />} />
          <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" iconSize={8}
            wrapperStyle={{ fontSize: 11, fontFamily: 'inherit', paddingLeft: 12 }}
            formatter={(v) => <span style={{ color: CHART_COLORS.textSubtle }}>{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className={styles.donutCenter}>
        <span className={styles.donutCenterValue}>{formatNumber(total)}</span>
        <span className={styles.donutCenterLabel}>annonces</span>
      </div>
    </div>
  );
}

// ---- Country bars ----
function CountryBreakdown({ data }) {
  if (!data.length) return <div className={styles.empty}>Aucune donnee pays pour cette selection.</div>;
  const top = data.slice(0, 12).map((c) => ({
    country: c.country,
    label: COUNTRY_LABEL[c.country] || c.country,
    count: c.count,
  }));
  return (
    <div className={styles.chartArea}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={top} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-bar-v" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.95} />
              <stop offset="100%" stopColor={CHART_COLORS.accentDeep} stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke={CHART_COLORS.border} vertical={false} />
          <XAxis dataKey="country" tick={{ fill: CHART_COLORS.ink, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }} tickLine={false} axisLine={{ stroke: CHART_COLORS.border }} />
          <YAxis tick={{ fill: CHART_COLORS.textSubtle, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} width={40} />
          <Tooltip content={<DarkTooltip suffix=" annonces" labelFormatter={(c) => COUNTRY_LABEL[c] || c} />} cursor={{ fill: 'rgba(16,18,22,0.06)' }} />
          <Bar dataKey="count" fill="url(#grad-bar-v)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={1000} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---- Price distribution histogram ----
function PriceDistribution({ data }) {
  const buckets = data.buckets.map((b) => ({
    label: `${Math.round(b.from / 1000)}k`,
    range: `${formatPrice(b.from, 'EUR')} – ${formatPrice(b.to, 'EUR')}`,
    count: b.count,
  }));
  return (
    <div className={styles.chartArea}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={buckets} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-dist" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.ink} stopOpacity={0.92} />
              <stop offset="100%" stopColor={CHART_COLORS.ink} stopOpacity={0.65} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke={CHART_COLORS.border} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART_COLORS.textSubtle, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={{ stroke: CHART_COLORS.border }} />
          <YAxis tick={{ fill: CHART_COLORS.textSubtle, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} width={32} />
          <Tooltip content={<DarkTooltip suffix=" annonces" labelFormatter={(_l, p) => p?.[0]?.payload?.range || _l} />} cursor={{ fill: 'rgba(232,176,66,0.08)' }} />
          <Bar dataKey="count" fill="url(#grad-dist)" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={1000} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
      <div className={styles.distFooter}>
        <span>{formatNumber(data.total)} annonces</span>
        <span>tranche : {formatPrice(data.step, 'EUR')}</span>
      </div>
    </div>
  );
}

// ---- Price spread ----
function PriceSpread({ stats, applied }) {
  const { min, max, p25, p75, median, average, count } = stats;
  const range = max - min || 1;
  const pos = (v) => `${Math.max(0, Math.min(100, ((v - min) / range) * 100))}%`;

  return (
    <div className={styles.spread}>
      <div className={styles.spreadHeader}>
        <div>
          <span className={styles.spreadKicker}>echantillon</span>
          <div className={styles.spreadHeaderValue}>
            <span className="tabular">{formatNumber(count)}</span> annonces
            {applied.country && <span className={styles.spreadHeaderTag}>{COUNTRY_LABEL[applied.country] || applied.country}</span>}
          </div>
        </div>
        <div>
          <span className={styles.spreadKicker}>moyenne</span>
          <div className={`${styles.spreadHeaderValue} tabular`}>{formatPrice(average, 'EUR')}</div>
        </div>
      </div>

      <div className={styles.spreadBar}>
        <div className={styles.spreadBarRange} style={{ left: pos(p25), right: `calc(100% - ${pos(p75)})` }} />
        <div className={styles.spreadBarMedian} style={{ left: pos(median) }} />
        {[
          { v: min, label: 'min', tone: 'subtle' },
          { v: p25, label: 'p25', tone: 'subtle' },
          { v: median, label: 'mediane', tone: 'accent' },
          { v: p75, label: 'p75', tone: 'subtle' },
          { v: max, label: 'max', tone: 'subtle' },
        ].map((m) => (
          <div key={m.label} className={[styles.spreadMark, m.tone === 'accent' ? styles.spreadMarkAccent : ''].join(' ')} style={{ left: pos(m.v) }}>
            <div className={styles.spreadMarkDot} />
            <div className={`${styles.spreadMarkValue} tabular`}>{formatPrice(m.v, 'EUR')}</div>
            <div className={styles.spreadMarkLabel}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Tooltip custom ----
function DarkTooltip({ active, payload, label, suffix = '', labelFormatter }) {
  if (!active || !payload || !payload.length) return null;
  const labelText = labelFormatter ? labelFormatter(label, payload) : label;
  return (
    <div className={styles.tooltip}>
      {labelText && <div className={styles.tooltipLabel}>{labelText}</div>}
      {payload.map((p, i) => (
        <div key={i} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.color || p.fill || CHART_COLORS.accent }} />
          <span className={`${styles.tooltipValue} tabular`}>{formatNumber(p.value)}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Helpers ----
function toQuery(filters) {
  const out = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v == null || v === '') continue;
    out[k] = v;
  }
  return out;
}

function hasAnyFilter(filters) {
  return Object.values(filters).some((v) => v !== '' && v != null);
}
