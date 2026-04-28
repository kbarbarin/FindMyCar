import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import { useAuth } from '../hooks/useAuth.js';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { signIn, error, clearError, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: '', password: '' } });

  useEffect(() => { clearError(); }, [clearError]);
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  const onSubmit = async ({ email, password }) => {
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch { /* erreur affichée via store */ }
  };

  return (
    <div className="container">
      <div className={styles.wrap}>
        <div className={styles.card}>
          <h1 className={styles.title}>Connexion</h1>
          <p className={styles.subtitle}>Accède à ton compte FindMyCar.</p>

          <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
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
              autoComplete="current-password"
              placeholder="********"
              error={errors.password?.message}
              {...register('password', {
                required: 'Mot de passe requis',
                minLength: { value: 8, message: '8 caractères minimum' },
              })}
            />

            {error && <div className={styles.error} role="alert">{error}</div>}

            <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
              {isSubmitting ? 'Connexion…' : 'Se connecter'}
            </Button>
          </form>

          <p className={styles.footerNote}>
            Pas encore de compte ?{' '}
            <Link to="/register" className={styles.link}>S'inscrire</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
