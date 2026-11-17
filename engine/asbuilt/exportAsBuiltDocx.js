import { renderDiagram } from './diagrams';
import { svgToPng, fitToPage } from './diagrams/rasterize';
import { buildOutline } from './outline';
import { tr, getLang } from '../i18n';

// Export du document as-built, par remplissage d'un template Word (cf. docs/ASBUILT.md §7).
//
// Le template porte la MISE EN FORME — page de garde, en-tête, pied de page, sommaire, thème,
// styles de titres et de tableaux. Le code n'apporte que le CONTENU, inséré aux marqueurs. C'est
// ce partage qui compte : la charte se corrige dans Word, pas par une livraison applicative.
//
// La librairie `docx` est chargée en import dynamique (103 ko) et `buildAsBuiltPatches` la reçoit
// en paramètre : la construction du contenu reste testable sans mock d'import dynamique.

export const DEFAULT_TABLE_STYLE = 'AsBuiltTable';

// Contrat de marqueurs. `corps` reçoit tout le document ; les autres sont des valeurs simples, à
// poser où l'on veut dans le template (page de garde, en-tête, pied de page).
export const BODY_PLACEHOLDER = 'corps';
export const PLACEHOLDERS = [BODY_PLACEHOLDER, 'client', 'projet', 'prism_central', 'clusters', 'date', 'version'];

const EMPTY = { fr: 'Non collecté', en: 'Not collected' };
const NO_DIAGRAM = { fr: 'Schéma non disponible', en: 'Diagram unavailable' };
const DASH = '—';
const MUTED = '64748B';

const L = (pair, lang) => pair[lang] || pair.fr;

// ─── Rasterisation préalable des schémas ──────────────────────────────────────

/**
 * Convertit en PNG tous les schémas du modèle. Un schéma qui échoue est simplement absent de la
 * table : le document le signale au lieu d'insérer une image vide, et la génération continue.
 * Navigateur uniquement (canvas).
 */
export async function rasterizeDiagrams(model, lang = getLang()) {
  const images = {};
  const targets = model.sections.filter(s => s.kind === 'diagram' && !s.empty);
  await Promise.all(targets.map(async (s) => {
    const svg = renderDiagram(s.data, lang);
    if (!svg) return;
    try { images[sectionKey(s)] = await svgToPng(svg); }
    catch (err) { console.warn('[asbuilt] schéma non rasterisé', s.id, err.message); }
  }));
  return images;
}

export const sectionKey = (s) => `${s.id}::${s.clusterRef || 'pc'}`;

// ─── Contenu ──────────────────────────────────────────────────────────────────

/**
 * Construit les correctifs à appliquer au template, prêts pour `patchDocument`.
 * Pur : ni réseau, ni DOM, ni horloge — la date de génération vient du modèle.
 */
