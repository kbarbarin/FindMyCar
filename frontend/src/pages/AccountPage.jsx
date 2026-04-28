import { useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { useAuth } from '../hooks/useAuth.js';
import styles from './AccountPage.module.css';

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="container">
      <div className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.header}>
            <span className={styles.avatar} aria-hidden><User size={22} /></span>
            <div>
              <h1 className={styles.title}>Mon compte</h1>
              <p className={styles.subtitle}>Gérer la session et les préférences.</p>
            </div>
          </div>

          <dl className={styles.info}>
            {user?.displayName && (
              <div className={styles.row}>
                <dt>Nom</dt>
                <dd>{user.displayName}</dd>
              </div>
            )}
            <div className={styles.row}>
              <dt>Email</dt>
              <dd>{user?.email || '—'}</dd>
            </div>
            <div className={styles.row}>
              <dt>UID</dt>
              <dd className={styles.mono}>{user?.uid || '—'}</dd>
            </div>
          </dl>

          <Button variant="danger" leftIcon={<LogOut size={16} />} onClick={handleLogout}>
            Se déconnecter
          </Button>
        </div>
      </div>
    </div>
  );
}
