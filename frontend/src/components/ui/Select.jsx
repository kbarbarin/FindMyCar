import { forwardRef } from 'react';
import styles from './Select.module.css';

const Select = forwardRef(function Select(
  { label, hint, error, options = [], placeholder, className = '', id, ...rest },
  ref,
) {
  const selectId = id || rest.name || undefined;
  return (
    <div className={[styles.wrapper, className].join(' ')}>
      {label && <label htmlFor={selectId} className={styles.label}>{label}</label>}
      <div className={[styles.field, error ? styles.fieldError : ''].join(' ')}>
        <select ref={ref} id={selectId} className={styles.select} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {hint && !error && <span className={styles.hint}>{hint}</span>}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
});

export default Select;
