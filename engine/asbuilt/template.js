import { SECTIONS, CHAPTERS, DEFAULT_ENABLED } from './sections';

// Template d'as-built : ce que l'utilisateur a décidé de garder du catalogue, dans quel ordre,
// sous quels titres, plus ses propres sections de texte. Persisté sur `projects.asbuilt`.
//
// Tout l'enjeu tient dans la fusion (`resolveTemplate`) : le catalogue livré avec l'application
// bouge à chaque version, le template enregistré date d'avant. Trois règles, et elles sont
// testées :
//
//   1. une section ajoutée au catalogue depuis l'enregistrement APPARAÎT, à sa place naturelle
//      (juste après la section qui la précède dans le catalogue), avec son activation par défaut.
//      Un document ne doit pas rater une information nouvelle parce qu'il a été configuré hier ;
//   2. une section retirée du catalogue DISPARAÎT du template sans le casser ;
//   3. l'ordre et les renommages choisis par l'utilisateur sont conservés.
//
// Le template ne stocke jamais le contenu du catalogue — seulement des décisions le concernant.
// C'est ce qui permet au catalogue d'évoluer sans migration de données.

export const TEMPLATE_VERSION = 1;

const CHAPTER_IDS = CHAPTERS.map(c => c.id);
const MAX_CUSTOM_SECTIONS = 40;
const MAX_TITLE = 120;
const MAX_CONTENT = 20000;

export const blankTemplate = () => ({ version: TEMPLATE_VERSION, sections: [], custom: [] });

const cleanText = (v, max) => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
};

const cleanTitle = (t) => {
  if (t == null) return null;
  if (typeof t === 'string') { const s = cleanText(t, MAX_TITLE); return s ? { fr: s, en: s } : null; }
  const fr = cleanText(t.fr, MAX_TITLE), en = cleanText(t.en, MAX_TITLE);
  return fr || en ? { fr: fr || en, en: en || fr } : null;
};

/** Identifiant d'une section libre : préfixe imposé, pour ne jamais entrer en collision
 *  avec un identifiant du catalogue — présent ou futur. Les accents sont dépliés avant le
 *  découpage, sinon « Procédure » donnerait `proc-dure`. */
export const customId = (slug) =>
  `custom.${String(slug || '')
    .normalize('NFD').replace(/[^\x20-\x7E]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 40) || 'section'}`;

