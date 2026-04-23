import { useEffect, useState } from 'react';
import ResultCard from './ResultCard.jsx';
import Button from '../ui/Button.jsx';
import styles from './ResultsList.module.css';

const PAGE_SIZE = 24;

// Pagination "infinite scroll + bouton" : on affiche par paliers de 24.
// Le state réinitialise quand la liste source change (nouveaux critères).
export default function ResultsList({ listings }) {
  const [shown, setShown] = useState(PAGE_SIZE);
  useEffect(() => { setShown(PAGE_SIZE); }, [listings]);

  const visible = listings.slice(0, shown);
  const remaining = listings.length - shown;

  return (
    <div>
      <ul className={styles.list}>
        {visible.map((l) => (
          <li key={l.id}><ResultCard listing={l} /></li>
        ))}
      </ul>
      {remaining > 0 && (
        <div className={styles.moreRow}>
          <Button variant="secondary" onClick={() => setShown((n) => n + PAGE_SIZE)}>
            Voir {Math.min(PAGE_SIZE, remaining)} annonces de plus · {remaining} restantes
          </Button>
        </div>
      )}
      {remaining === 0 && listings.length > PAGE_SIZE && (
        <div className={styles.endRow}>Vous avez tout vu.</div>
      )}
    </div>
  );
}
