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
        <div className={styles.headTitle}>
          <span className={styles.kicker}>Garage</span>
          <h1 className={styles.title}>
            <span className={styles.titleSerif}>Vos voitures</span>
            <span className={styles.titleSans}>marquees.</span>
          </h1>
          <p className={styles.subtitle}>
            <span className="tabular">{favorites.length}</span> {favorites.length > 1 ? 'annonces gardees a portee' : 'annonce gardee a portee'} de cle a molette.
            Stockage local, vide a la fermeture du navigateur si vous le decidez.
          </p>
        </div>
        {favorites.length > 0 && (
          <Button variant="secondary" onClick={clear}>Vider le garage</Button>
        )}
      </header>

      {favorites.length === 0 ? (
        <EmptyState
          icon={<Heart size={22} />}
          title="Aucun favori pour l'instant"
          description="Cliquez sur le coeur d'une annonce pour la garder a portee de main, comparer plus tard, ou la transmettre."
          actions={<Link to="/search"><Button variant="accent">Decouvrir des annonces</Button></Link>}
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
