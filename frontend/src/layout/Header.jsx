import { Link, NavLink } from 'react-router-dom';
import { BarChart3, Heart, Search } from 'lucide-react';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.row}`}>
        <Link to="/" className={styles.brand} aria-label="FindMyCar — accueil">
          <span className={styles.logoMark} aria-hidden>
            <svg viewBox="0 0 32 32" width="22" height="22">
              <rect width="32" height="32" rx="7" fill="#0B0E14"/>
              <path d="M7 19c0-.6.4-1 1-1h1.3l1.2-3.7A3 3 0 0 1 13.4 12h5.2a3 3 0 0 1 2.9 2.3L22.7 18H24c.6 0 1 .4 1 1v3c0 .6-.4 1-1 1h-1v1a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1h-7v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-1H8a1 1 0 0 1-1-1v-3Z" fill="#2D5BFF"/>
              <circle cx="10.8" cy="20.5" r="1.4" fill="#fff"/>
              <circle cx="21.2" cy="20.5" r="1.4" fill="#fff"/>
            </svg>
          </span>
          <span className={styles.logoText}>FindMyCar</span>
        </Link>

        <nav className={styles.nav} aria-label="Navigation principale">
          <NavLink to="/search" className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ')}>
            <Search size={16} /> Recherche
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ')}>
            <BarChart3 size={16} /> Stats
          </NavLink>
          <NavLink to="/favorites" className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ')}>
            <Heart size={16} /> Favoris
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
