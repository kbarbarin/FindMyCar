// Construction d'URL de RECHERCHE (pas de fiche) sur chaque source.
// En V1, les identifiants d'annonces sont mockés et ne pointent vers rien de réel.
// On envoie donc l'utilisateur vers une recherche cohérente sur le site source,
// ce qui reste utile tant qu'un vrai scraper n'alimente pas les URLs canoniques.

const builders = {
  leboncoin: ({ make, model }) => {
    const q = [make, model].filter(Boolean).join(' ').trim();
    const text = q ? `&text=${encodeURIComponent(q)}` : '';
    return `https://www.leboncoin.fr/recherche?category=2${text}`;
  },
  lacentrale: ({ make, model }) => {
    const q = [make, model].filter(Boolean).join(' ').trim();
    const query = q ? `?searchQuery=${encodeURIComponent(q)}` : '';
    return `https://www.lacentrale.fr/listing${query}`;
  },
  mobilede: ({ make, model }) => {
    const q = [make, model].filter(Boolean).join(' ').trim();
    const query = q ? `?s=Car&query=${encodeURIComponent(q)}` : '?s=Car';
    return `https://suchen.mobile.de/fahrzeuge/search.html${query}`;
  },
  autoscout24: ({ make, model }) => {
    if (make && model) {
      const slug = (s) => encodeURIComponent(String(s).toLowerCase().replace(/\s+/g, '-'));
      return `https://www.autoscout24.com/lst/${slug(make)}/${slug(model)}`;
    }
    if (make) return `https://www.autoscout24.com/lst/${encodeURIComponent(String(make).toLowerCase())}`;
    return 'https://www.autoscout24.com';
  },
};

export function buildSearchUrlForSource(sourceId, { make, model } = {}) {
  const fn = builders[sourceId];
  if (!fn) return null;
  return fn({ make, model });
}
