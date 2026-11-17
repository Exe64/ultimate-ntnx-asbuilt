import { tr, getLang } from '../i18n';

// Squelette du document : la suite ordonnée des titres et des sections. Séparé du rendu parce
// que l'ordre du document est une décision de conception, pas un détail d'export — et parce
// qu'ainsi il se teste sans générer un .docx.
//
// Hiérarchie (cf. docs/ASBUILT.md §3) :
//   1  Cluster <nom>              1  Prism Central     1  Annexes
//   2    <chapitre du cluster>    2    <section>       2    <section>
//   3      <section>
//
// L'ORDRE SUIT LE DOCUMENT DE RÉFÉRENCE : la présentation, puis le Prism Central — il pose le parc
// et le contexte dans lequel chaque cluster s'inscrit — et la sécurité, qui se règle à son niveau ;
// ensuite un chapitre par cluster (construction de l'environnement, conception des hôtes,
// configuration Nutanix), et les annexes pour finir.

export function buildOutline(model, lang = getLang()) {
  const T = (k) => tr(lang, k);
  const out = [];
  const chapterTitle = (id) => model.chapters.find(c => c.id === id)?.title || id;

  // Chapitres de niveau document (présentation, Prism Central, sécurité), dans l'ordre du catalogue.
  for (const ch of model.chapters.filter(x => x.scope === 'pc')) {
    const own = model.sections.filter(s => s.scope === 'pc' && s.chapter === ch.id);
    if (!own.length) continue;
    out.push({ kind: 'chapter', level: 1, title: ch.title });
    own.forEach(section => out.push({ kind: 'section', level: 2, section }));
  }

  for (const c of model.clusters) {
    const own = model.sections.filter(s => s.scope === 'cluster' && s.clusterRef === c.ref);
    if (!own.length) continue;
    out.push({ kind: 'chapter', level: 1, title: `${T('Cluster')} ${c.name || '—'}` });
    // Un cluster décrit mais absent du Prism Central se documente quand même, et le document
    // dit pourquoi ses tableaux sont maigres.
    if (!c.hasApi) out.push({ kind: 'note', text: T('Cluster décrit dans le Build, non enregistré sur ce Prism Central.') });
    for (const ch of model.chapters.filter(x => x.scope === 'cluster')) {
      const inChapter = own.filter(s => s.chapter === ch.id);
      if (!inChapter.length) continue;
      out.push({ kind: 'chapter', level: 2, title: ch.title });
      inChapter.forEach(section => out.push({ kind: 'section', level: 3, section }));
    }
  }

  const annexes = model.sections.filter(s => s.scope === 'annex');
  if (annexes.length) {
    out.push({ kind: 'chapter', level: 1, title: chapterTitle('annex') });
    annexes.forEach(section => out.push({ kind: 'section', level: 2, section }));
  }

  return out;
}
