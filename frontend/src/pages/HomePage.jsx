import { Globe, Filter, Sparkles } from 'lucide-react';
import SearchBar from '../components/search/SearchBar.jsx';
import { getAllConnectorsMeta } from '../services/sources/registry.js';
import styles from './HomePage.module.css';

export default function HomePage() {
  const sources = getAllConnectorsMeta();

  return (
    <div className="container">
      <section className={styles.hero}>
        <div className={styles.eyebrow}>Méta-moteur de recherche auto</div>
        <h1 className={styles.title}>
          Trouvez la bonne voiture.<br /> <span className={styles.titleAccent}>Où qu'elle soit.</span>
        </h1>
        <p className={styles.subtitle}>
          FindMyCar agrège les annonces de plusieurs marketplaces françaises et européennes,
          normalise les données et vous suggère comment élargir votre recherche quand le marché est étroit.
        </p>

        <div className={styles.searchWrap}>
          <SearchBar autoFocus size="lg" />
        </div>

        <div className={styles.features}>
          <Feature
            icon={<Globe size={18} />}
            title="Agrégation multi-sources"
            desc={`Annonces normalisées depuis ${sources.length} sources, FR & EU.`}
          />
          <Feature
            icon={<Filter size={18} />}
            title="Filtres experts"
            desc="Marque, modèle, année, km, prix, carburant, pays, options — tout est combinable."
          />
          <Feature
            icon={<Sparkles size={18} />}
            title="Suggestions actives"
            desc="Quand il y a peu de résultats, on vous propose des élargissements pertinents."
          />
        </div>
      </section>
    </div>
  );
}

function Feature({ icon, title, desc }) {
  return (
    <div className={styles.feature}>
      <div className={styles.featureIcon}>{icon}</div>
      <div>
        <div className={styles.featureTitle}>{title}</div>
        <div className={styles.featureDesc}>{desc}</div>
      </div>
    </div>
  );
}
