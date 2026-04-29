import { Link, NavLink } from 'react-router-dom';
import { BarChart3, Heart, LogIn, LogOut, Radar, Search, UserCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import styles from './Header.module.css';

export default function Header() {
  const { user, isAuthenticated, signOut, loading } = useAuth();

  return (
    <header className={styles.header}>
      <div className={styles.scanline} aria-hidden />
      <div className={`container ${styles.row}`}>
        <Link to="/" className={styles.brand} aria-label="FindMyCar — accueil">
          <span className={styles.logoMark} aria-hidden>
            <svg viewBox="0 0 44 44" width="40" height="40">
              <defs>
                <radialGradient id="fmc-radar" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#E8B042" stopOpacity="0" />
                  <stop offset="65%" stopColor="#E8B042" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#E8B042" stopOpacity="0" />
                </radialGradient>
              </defs>
              {/* Cadre du viseur radar */}
              <circle cx="22" cy="22" r="20" fill="url(#fmc-radar)" />
              <circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.9" />
              <circle cx="22" cy="22" r="13.5" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.45" />
              <circle cx="22" cy="22" r="7" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.45" />
              {/* Croix de visee */}
              <line x1="22" y1="2" x2="22" y2="42" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
              <line x1="2" y1="22" x2="42" y2="22" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
              {/* Voiture stylisee au centre */}
              <g transform="translate(8 18)">
                <path
                  d="M1 6c0-0.6 0.4-1 1-1h1.6L4.7 1.6A2.2 2.2 0 0 1 6.8 0h14.4a2.2 2.2 0 0 1 2.1 1.6L24.4 5H26c0.6 0 1 0.4 1 1v2c0 0.6-0.4 1-1 1h-0.5a2.5 2.5 0 0 1-5 0H7.5a2.5 2.5 0 0 1-5 0H2c-0.6 0-1-0.4-1-1V6Z"
                  fill="#E8B042"
                />
                <circle cx="5" cy="9" r="1.4" fill="#101216" />
                <circle cx="23" cy="9" r="1.4" fill="#101216" />
              </g>
              {/* Pointeur radar */}
              <line x1="22" y1="22" x2="38" y2="14" stroke="#E8B042" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
          <span className={styles.logoTextWrap}>
            <span className={styles.logoText}>
              <span className={styles.logoFind}>find</span>
              <span className={styles.logoMy}>my</span>
              <span className={styles.logoCar}>car</span>
            </span>
            <span className={styles.logoTag}>cockpit europe</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Navigation principale">
          <NavLink to="/search" className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ')}>
            <Search size={15} /> <span>Recherche</span>
          </NavLink>
          <NavLink to="/scrape" className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ')}>
            <Radar size={15} /> <span>Scrape</span>
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ')}>
            <BarChart3 size={15} /> <span>Marche</span>
          </NavLink>
          <NavLink to="/favorites" className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ')}>
            <Heart size={15} /> <span>Garage</span>
          </NavLink>
        </nav>

        <div className={styles.authZone}>
          {loading ? null : isAuthenticated ? (
            <>
              <NavLink
                to="/account"
                className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ')}
                title={user?.email || ''}
              >
                <UserCircle2 size={16} />
                <span className={styles.userLabel}>{user?.displayName || user?.email}</span>
              </NavLink>
              <button type="button" className={styles.navLink} onClick={() => signOut()}>
                <LogOut size={16} /> <span>Se déconnecter</span>
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ')}>
                <LogIn size={16} /> <span>Connexion</span>
              </NavLink>
              <NavLink to="/register" className={({ isActive }) => [styles.navLink, styles.navLinkAccent, isActive ? styles.navLinkActive : ''].join(' ')}>
                Inscription
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
