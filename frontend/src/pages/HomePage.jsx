import { Globe2, ScanLine, GaugeCircle } from 'lucide-react';
import SearchBar from '../components/search/SearchBar.jsx';
import { getAllConnectorsMeta } from '../services/sources/registry.js';
import styles from './HomePage.module.css';

export default function HomePage() {
  const sources = getAllConnectorsMeta();

  return (
    <div className="container">
      <section className={styles.hero}>
        <div className={styles.heroHead}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            <span className="tabular">META-MOTEUR · {sources.length} SOURCES · 6 PAYS</span>
          </div>

          <h1 className={styles.title}>
            <span className={styles.titleLine1}>
              <span className={styles.titleSerif}>Trouvez</span>
              <span className={styles.titleSans}>la bonne</span>
            </span>
            <span className={styles.titleLine2}>
              <span className={styles.titleMono}>occasion.</span>
              <span className={styles.titleSerif}>ou qu'elle soit.</span>
            </span>
          </h1>

          <p className={styles.subtitle}>
            FindMyCar agrege en temps reel les annonces de Leboncoin, AutoScout24, La Centrale et plus de
            <span className="tabular"> {sources.length} </span>marketplaces europeennes. Une seule cabine, toutes les pistes.
          </p>
        </div>

        <div className={styles.searchWrap}>
          <SearchBar autoFocus size="lg" />
        </div>

        <div className={styles.stats}>
          <Stat number={sources.length} label="sources connectees" detail="FR · DE · BE · NL · IT · ES" />
          <Stat number="03" label="pays scrappes en live" detail="Leboncoin · AutoScout24 · LaCentrale" />
          <Stat number="< 8s" label="temps moyen scrap" detail="cache Firestore + scrap continu" />
        </div>
      </section>

      <section className={styles.features}>
        <header className={styles.featuresHeader}>
          <span className={styles.featuresKicker}>Cockpit</span>
          <h2 className={styles.featuresTitle}>Trois instruments, un cap</h2>
        </header>

        <div className={styles.featuresGrid}>
          <Feature
            number="01"
            icon={<Globe2 size={22} strokeWidth={1.5} />}
            title="Agregation multi-sources"
            desc={`Annonces normalisees depuis ${sources.length} marketplaces, en France et a travers l'Europe. Un format unique, comparable au centieme d'euro.`}
          />
          <Feature
            number="02"
            icon={<ScanLine size={22} strokeWidth={1.5} />}
            title="Filtres experts"
            desc="Marque, modele, annee, kilometrage, prix, carburant, boite, pays, premiere main, sans accident — tout est combinable et persistant dans l'URL."
          />
          <Feature
            number="03"
            icon={<GaugeCircle size={22} strokeWidth={1.5} />}
            title="Estimation marche"
            desc="Pour chaque annonce a l'etranger : prix d'import estime, transport, taxes, ecart vs marche FR equivalent. Vous savez si c'est une vraie affaire."
          />
        </div>
      </section>

      <section className={styles.tape}>
        <div className={styles.tapeInner}>
          {[...Array(2)].flatMap((_, i) =>
            sources.map((s) => (
              <span key={`${i}-${s.id}`} className={styles.tapeCell}>
                <span className={styles.tapeDot} style={{ background: s.color || 'var(--color-accent)' }} />
                <span>{s.label}</span>
                <span className={`${styles.tapeCountry} tabular`}>{s.country}</span>
              </span>
            )),
          )}
        </div>
      </section>
    </div>
  );
}

function Feature({ number, icon, title, desc }) {
  return (
    <article className={styles.feature}>
      <span className={styles.featureNumber}>{number}</span>
      <div className={styles.featureIcon}>{icon}</div>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDesc}>{desc}</p>
      <span className={styles.featureCorner} aria-hidden />
    </article>
  );
}

function Stat({ number, label, detail }) {
  return (
    <div className={styles.stat}>
      <span className={`${styles.statNumber} tabular`}>{number}</span>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statDetail}>{detail}</span>
    </div>
  );
}