/** Nettoie un template venu de la base ou du réseau : rien n'est cru sur parole. */
export function normalizeTemplate(raw) {
  if (!raw || typeof raw !== 'object') return blankTemplate();
  const seen = new Set();
  const sections = (Array.isArray(raw.sections) ? raw.sections : [])
    .filter(s => s && typeof s.id === 'string')
    .filter(s => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .map(s => ({
      id: s.id,
      enabled: s.enabled !== false,
      ...(cleanTitle(s.title) ? { title: cleanTitle(s.title) } : {}),
    }));

  const customSeen = new Set();
  const custom = (Array.isArray(raw.custom) ? raw.custom : [])
    .filter(c => c && typeof c.id === 'string' && c.id.startsWith('custom.'))
    .filter(c => (customSeen.has(c.id) ? false : (customSeen.add(c.id), true)))
    .slice(0, MAX_CUSTOM_SECTIONS)
    .map(c => ({
      id: c.id,
      chapter: CHAPTER_IDS.includes(c.chapter) ? c.chapter : 'annex',
      title: cleanTitle(c.title) || { fr: 'Section libre', en: 'Custom section' },
      content: cleanText(c.content, MAX_CONTENT) || '',
    }));

  return { version: TEMPLATE_VERSION, sections, custom };
}

/**
 * Fusionne le template enregistré et le catalogue courant.
 *
 * @returns {{ entries, catalog, enabled }}
 *   entries  la liste ordonnée présentée à l'utilisateur : { id, chapter, title, enabled, custom, isNew }
 *   catalog  le catalogue effectif à passer à buildAsBuiltModel (titres surchargés, sections libres incluses)
 *   enabled  les identifiants activés, dans le même ordre
 */
export function resolveTemplate(rawTemplate, catalog = SECTIONS) {
  const tpl = normalizeTemplate(rawTemplate);
  const stored = new Map(tpl.sections.map((s, i) => [s.id, { ...s, at: i }]));
  const customById = new Map(tpl.custom.map(c => [c.id, c]));

  // Sections libres transformées en entrées de catalogue : le moteur n'a pas à savoir
  // qu'elles viennent d'une saisie plutôt que du code.
  const customSections = tpl.custom.map(c => ({
    id: c.id, chapter: c.chapter, kind: 'text', title: c.title, custom: true,
    build: () => (c.content ? { text: c.content } : null),
  }));

  const all = [...catalog, ...customSections];

  // Rang de tri : un identifiant connu du template garde sa position ; un identifiant
  // inconnu (section nouvelle) se place juste après son prédécesseur connu dans le
  // catalogue, et non à la fin — sinon toute nouveauté atterrirait en annexe.
  let lastRank = -1, nudge = 0;
  const ranked = all.map((s) => {
    const known = stored.get(s.id);
    if (known) { lastRank = known.at; nudge = 0; return { s, rank: known.at, isNew: false }; }
    nudge += 1;
    return { s, rank: lastRank + nudge / (all.length + 1), isNew: !customById.has(s.id) };
  });
  // Le tri est d'abord chapitre, ensuite rang : les chapitres du document ne s'entrelacent
  // jamais, quel que soit l'ordre enregistré. C'est ce qui rend « monter / descendre » sûr —
  // les sections d'un même chapitre sont contiguës, donc un échange reste dans le chapitre.
  const chapterRank = (id) => { const i = CHAPTER_IDS.indexOf(id); return i < 0 ? CHAPTER_IDS.length : i; };
  ranked.sort((a, b) =>
    chapterRank(a.s.chapter) - chapterRank(b.s.chapter) || a.rank - b.rank);

  const entries = ranked.map(({ s, isNew }) => {
    const known = stored.get(s.id);
    const title = known?.title || s.title;
    return {
      id: s.id, chapter: s.chapter, kind: s.kind, title,
      enabled: known ? known.enabled : (isNew ? s.defaultEnabled !== false : true),
      custom: !!s.custom, isNew,
    };
  });

  const byId = new Map(all.map(s => [s.id, s]));
  return {
    entries,
    catalog: entries.map(e => ({ ...byId.get(e.id), title: e.title })),
    enabled: entries.filter(e => e.enabled).map(e => e.id),
  };
}

// ─── Mutations, toutes pures : elles rendent un nouveau template ───────────────

/** Fige dans le template l'ordre et les activations courants — appelé avant tout enregistrement,
 *  pour que les sections découvertes à la fusion deviennent des décisions explicites. */
export function templateFromEntries(entries, custom = []) {
  return {
    version: TEMPLATE_VERSION,
    // Les sections libres figurent ici aussi : leur contenu vit dans `custom`, mais leur
    // place dans le document et leur activation sont des décisions comme les autres.
    sections: entries.map(e => {
      const title = e.custom ? null : cleanTitle(e.title);
      return { id: e.id, enabled: e.enabled !== false, ...(title ? { title } : {}) };
    }),
    custom: normalizeTemplate({ custom }).custom,
  };
}

export function toggleSection(entries, id) {
  return entries.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e);
}

export function renameSection(entries, id, title) {
  const t = cleanTitle(title);
  return entries.map(e => e.id === id ? { ...e, title: t || e.title } : e);
}

/** Déplace une section d'un cran, sans jamais la faire changer de chapitre : un tableau de
 *  disques n'a rien à faire dans le chapitre Prism Central. Aux bornes du chapitre, l'appel
 *  ne fait rien plutôt que de déborder sur le voisin. */
export function moveSection(entries, id, direction) {
  const i = entries.findIndex(e => e.id === id);
  if (i < 0) return entries;
  const j = i + (direction === 'up' ? -1 : 1);
  if (j < 0 || j >= entries.length || entries[j].chapter !== entries[i].chapter) return entries;
  const out = [...entries];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function addCustomSection(custom, { chapter = 'annex', title, content = '' } = {}) {
  const base = customId(typeof title === 'string' ? title : title?.fr);
  let id = base, n = 2;
  while (custom.some(c => c.id === id)) id = `${base}-${n++}`;
  return [...custom, { id, chapter, title: cleanTitle(title) || { fr: 'Section libre', en: 'Custom section' }, content }];
}

export const removeCustomSection = (custom, id) => custom.filter(c => c.id !== id);

/** Template par défaut : le catalogue tel qu'il est livré, activations d'origine. */
export const defaultTemplate = () => ({
  version: TEMPLATE_VERSION,
  sections: SECTIONS.map(s => ({ id: s.id, enabled: DEFAULT_ENABLED.includes(s.id) })),
  custom: [],
});
