import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import { useAuth } from '../hooks/useAuth.js';
import styles from './LoginPage.module.css';

export default function RegisterPage() {
  const { signUp, error, clearError, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { displayName: '', email: '', password: '', passwordConfirm: '' },
  });

  useEffect(() => { clearError(); }, [clearError]);
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  const password = watch('password');

  const onSubmit = async ({ displayName, email, password }) => {
    try {
      await signUp(email, password, displayName?.trim() || null);
      navigate(from, { replace: true });
    } catch { /* erreur via store */ }
  };

  return (
    <div className="container">
      <div className={styles.wrap}>
        <div className={styles.card}>
          <h1 className={styles.title}>Créer un compte</h1>
          <p className={styles.subtitle}>Sauvegarde tes favoris et tes recherches.</p>

          <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
            <Input
              label="Nom (optionnel)"
              type="text"
              autoComplete="name"
              placeholder="Jean Dupont"
              error={errors.displayName?.message}
              {...register('displayName', {
                maxLength: { value: 80, message: '80 caractères max' },
              })}
            />
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="vous@exemple.fr"
              error={errors.email?.message}
              {...register('email', {
                required: 'Email requis',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email invalide' },
              })}
            />
            <Input
              label="Mot de passe"
              type="password"
              autoComplete="new-password"
              placeholder="8 caractères minimum"
              error={errors.password?.message}
              {...register('password', {
                required: 'Mot de passe requis',
                minLength: { value: 8, message: '8 caractères minimum' },
              })}
            />
            <Input
              label="Confirmer le mot de passe"
              type="password"
              autoComplete="new-password"
              placeholder="Retape ton mot de passe"
              error={errors.passwordConfirm?.message}
              {...register('passwordConfirm', {
                required: 'Confirmation requise',
                validate: (v) => v === password || 'Les mots de passe ne correspondent pas',
              })}
            />

            {error && <div className={styles.error} role="alert">{error}</div>}

            <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
              {isSubmitting ? 'Création…' : 'Créer mon compte'}
            </Button>
          </form>

          <p className={styles.footerNote}>
            Déjà un compte ?{' '}
            <Link to="/login" className={styles.link}>Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
