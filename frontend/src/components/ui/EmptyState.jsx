import { SearchX } from 'lucide-react';
import styles from './States.module.css';

export default function EmptyState({
  icon = <SearchX size={22} />,
  title = 'Aucun résultat',
  description = 'Essayez de modifier ou d\'élargir vos critères.',
  actions,
}) {
  return (
    <div className={styles.state} role="status">
      <span className={styles.iconWrap}>{icon}</span>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
