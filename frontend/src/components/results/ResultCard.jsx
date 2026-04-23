import { Link } from 'react-router-dom';
import { Heart, MapPin, TrendingDown } from 'lucide-react';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import CarImage from '../ui/CarImage.jsx';
import SourceBadge from '../listing/SourceBadge.jsx';
import CountryBadge from '../listing/CountryBadge.jsx';
import { formatPrice, formatMileage, formatYear, formatPowerHp } from '../../utils/formatters.js';
import { FUEL_LABEL } from '../../constants/fuels.js';
import { TRANSMISSION_LABEL } from '../../constants/transmissions.js';
import { useFavoritesStore } from '../../store/favoritesStore.js';
import styles from './ResultCard.module.css';

export default function ResultCard({ listing }) {
  const isFav = useFavoritesStore((s) => s.isFavorite(listing.id));
  const toggle = useFavoritesStore((s) => s.toggle);

  const detailUrl = `/listing/${encodeURIComponent(listing.id)}`;
  const importMeta = listing.importMeta;
  const hasImportOpportunity = importMeta?.marketDeltaEstimate != null && importMeta.marketDeltaEstimate < -500;

  return (
    <Card padding="none" className={styles.card}>
      <Link to={detailUrl} state={{ listing }} className={styles.media} aria-label={`Voir ${listing.title || 'annonce'}`}>
        <CarImage src={listing.photos?.[0]} alt={listing.title} make={listing.make} model={listing.model} />
      </Link>

      <div className={styles.body}>
        <div className={styles.headerRow}>
          <Link to={detailUrl} state={{ listing }} className={styles.title}>
            {listing.title || `${listing.make ?? ''} ${listing.model ?? ''}`.trim() || 'Annonce sans titre'}
          </Link>
          <button
            type="button"
            className={[styles.fav, isFav ? styles.favOn : ''].join(' ')}
            onClick={() => toggle(listing)}
            aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            aria-pressed={isFav}
          >
            <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className={styles.specs}>
          <span className="tabular">{formatYear(listing.year)}</span>
          <Dot />
          <span className="tabular">{formatMileage(listing.mileageKm)}</span>
          {listing.fuel && (<><Dot /><span>{FUEL_LABEL[listing.fuel]}</span></>)}
          {listing.transmission && (<><Dot /><span>{TRANSMISSION_LABEL[listing.transmission]}</span></>)}
          {listing.powerHp && (<><Dot /><span className="tabular">{formatPowerHp(listing.powerHp)}</span></>)}
        </div>

        <div className={styles.meta}>
          <span className={styles.location}>
            <MapPin size={14} aria-hidden /> {[listing.city, listing.country].filter(Boolean).join(' · ')}
          </span>
          <div className={styles.badges}>
            <CountryBadge code={listing.country} />
            <SourceBadge source={listing.source} />
            {listing.history?.firstHand === true && <Badge variant="outline" size="sm">1ère main</Badge>}
            {listing.history?.accidentFree === true && <Badge variant="outline" size="sm">Sans accident</Badge>}
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.priceBlock}>
            <div className={`${styles.price} tabular`}>{formatPrice(listing.price?.amount, listing.price?.currency)}</div>
            {importMeta?.importedPriceEstimate != null && (
              <div className={styles.priceImport}>
                Estimé importé <span className="tabular">{formatPrice(importMeta.importedPriceEstimate, 'EUR')}</span>
              </div>
            )}
          </div>
          {hasImportOpportunity && (
            <Badge variant="success" size="md">
              <TrendingDown size={12} /> Opportunité import
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

function Dot() { return <span className={styles.dot} aria-hidden>·</span>; }
