import { getAllConnectorsMeta } from '../services/sources/registry.js';
import styles from './Footer.module.css';

export default function Footer() {
  const sources = getAllConnectorsMeta();
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.top}>
          <div className={styles.brandCol}>
            <div className={styles.bigMark}>
              <span className={styles.bigMarkSerif}>findmy</span>
              <span className={styles.bigMarkMono}>car</span>
            </div>
            <p className={styles.note}>
              Meta-moteur de recherche d'annonces de voitures d'occasion.
              France &amp; Europe. Une seule cabine, toutes les sources.
            </p>
            <div className={styles.tag}>
              <span className={styles.tagDot} aria-hidden />
              <span className="tabular">EU-OPS / v0.1 · {year}</span>
            </div>
          </div>

          <div className={styles.col}>
            <div className={styles.colTitle}>Sources agregees</div>
            <ul className={styles.sources}>
              {sources.slice(0, 6).map((s) => (
                <li key={s.id}>
                  <span className={styles.sourceDot} style={{ background: s.color || 'var(--color-accent)' }} aria-hidden />
                  <span>{s.label}</span>
                  <span className={`${styles.sourceCountry} tabular`}>{s.country}</span>
                </li>
              ))}
              {sources.length > 6 && (
                <li className={styles.sourceMore}>
                  <span>+{sources.length - 6} autres marketplaces</span>
                </li>
              )}
            </ul>
          </div>

          <div className={styles.col}>
            <div className={styles.colTitle}>Operations</div>
            <ul className={styles.links}>
              <li>Recherche par marque / modele</li>
              <li>Filtres avances · pays · annee · km</li>
              <li>Estimation prix marche</li>
              <li>Cout d'import &amp; taxes</li>
              <li>Suivi temps reel du scraping</li>
            </ul>
          </div>

          <div className={styles.col}>
            <div className={styles.colTitle}>Legal</div>
            <p className={styles.note}>
              &copy; {year} FindMyCar. Les marques citees appartiennent a leurs proprietaires.
              Aucune affiliation officielle avec les marketplaces sources.
            </p>
          </div>
        </div>

        <div className={styles.bottom}>
          <span className={`${styles.bottomItem} tabular`}>LAT 48.8566 · LON 2.3522</span>
          <span className={styles.bottomDivider} aria-hidden />
          <span className={styles.bottomItem}>Built in Paris · driven across EU</span>
        </div>
      </div>
    </footer>
  );
}
