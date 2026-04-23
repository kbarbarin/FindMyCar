import { SOURCE_META_BY_ID } from '../../constants/sources.js';
import styles from './Badges.module.css';

export default function SourceBadge({ source }) {
  if (!source?.id) return null;
  const meta = SOURCE_META_BY_ID[source.id];
  const color = meta?.color || 'var(--color-text-muted)';
  return (
    <span className={styles.source} title={`Source : ${source.label}`}>
      <span className={styles.sourceDot} style={{ background: color }} aria-hidden />
      {source.label}
    </span>
  );
}
