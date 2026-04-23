import { useState } from 'react';
import { createSearchParams, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import Input from '../ui/Input.jsx';
import Button from '../ui/Button.jsx';
import { parseText } from '../../services/search/queryParser.js';
import { criteriaToParams } from '../../utils/url.js';
import styles from './SearchBar.module.css';

const SAMPLES = [
  'Toyota Prius+ moins de 10 ans plus de 200 000 km',
  'Peugeot 308 SW diesel',
  'Volvo V90 Allemagne',
  'Tesla Model 3',
];

export default function SearchBar({ defaultValue = '', autoFocus = false, size = 'lg' }) {
  const [value, setValue] = useState(defaultValue);
  const navigate = useNavigate();

  function go(text) {
    const patch = parseText(text);
    const params = criteriaToParams(patch);
    // createSearchParams + navigate(to object) garantit le bon encodage par React Router.
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
    <form className={styles.bar} onSubmit={submit} role="search" aria-label="Recherche de voitures d'occasion">
      <Input
        leftIcon={<Search size={18} />}
        placeholder="Ex : Toyota Prius+ moins de 10 ans plus de 200 000 km"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus={autoFocus}
      />
      <Button type="submit" size={size}>Rechercher</Button>
      {size === 'lg' && (
        <div className={styles.samples}>
          <span className={styles.sampleLabel}>Exemples :</span>
          {SAMPLES.map((s) => (
            <button key={s} type="button" className={styles.sample} onClick={() => applySample(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
