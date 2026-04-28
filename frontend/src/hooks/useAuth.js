import { useAuthStore } from '../store/authStore.js';

// Hook unique pour consommer l'état d'auth + les actions.
// Volontairement simple : un seul selector qui retourne tout. La perf est
// rarement critique sur un store auth (lectures peu fréquentes).
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const signOut = useAuthStore((s) => s.signOut);
  const clearError = useAuthStore((s) => s.clearError);

  return {
    user,
    loading,
    error,
    isAuthenticated: Boolean(user),
    signIn,
    signUp,
    signOut,
    clearError,
  };
}
