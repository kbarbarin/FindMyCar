import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function NotFoundPage() {
  return (
    <div className="container">
      <EmptyState
        icon={<Compass size={22} />}
        title="Page introuvable"
        description="Cette page n'existe pas ou a été déplacée."
        actions={
          <Link to="/"><Button variant="primary">Retour à l'accueil</Button></Link>
        }
      />
    </div>
  );
}
