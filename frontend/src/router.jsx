import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './layout/AppLayout.jsx';
import HomePage from './pages/HomePage.jsx';
import ResultsPage from './pages/ResultsPage.jsx';
import ListingDetailPage from './pages/ListingDetailPage.jsx';
import FavoritesPage from './pages/FavoritesPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import RequireAuth from './components/auth/RequireAuth.jsx';
import LoadingState from './components/ui/LoadingState.jsx';

// La page Stats embarque Recharts (~400 kB) — on la code-split pour qu'elle
// ne penalise pas le bundle principal des autres pages.
const StatsPage = lazy(() => import('./pages/StatsPage.jsx'));
const StatsPageSuspense = () => (
  <Suspense fallback={<div className="container" style={{ padding: 'var(--space-8) 0' }}><LoadingState count={2} /></div>}>
    <StatsPage />
  </Suspense>
);

// Page Deep Scrape : utilisateurs power, code-splittee aussi.
const DeepScrapePage = lazy(() => import('./pages/DeepScrapePage.jsx'));
const DeepScrapePageSuspense = () => (
  <Suspense fallback={<div className="container" style={{ padding: 'var(--space-8) 0' }}><LoadingState count={2} /></div>}>
    <DeepScrapePage />
  </Suspense>
);

export const router = createBrowserRouter([
  // Pages d'auth — publiques, sans AppLayout (header/footer cachés)
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  // Tout le reste du site est gate : RequireAuth wrap l'AppLayout entier,
  // donc tout enfant herite de la garde. Pas connecte -> redirect /login.
  {
    path: '/',
    element: <RequireAuth><AppLayout /></RequireAuth>,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'search', element: <ResultsPage /> },
      { path: 'listing/:id', element: <ListingDetailPage /> },
      { path: 'favorites', element: <FavoritesPage /> },
      { path: 'stats', element: <StatsPageSuspense /> },
      { path: 'scrape', element: <DeepScrapePageSuspense /> },
      { path: 'account', element: <AccountPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
