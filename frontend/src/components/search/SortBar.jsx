import Select from '../ui/Select.jsx';
import styles from './SortBar.module.css';
import { pluralize } from '../../utils/formatters.js';

const OPTIONS = [
  { value: 'relevance', label: 'Pertinence' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'year_desc', label: 'Année (plus récent)' },
  { value: 'mileage_asc', label: 'Kilométrage (plus bas)' },
  { value: 'posted_desc', label: 'Plus récentes' },
];

export default function SortBar({ count, sort, onSortChange }) {
  return (
    <div className={styles.bar}>
      <div className={styles.count}>{pluralize(count, 'résultat', 'résultats')}</div>
      <div className={styles.sortBox}>
        <Select
          label={undefined}
          options={OPTIONS}
          value={sort || 'relevance'}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label="Trier par"
        />
      </div>
    </div>
  );
}
