import { Truck, Receipt, Landmark, TrendingDown, TrendingUp } from 'lucide-react';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import { formatPrice } from '../../utils/formatters.js';
import { COUNTRY_LABEL } from '../../constants/countries.js';
import styles from './ImportInsightsPanel.module.css';

export default function ImportInsightsPanel({ listing }) {
  const meta = listing.importMeta;
  if (!meta) return null;

  const delta = meta.marketDeltaEstimate;
  const isOpportunity = delta != null && delta < 0;

  return (
    <Card padding="md" className={styles.panel}>
      <div className={styles.header}>
        <h3>Import vers {COUNTRY_LABEL[meta.destinationCountry]}</h3>
        {delta != null && (
          <Badge variant={isOpportunity ? 'success' : 'warning'} size="md">
            {isOpportunity ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {isOpportunity ? 'Opportunité' : 'Prix alignés'}
          </Badge>
        )}
      </div>

      <div className={styles.row}>
        <Line
          icon={<Truck size={16} />}
          label="Transport estimé"
          value={formatPrice(meta.transportCostEstimate, 'EUR')}
        />
        <Line
          icon={<Landmark size={16} />}
          label="Carte grise"
          value={formatPrice(meta.registrationFeeEstimate, 'EUR')}
        />
        <Line
          icon={<Receipt size={16} />}
          label="Malus écologique"
          value={formatPrice(meta.ecoTaxEstimate, 'EUR')}
          hint="V1 — à préciser avec le CO2 réel"
        />
      </div>

      <div className={styles.totals}>
        <div>
          <div className={styles.totalsLabel}>Prix affiché</div>
          <div className={`${styles.totalsValue} tabular`}>{formatPrice(listing.price?.amount, listing.price?.currency)}</div>
        </div>
        <div>
          <div className={styles.totalsLabel}>Surcoût import estimé</div>
          <div className={`${styles.totalsValue} tabular`}>+ {formatPrice(meta.totalEstimatedOverhead, 'EUR')}</div>
        </div>
        <div>
          <div className={styles.totalsLabel}>Prix total estimé</div>
          <div className={`${styles.totalsValueStrong} tabular`}>{formatPrice(meta.importedPriceEstimate, 'EUR')}</div>
        </div>
        {delta != null && (
          <div>
            <div className={styles.totalsLabel}>Vs. marché FR équivalent</div>
            <div className={[styles.totalsValueStrong, 'tabular', delta < 0 ? styles.positive : styles.negative].join(' ')}>
              {delta < 0 ? '−' : '+'} {formatPrice(Math.abs(delta), 'EUR')}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function Line({ icon, label, value, hint }) {
  return (
    <div className={styles.line}>
      <span className={styles.lineIcon}>{icon}</span>
      <div>
        <div className={styles.lineLabel}>{label}</div>
        {hint && <div className={styles.lineHint}>{hint}</div>}
      </div>
      <div className={`${styles.lineValue} tabular`}>{value}</div>
    </div>
  );
}
