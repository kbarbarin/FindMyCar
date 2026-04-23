import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import SearchBar from '../components/search/SearchBar.jsx';
import AdvancedFiltersPanel from '../components/search/AdvancedFiltersPanel.jsx';
import SearchSuggestions from '../components/search/SearchSuggestions.jsx';
import SortBar from '../components/search/SortBar.jsx';
import ResultsList from '../components/results/ResultsList.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingState from '../components/ui/LoadingState.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import DemoBanner from '../components/ui/DemoBanner.jsx';
import { useCriteriaQuery } from '../hooks/useQueryParams.js';
import { useSearch } from '../hooks/useSearch.js';
import { SOURCE_META_BY_ID } from '../constants/sources.js';
import styles from './ResultsPage.module.css';

export default function ResultsPage() {
  const [criteria, setCriteria] = useCriteriaQuery();
  const { status, results, suggestions, error, partialSources, sourceStats, fromBackend } = useSearch(criteria);
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function applyPatch(patch) {
    setCriteria(patch);
    setDrawerOpen(false);
  }
  function reset() { navigate('/search'); }

  // Ferme le drawer quand on repasse en desktop.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1025px)');
    const onChange = (e) => { if (e.matches) setDrawerOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Bloque le scroll body quand le drawer est ouvert.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = drawerOpen ? 'hidden' : prev;
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  const activeFiltersCount = countActive(criteria);

  return (
    <div className="container">
      <div className={styles.searchHeader}>
        <SearchBar defaultValue={criteria.q ?? ''} size="md" />
      </div>

      <div className={styles.demoWrap}>
        <DemoBanner fromBackend={fromBackend} sourceStats={sourceStats} partialSources={partialSources} />
      </div>

      <div className={styles.mobileBar}>
        <Button variant="secondary" size="sm" leftIcon={<SlidersHorizontal size={16} />} onClick={() => setDrawerOpen(true)}>
          Filtres {activeFiltersCount > 0 && <span className={styles.badge}>{activeFiltersCount}</span>}
        </Button>
      </div>

      <div className={styles.layout}>
        <div className={[styles.sidebar, drawerOpen ? styles.sidebarOpen : ''].join(' ')}>
          <div className={styles.drawerHeader}>
            <span>Filtres</span>
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Fermer" className={styles.drawerClose}>
              <X size={18} />
            </button>
          </div>
          <AdvancedFiltersPanel
            criteria={criteria}
            onChange={applyPatch}
            onReset={reset}
          />
          <div className={styles.drawerFooter}>
            <Button variant="primary" fullWidth onClick={() => setDrawerOpen(false)}>
              Voir les résultats
            </Button>
          </div>
        </div>

        {drawerOpen && <div className={styles.backdrop} onClick={() => setDrawerOpen(false)} aria-hidden />}

        <div className={styles.main}>
          {partialSources.length > 0 && (
            <div className={styles.partialBanner} role="status">
              Certaines sources n'ont pas pu répondre ({partialSources.map((s) => SOURCE_META_BY_ID[s.id]?.label || s.id).join(', ')}). Résultats partiels.
            </div>
          )}

          {suggestions.length > 0 && status !== 'loading' && (
            <SearchSuggestions suggestions={suggestions} onApply={applyPatch} />
          )}

          <SortBar
            count={results.length}
            sort={criteria.sort || 'relevance'}
            onSortChange={(v) => applyPatch({ sort: v })}
          />

          {status === 'idle' && (
            <Card padding="lg">
              <EmptyState
                title="Commencez votre recherche"
                description="Saisissez une marque, un modèle, ou décrivez ce que vous cherchez en langage naturel."
              />
            </Card>
          )}

          {status === 'loading' && <LoadingState count={4} />}

          {status === 'error' && (
            <ErrorState
              title="Recherche impossible"
              description={error}
              onRetry={() => setCriteria({ ...criteria })}
            />
          )}

          {(status === 'success' || status === 'partial') && results.length > 0 && (
            <ResultsList listings={results} />
          )}

          {status === 'empty' && (
            <EmptyState
              title="Aucune annonce ne correspond"
              description="Essayez une suggestion ci-dessus ou élargissez vos critères."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function countActive(c) {
  let n = 0;
  if (c.make) n++;
  if (c.model) n++;
  if (c.yearMin) n++;
  if (c.yearMax) n++;
  if (c.mileageMin) n++;
  if (c.mileageMax) n++;
  if (c.priceMin) n++;
  if (c.priceMax) n++;
  if (c.fuel?.length) n += c.fuel.length;
  if (c.transmission?.length) n += c.transmission.length;
  if (c.countries?.length) n += c.countries.length;
  if (c.sources?.length) n += c.sources.length;
  if (c.firstHandOnly) n++;
  if (c.importFriendly) n++;
  return n;
}
