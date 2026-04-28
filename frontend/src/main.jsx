import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/reset.css';
import './styles/tokens.css';
import './styles/global.css';
import { useAuthStore } from './store/authStore.js';

// Lance l'écoute Firebase Auth dès le chargement.
// Tant qu'on n'a pas reçu d'événement, le store reste { loading: true }.
useAuthStore.getState().initialize();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
