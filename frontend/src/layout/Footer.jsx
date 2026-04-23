import { getAllConnectorsMeta } from '../services/sources/registry.js';
import styles from './Footer.module.css';

export default function Footer() {
  const sources = getAllConnectorsMeta();
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.row}`}>
        <div className={styles.column}>
          <div className={styles.title}>FindMyCar</div>
          <p className={styles.note}>Méta-moteur de recherche d'annonces de voitures d'occasion. V1 locale — données mockées.</p>
        </div>
        <div className={styles.column}>
          <div className={styles.title}>Sources agrégées</div>
          <ul className={styles.sources}>
            {sources.map((s) => (
              <li key={s.id}>{s.label} — {s.country}</li>
            ))}
          </ul>
        </div>
        <div className={styles.column}>
          <div className={styles.title}>Légal</div>
          <p className={styles.note}>© {new Date().getFullYear()} FindMyCar. Les marques citées appartiennent à leurs propriétaires.</p>
        </div>
      </div>
    </footer>
  );
}
