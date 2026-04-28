import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './layout/AppLayout.jsx';
import HomePage from './pages/HomePage.jsx';
import ResultsPage from './pages/ResultsPage.jsx';
import ListingDetailPage from './pages/ListingDetailPage.jsx';
import FavoritesPage from './pages/FavoritesPage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import RequireAuth from './components/auth/RequireAuth.jsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'search', element: <ResultsPage /> },
      { path: 'listing/:id', element: <ListingDetailPage /> },
      { path: 'favorites', element: <RequireAuth><FavoritesPage /></RequireAuth> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'account', element: <RequireAuth><AccountPage /></RequireAuth> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
