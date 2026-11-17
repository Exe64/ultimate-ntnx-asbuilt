// Traduction du moteur : clé = chaîne française, valeur = anglais. Seules les chaînes passées à
// `tr` figurent ici ; les sections portent leurs propres libellés { fr, en }.
// La langue est toujours passée explicitement par l'appelant.
const EN = {
  'Dossier as-built': 'As-built document',
  'Cluster décrit dans le Build, non enregistré sur ce Prism Central.':
    'Cluster described in Build, not registered on this Prism Central.',
};

export const getLang = () => 'fr';
export const tr = (lang, key) => (lang === 'en' && EN[key]) || key;
