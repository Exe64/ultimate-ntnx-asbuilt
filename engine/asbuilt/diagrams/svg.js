// Primitives de dessin des schémas de l'as-built.
//
// Trois contraintes, toutes dictées par la destination du dessin (cf. docs/ASBUILT.md §7.3) :
//
//   1. COULEURS EN HEXADÉCIMAL. Le document imprimé ne connaît pas le thème de l'application :
//      une `var(--slate-500)` dans un attribut SVG ne résout rien hors du navigateur et sort en
//      noir, ou en rien du tout. La palette ci-dessous est donc figée, et c'est volontaire.
//   2. AUCUNE DÉPENDANCE À REACT NI AU DOM. Ces fonctions rendent une chaîne, ce qui les rend
//      testables, et utilisables aussi bien à l'écran (dangerouslySetInnerHTML) qu'à l'export.
//   3. SORTIE DÉTERMINISTE. Mêmes données, même chaîne : c'est ce qui permet de comparer deux
//      as-built d'un même cluster.

export const PALETTE = {
  ink: '#0f172a',
  label: '#64748b',
  border: '#cbd5e1',
  headerBg: '#f1f5f9',
  cardBg: '#ffffff',
  page: '#ffffff',
  accent: '#4f46e5',
  cpu: '#2563eb',
  ram: '#059669',
  disk: '#ea580c',
  hypervisor: '#7c3aed',
  site: '#0369a1',
  link: '#84cc16',
  linkAlt: '#1d4ed8',
  muted: '#94a3b8',
};

export const FONT = "'DM Sans', 'Segoe UI', Arial, sans-serif";

export const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Coupe un texte trop long pour la largeur disponible — approximation à 0,58 em par caractère. */
export function fit(text, width, size) {
  const s = String(text ?? '');
  const max = Math.max(1, Math.floor(width / (size * 0.58)));
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export const text = (x, y, content, { size = 11, color = PALETTE.ink, weight = 400, anchor = 'middle' } = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(content)}</text>`;

export const rect = (x, y, w, h, { fill = PALETTE.cardBg, stroke = PALETTE.border, rx = 6, dash = null } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;

export const line = (x1, y1, x2, y2, { color = PALETTE.border, width = 1 } = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`;

/** Chemin en équerre, comme les liaisons du schéma de câblage. */
export const elbow = (x1, y1, x2, y2, { color = PALETTE.link, width = 2 } = {}) => {
  const midY = y1 + (y2 - y1) / 2;
  return `<path d="M ${x1} ${y1} V ${midY} H ${x2} V ${y2}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
};

export const CARD_W = 150;
export const ROW_H = 34;
export const HEADER_H = 26;

/**
 * Carte à en-tête et lignes libellé/valeur — la brique de tous les schémas du document, et la
 * transposition exacte des cartes affichées à l'écran (ClusterDiagram / HostClusterDiagram).
 *
 * @param rows [[libellé, valeur, couleur?]] — une valeur absente s'affiche « — », jamais vide.
 */
export function card(x, y, title, rows, { width = CARD_W, subtitle = null } = {}) {
  const headH = subtitle ? HEADER_H + 12 : HEADER_H;
  const h = headH + rows.length * ROW_H;
  const parts = [
    rect(x, y, width, h),
    rect(x, y, width, headH, { fill: PALETTE.headerBg, rx: 6 }),
    text(x + width / 2, y + 17, fit(title, width - 12, 11), { size: 11, weight: 700 }),
  ];
  if (subtitle) parts.push(text(x + width / 2, y + 29, fit(subtitle, width - 12, 9), { size: 9, color: PALETTE.label }));

  rows.forEach(([label, value, color], i) => {
    const top = y + headH + i * ROW_H;
    parts.push(line(x, top, x + width, top));
    parts.push(text(x + width / 2, top + 13, fit(label, width - 12, 9), { size: 9, color: PALETTE.label }));
    parts.push(text(x + width / 2, top + 27, fit(value ?? '—', width - 12, 11), { size: 11, weight: 700, color: color || PALETTE.ink }));
  });
  return { svg: parts.join(''), width, height: h };
}

/** Enveloppe finale : viewBox + fond opaque (un fond transparent emprunte celui de la page). */
export function svgDocument(width, height, body, { title = '' } = {}) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"${title ? ` aria-label="${esc(title)}"` : ''}>`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${PALETTE.page}"/>`,
    body,
    '</svg>',
  ].join('');
}
