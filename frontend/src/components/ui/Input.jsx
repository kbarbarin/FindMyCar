import { forwardRef } from 'react';
import styles from './Input.module.css';

const Input = forwardRef(function Input(
  { label, hint, error, leftIcon, rightIcon, className = '', id, ...rest },
  ref,
) {
  const inputId = id || rest.name || undefined;
  return (
    <div className={[styles.wrapper, className].join(' ')}>
      {label && <label htmlFor={inputId} className={styles.label}>{label}</label>}
      <div className={[styles.field, error ? styles.fieldError : ''].join(' ')}>
        {leftIcon && <span className={styles.adornment} aria-hidden>{leftIcon}</span>}
        <input ref={ref} id={inputId} className={styles.input} {...rest} />
        {rightIcon && <span className={styles.adornment} aria-hidden>{rightIcon}</span>}
      </div>
      {hint && !error && <span className={styles.hint}>{hint}</span>}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
});

export default Input;
