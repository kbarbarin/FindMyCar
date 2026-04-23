import { Sparkles, ArrowRight } from 'lucide-react';
import styles from './SearchSuggestions.module.css';

export default function SearchSuggestions({ suggestions, onApply }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <section className={styles.panel} aria-label="Suggestions de recherche">
      <header className={styles.header}>
        <Sparkles size={16} />
        <span>Suggestions pour élargir votre recherche</span>
      </header>
      <ul className={styles.list}>
        {suggestions.map((s) => (
          <li key={s.id}>
            <button type="button" className={styles.item} onClick={() => onApply(s.patch)}>
              <div className={styles.itemBody}>
                <div className={styles.itemLabel}>{s.label}</div>
                <div className={styles.itemRationale}>{s.rationale}</div>
              </div>
              <ArrowRight size={16} className={styles.itemArrow} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
