import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Heart, ExternalLink, AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import LoadingState from '../components/ui/LoadingState.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import CarImage from '../components/ui/CarImage.jsx';
import SourceBadge from '../components/listing/SourceBadge.jsx';
import CountryBadge from '../components/listing/CountryBadge.jsx';
import ListingSpecs from '../components/listing/ListingSpecs.jsx';
import ImportInsightsPanel from '../components/listing/ImportInsightsPanel.jsx';
import { formatPrice } from '../utils/formatters.js';
import { apiClient } from '../services/api/client.js';
import { useFavoritesStore } from '../store/favoritesStore.js';
import { buildSearchUrlForSource } from '../services/sources/urls.js';
import { FUEL_LABEL } from '../constants/fuels.js';
import styles from './ListingDetailPage.module.css';

// Cascade de résolution :
//   1. navigation state (clic depuis la liste) → affichage instantané, 0 requête
//   2. API backend GET /api/listings/:id → lit le cache serveur (hit si recherche récente)
//   3. 404 propre : "annonce expirée, relancez votre recherche"
export default function ListingDetailPage() {
  const { id: rawId } = useParams();
  const listingId = decodeURIComponent(rawId);
  const navigate = useNavigate();
  const location = useLocation();
  const stateListing = location.state?.listing;

  const [status, setStatus] = useState(stateListing ? 'ready' : 'loading');
  const [listing, setListing] = useState(stateListing || null);

  const isFav = useFavoritesStore((s) => s.isFavorite(listingId));
  const toggle = useFavoritesStore((s) => s.toggle);

  useEffect(() => {
    // Si on a déjà l'annonce via state (clic depuis la liste), on ne refetch pas.
    if (stateListing && stateListing.id === listingId) return;

    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        if (!apiClient.isConfigured()) {
          setStatus('expired');
          return;
        }
        const data = await apiClient.listing(listingId);
        if (cancelled) return;
        setListing(data);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        if (err.status === 404) {
          setStatus('expired');
        } else {
          setStatus('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [listingId, stateListing]);

  if (status === 'loading') {
    return <div className="container"><LoadingState count={2} /></div>;
  }
  if (status === 'error') {
    return <div className="container"><ErrorState onRetry={() => navigate(0)} /></div>;
  }
  if (status === 'expired' || !listing) {
    return (
      <div className="container">
        <ErrorState
          title="Annonce expirée"
          description="Cette annonce n'est plus en cache côté serveur. Relance une recherche depuis la liste."
          onRetry={() => navigate('/search')}
        />
      </div>
    );
  }

  const photos = listing.photos?.length ? listing.photos : [null];
  const missing = listing.meta?.fieldsMissing ?? [];
  const searchUrl = buildSearchUrlForSource(listing.source?.id, {
    make: listing.make, model: listing.model,
  });
  const originalUrl = listing.url; // URL directe vers l'annonce source (si disponible en live)

  return (
    <div className="container">
      <div className={styles.backRow}>
        <button type="button" onClick={() => navigate(-1)} className={styles.back}><ArrowLeft size={16} /> Retour</button>
      </div>

      <div className={styles.layout}>
        <div className={styles.col}>
          <div className={styles.gallery}>
            {photos.map((p, i) => (
              <div key={i} className={styles.photo}>
                <CarImage src={p} alt={`${listing.title} — photo ${i + 1}`} make={listing.make} model={listing.model} />
              </div>
            ))}
          </div>

          <Card padding="md">
            <h2 className={styles.sectionTitle}>Caractéristiques</h2>
            <ListingSpecs listing={listing} />
          </Card>

          <Card padding="md">
            <h2 className={styles.sectionTitle}>Équipements</h2>
            {listing.features?.length ? (
              <ul className={styles.features}>
                {listing.features.map((f) => <li key={f} className={styles.feature}>{prettyFeature(f)}</li>)}
              </ul>
            ) : (
              <p className={styles.muted}>Aucun équipement renseigné.</p>
            )}
          </Card>

          {missing.length > 0 && (
            <Card padding="md" className={styles.missing}>
              <div className={styles.missingHeader}><AlertCircle size={16} /> Données partielles</div>
              <p className={styles.muted}>
                Les champs suivants n'ont pas été fournis par la source :
                <span className={styles.missingList}> {missing.join(', ')}</span>.
              </p>
            </Card>
          )}

          {listing.meta?.reconstructed?.length > 0 && (
            <div className={styles.reconstructed}>
              <AlertCircle size={14} /> Champ(s) reconstruit(s) : {listing.meta.reconstructed.join(', ')}
            </div>
          )}
        </div>

        <aside className={styles.side}>
          <Card padding="md">
            <h1 className={styles.title}>{listing.title}</h1>
            <div className={styles.subtitle}>
              <span className="tabular">{listing.year ?? '—'}</span> · <span className="tabular">{listing.mileageKm?.toLocaleString('fr-FR') ?? '—'} km</span>
              {listing.fuel && <> · {FUEL_LABEL[listing.fuel]}</>}
            </div>
            <div className={`${styles.price} tabular`}>{formatPrice(listing.price?.amount, listing.price?.currency)}</div>

            <div className={styles.badgeRow}>
              <CountryBadge code={listing.country} />
              <SourceBadge source={listing.source} />
              {listing.seller?.type === 'dealer' && <Badge variant="neutral">Pro</Badge>}
              {listing.seller?.type === 'private' && <Badge variant="outline">Particulier</Badge>}
              {listing.history?.firstHand === true && <Badge variant="outline">1ère main</Badge>}
              {listing.history?.accidentFree === true && <Badge variant="outline">Sans accident</Badge>}
            </div>

            <div className={styles.actions}>
              <Button
                variant={isFav ? 'secondary' : 'primary'}
                leftIcon={<Heart size={16} fill={isFav ? 'currentColor' : 'none'} />}
                onClick={() => toggle(listing)}
                fullWidth
              >
                {isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              </Button>
              {originalUrl && (
                <a href={originalUrl} target="_blank" rel="noreferrer" className={styles.externalLinkPrimary}>
                  Voir l'annonce sur {listing.source.label} <ExternalLink size={14} />
                </a>
              )}
              {searchUrl && (
                <a href={searchUrl} target="_blank" rel="noreferrer" className={styles.externalLink}>
                  Toutes les annonces {listing.make} {listing.model} sur {listing.source.label} <ExternalLink size={14} />
                </a>
              )}
            </div>
          </Card>

          {listing.importMeta && <ImportInsightsPanel listing={listing} />}
        </aside>
      </div>
    </div>
  );
}

function prettyFeature(key) {
  const map = {
    gps: 'GPS', camera: 'Caméra', leather: 'Cuir', sunroof: 'Toit ouvrant',
    carplay: 'Apple CarPlay', heated_seats: 'Sièges chauffants',
    adaptive_cruise: 'Régulateur adaptatif', cruise_control: 'Régulateur',
    bluetooth: 'Bluetooth', park_assist: 'Aide au stationnement',
    autopilot: 'Autopilot', led: 'Phares LED',
  };
  return map[key] || key;
}
