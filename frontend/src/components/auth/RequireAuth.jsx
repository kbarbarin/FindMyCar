import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import LoadingState from '../ui/LoadingState.jsx';

// Garde de route. Tant que l'auth n'a pas été initialisée, on attend.
// Si pas connecté, on redirige vers /login en gardant l'URL d'origine
// dans le state (pour rediriger après login).
export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-8) 0' }}>
        <LoadingState />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