export function buildAsBuiltPatches(docx, model, {
  lang = getLang(), images = {}, branding = null, appVersion = '',
  tableStyle = DEFAULT_TABLE_STYLE,
} = {}) {
  const {
    Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
    WidthType, ImageRun, AlignmentType, PatchType,
  } = docx;
  const T = (k) => tr(lang, k);

  const gray = (t, italics = true) => new TextRun({ text: t, color: MUTED, italics });
  const p = (children, opts = {}) => new Paragraph({ children, ...opts });
  const h = (text, level) => new Paragraph({ text, heading: level });

  const cell = (children, width) => new TableCell({
    ...(width ? { width: { size: width, type: WidthType.PERCENTAGE } } : {}),
    children,
  });

  // Aucune couleur ni trame posée ici : tout vient du style nommé du template. C'est la condition
  // pour que la charte du client s'applique réellement aux tableaux, et pas seulement aux titres.
  const table = (columns, rows) => new Table({
    style: tableStyle,
    width: { size: 100, type: WidthType.PERCENTAGE },
    tableLook: {
      // Un tableau clé/valeur n'a pas d'en-tête : sans cela, Word habille sa première paire en titre.
      firstRow: columns.length > 0, lastRow: false, firstColumn: false, lastColumn: false,
      noHorizontalBand: false, noVerticalBand: true,
    },
    rows: [
      ...(columns.length ? [new TableRow({
        tableHeader: true,   // répété en haut de chaque page
        // The template's Normal style sets a text colour, which Word ranks above the table style's
        // header colour: a dedicated paragraph style lets the template win. Absent → Normal, as before.
        children: columns.map(c => cell([p([new TextRun({ text: String(c), bold: true })], { style: 'AsBuiltTableHeader' })])),
      })] : []),
      ...rows,
    ],
  });

  // Le corps du document décrit la plateforme telle qu'elle est installée : une valeur y est
  // donnée, pas commentée. La mention « (prévu) » accolée aux valeurs issues de la saisie faisait
  // lire chaque ligne comme une intention plutôt que comme un constat — le prévu et le constaté se
  // confrontent en annexe des écarts, qui est faite pour ça. La provenance reste portée par le
  // modèle (`row.provenance`), elle n'est simplement plus écrite en regard de chaque valeur.
  const valueRuns = (value) =>
    (value == null || value === '') ? [gray(L(EMPTY, lang))] : [new TextRun({ text: String(value) })];

  const sectionBody = (s) => {
    // Le moteur dit pourquoi la section est vide (« Non configuré », ou « Non collecté » et sa raison).
    if (s.empty) return [p([gray(s.emptyText || L(EMPTY, lang))])];

    if (s.kind === 'kv') {
      return [table([], s.rows.map(r => new TableRow({
        children: [
          cell([p([new TextRun({ text: r.label, bold: true })])], 35),
          cell([p(valueRuns(r.value))], 65),
        ],
      })))];
    }
    if (s.kind === 'table') {
      return [table(s.columns, s.rows.map(r => new TableRow({
        children: r.cells.map(c => cell([p(c == null || c === '' ? [gray(DASH, false)] : [new TextRun({ text: String(c) })])])),
      })))];
    }
    if (s.kind === 'text') return String(s.text || '').split('\n').map(line => p([new TextRun({ text: line })]));
    if (s.kind === 'diagram') {
      const img = images[sectionKey(s)];
      if (!img) return [p([gray(L(NO_DIAGRAM, lang))])];
      const { width, height } = fitToPage(img.width, img.height);
      return [p([new ImageRun({ type: 'png', data: img.data, transformation: { width, height } })], { alignment: AlignmentType.CENTER })];
    }
    return [];
  };

  // Le squelette vient d'outline.js : ni page de garde ni sommaire ici, ils appartiennent au
  // template.
  const LEVELS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
  const body = [];
  for (const item of buildOutline(model, lang)) {
    if (item.kind === 'note') { body.push(p([gray(item.text)])); continue; }
    if (item.kind === 'chapter') { body.push(h(item.title, LEVELS[item.level - 1])); continue; }
    // Une section sans titre (le texte de présentation) s'écrit directement sous son chapitre.
    if (!item.section.untitled) body.push(h(item.section.title, LEVELS[item.level - 1]));
    body.push(...sectionBody(item.section));
  }

  const inline = (text) => ({ type: PatchType.PARAGRAPH, children: [new TextRun({ text: String(text ?? DASH) })] });
  const date = model.meta.generatedAt
    ? new Date(model.meta.generatedAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') : DASH;

  return {
    [BODY_PLACEHOLDER]: { type: PatchType.DOCUMENT, children: body },
    client: inline(branding?.customer || branding?.companyName || ''),
    projet: inline(model.meta.projectName || T('Dossier as-built')),
    prism_central: inline([model.meta.pcName, model.meta.pcHost].filter(Boolean).join(' · ')),
    clusters: inline(model.meta.clusterCount),
    date: inline(date),
    version: inline(appVersion),
  };
}

/** Remplit le template. `template` est un ArrayBuffer / Uint8Array du .docx. */
export async function generateAsBuiltDocx(docx, model, { template, outputType = 'blob', ...opts } = {}) {
  if (!template) throw new Error('Template Word absent');
  return docx.patchDocument({
    outputType,
    data: template,
    patches: buildAsBuiltPatches(docx, model, opts),
    keepOriginalStyles: true,
  });
}

export const asBuiltFileName = (model, ext) =>
  `as-built_${(model.meta.projectName || 'projet').replace(/[^a-zA-Z0-9-_]/g, '_')}_${(model.meta.generatedAt || '').slice(0, 10) || 'export'}.${ext}`;

/** Génère et télécharge le .docx. Navigateur uniquement. */
export async function exportAsBuiltDocx(model, { lang = getLang(), template, ...opts } = {}) {
  const docx = await import('docx');
  const images = await rasterizeDiagrams(model, lang);
  const blob = await generateAsBuiltDocx(docx, model, { template, lang, images, ...opts });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = asBuiltFileName(model, 'docx');
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
