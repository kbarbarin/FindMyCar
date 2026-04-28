import { COUNTRY_LABEL } from '../../constants/countries.js';
import styles from './Badges.module.css';

// Plaque immat. EU : bande bleue ⊕ étoiles + code pays.
// Couleur de la bande adaptée au pays quand on a une teinte signature.
const COUNTRY_BAND = {
  FR: 'linear-gradient(180deg, var(--flag-fr-blue) 0 60%, var(--flag-fr-red) 60% 100%)',
  DE: 'linear-gradient(180deg, #000 0 33%, var(--flag-de-red) 33% 66%, var(--flag-de-gold) 66% 100%)',
  BE: 'linear-gradient(180deg, #000 0 33%, var(--flag-de-gold) 33% 66%, var(--flag-be-red) 66% 100%)',
  NL: 'linear-gradient(180deg, var(--flag-be-red) 0 33%, #fff 33% 66%, var(--flag-nl-blue) 66% 100%)',
  IT: 'linear-gradient(180deg, var(--flag-it-green) 0 33%, #fff 33% 66%, var(--flag-it-red) 66% 100%)',
  ES: 'linear-gradient(180deg, var(--flag-es-red) 0 25%, var(--flag-es-yellow) 25% 75%, var(--flag-es-red) 75% 100%)',
  CH: 'linear-gradient(180deg, var(--flag-be-red) 0 100%)',
  PT: 'linear-gradient(180deg, var(--flag-it-green) 0 40%, var(--flag-be-red) 40% 100%)',
  PL: 'linear-gradient(180deg, #fff 0 50%, var(--flag-be-red) 50% 100%)',
  SE: 'linear-gradient(180deg, var(--flag-nl-blue) 0 100%)',
  NO: 'linear-gradient(180deg, var(--flag-be-red) 0 100%)',
  FI: 'linear-gradient(180deg, var(--flag-nl-blue) 0 100%)',
  DK: 'linear-gradient(180deg, var(--flag-be-red) 0 100%)',
  RO: 'linear-gradient(180deg, var(--flag-nl-blue) 0 33%, var(--flag-de-gold) 33% 66%, var(--flag-be-red) 66% 100%)',
  BG: 'linear-gradient(180deg, #fff 0 33%, var(--flag-it-green) 33% 66%, var(--flag-be-red) 66% 100%)',
  GR: 'linear-gradient(180deg, var(--flag-nl-blue) 0 100%)',
  LT: 'linear-gradient(180deg, var(--flag-de-gold) 0 33%, var(--flag-it-green) 33% 66%, var(--flag-be-red) 66% 100%)',
  LV: 'linear-gradient(180deg, var(--flag-be-red) 0 100%)',
  EE: 'linear-gradient(180deg, var(--flag-nl-blue) 0 33%, #000 33% 66%, #fff 66% 100%)',
  HU: 'linear-gradient(180deg, var(--flag-be-red) 0 33%, #fff 33% 66%, var(--flag-it-green) 66% 100%)',
  LU: 'linear-gradient(180deg, var(--flag-be-red) 0 33%, #fff 33% 66%, var(--flag-nl-blue) 66% 100%)',
};

export default function CountryBadge({ code }) {
  if (!code) return null;
  const band = COUNTRY_BAND[code] || `linear-gradient(180deg, var(--flag-eu-blue) 0 100%)`;
  return (
    <span className={styles.country} title={COUNTRY_LABEL[code] ?? code}>
      <span className={styles.plateLeft} aria-hidden style={{ background: band }}>
        <span className={styles.plateStars} aria-hidden>★</span>
      </span>
      <span className={styles.plateCode}>{code}</span>
    </span>
  );
}
