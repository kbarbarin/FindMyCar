import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function NotFoundPage() {
  return (
    <div className="container">
      <EmptyState
        icon={<Compass size={22} />}
        title="Hors-piste"
        description="Cette page n'existe pas ou a ete deplacee. Revenez au cockpit principal pour relancer une recherche."
        actions={
          <Link to="/"><Button variant="accent">Retour au cockpit</Button></Link>
        }
      />
    </div>
  );
}
