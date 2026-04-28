import { useState } from 'react';
import { createSearchParams, useNavigate } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { parseText } from '../../services/search/queryParser.js';
import { criteriaToParams } from '../../utils/url.js';
import styles from './SearchBar.module.css';

const SAMPLES = [
  { label: 'Toyota Prius+ moins de 10 ans plus de 200 000 km', tag: 'familial' },
  { label: 'Peugeot 308 SW diesel', tag: 'break' },
  { label: 'Volvo V90 Allemagne', tag: 'import' },
  { label: 'Tesla Model 3', tag: 'electrique' },
];

export default function SearchBar({ defaultValue = '', autoFocus = false, size = 'lg' }) {
  const [value, setValue] = useState(defaultValue);
  const navigate = useNavigate();

  function go(text) {
    const patch = parseText(text);
    const params = criteriaToParams(patch);
    navigate({ pathname: '/search', search: createSearchParams(params).toString() });
  }

  function submit(e) {
    e?.preventDefault?.();
    if (!value.trim()) return;
    go(value);
  }

  function applySample(text) {
    setValue(text);
    go(text);
  }

  return (
    <form
      className={[styles.wrap, styles[`size_${size}`]].join(' ')}
      onSubmit={submit}
      role="search"
      aria-label="Recherche de voitures d'occasion"
    >
      <div className={styles.barFrame}>
        <div className={styles.scanline} aria-hidden />
        <span className={styles.barIcon} aria-hidden>
          <Search size={size === 'lg' ? 20 : 18} strokeWidth={1.6} />
        </span>
        <input
          className={styles.barInput}
          type="text"
          placeholder="Decrivez votre voiture ideale..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus={autoFocus}
          aria-label="Saisir une recherche"
        />
        <button type="submit" className={styles.barSubmit}>
          <span>Rechercher</span>
          <ArrowRight size={16} strokeWidth={1.8} />
        </button>
      </div>

      {size === 'lg' && (
        <div className={styles.samples}>
          <span className={styles.sampleLabel}>Suggestions :</span>
          <div className={styles.sampleChips}>
            {SAMPLES.map((s) => (
              <button
                key={s.label}
                type="button"
                className={styles.sample}
                onClick={() => applySample(s.label)}
              >
                <span className={styles.sampleTag}>{s.tag}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
