import { AlertTriangle } from 'lucide-react';
import styles from './States.module.css';
import Button from './Button.jsx';

export default function ErrorState({ title = 'Une erreur est survenue', description, onRetry }) {
  return (
    <div className={styles.state} role="alert">
      <span className={styles.iconWrap}><AlertTriangle size={22} /></span>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {onRetry && (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onRetry}>Réessayer</Button>
        </div>
      )}
    </div>
  );
}
