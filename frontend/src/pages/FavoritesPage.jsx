import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useFavoritesStore } from '../store/favoritesStore.js';
import ResultCard from '../components/results/ResultCard.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Button from '../components/ui/Button.jsx';
import styles from './FavoritesPage.module.css';

export default function FavoritesPage() {
  const favorites = useFavoritesStore((s) => s.favorites);
  const clear = useFavoritesStore((s) => s.clear);

  return (
    <div className="container">
      <header className={styles.header}>
        <h1>Favoris</h1>
        {favorites.length > 0 && (
          <Button variant="ghost" onClick={clear}>Tout effacer</Button>
        )}
      </header>

      {favorites.length === 0 ? (
        <EmptyState
          icon={<Heart size={22} />}
          title="Aucun favori pour l'instant"
          description="Cliquez sur le cœur d'une annonce pour la garder à portée de main."
          actions={<Link to="/search"><Button variant="primary">Découvrir des annonces</Button></Link>}
        />
      ) : (
        <ul className={styles.list}>
          {favorites.map((f) => (
            <li key={f.id}><ResultCard listing={f.listingSnapshot} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}
