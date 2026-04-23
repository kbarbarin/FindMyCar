import { COUNTRY_LABEL } from '../../constants/countries.js';
import styles from './Badges.module.css';

// Mini "plaque" pays.
export default function CountryBadge({ code }) {
  if (!code) return null;
  return (
    <span className={styles.country} title={COUNTRY_LABEL[code] ?? code}>
      <span className={styles.plateLeft} aria-hidden />
      <span className={styles.plateCode}>{code}</span>
    </span>
  );
}
