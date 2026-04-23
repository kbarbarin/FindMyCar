// Port unique de persistance. Les stores Zustand parlent uniquement à ce module.
// Bascule V1 → V2 en flippant APP_CONFIG.features.useFirebasePersistence.

import { APP_CONFIG } from '../../config/app.config.js';
import { localAdapter } from './localAdapter.js';
import { firebaseAdapter } from './firebaseAdapter.js';

export const persistenceStore = APP_CONFIG.features.useFirebasePersistence
  ? firebaseAdapter
  : localAdapter;
