import styles from './States.module.css';

export default function LoadingState({ count = 5 }) {
  return (
    <div className={styles.skeletonList} aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <div className={styles.skeletonThumb} />
          <div className={styles.skeletonLines}>
            <div className={`${styles.skeletonLine} ${styles.w60}`} />
            <div className={`${styles.skeletonLine} ${styles.w80}`} />
            <div className={`${styles.skeletonLine} ${styles.w40}`} />
            <div className={`${styles.skeletonLine} ${styles.w60}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
