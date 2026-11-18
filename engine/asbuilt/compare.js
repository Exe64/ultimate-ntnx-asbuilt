// Rapport d'écarts : ce qui a changé entre deux collectes. Chaque collecte passe par le moteur
// (mêmes libellés, unités et formats que le document), puis les sections sont comparées une à
// une. Le résultat a la forme d'un modèle as-built : l'export Word existant le rend tel quel,
// dans le template, sans second moteur de rendu.
import { buildAsBuiltModel } from './asBuiltModel';
import { SECTIONS } from './sections';

const L = {
  fr: {
    project: "Rapport d'écarts", summary: "Synthèse des écarts", scope: 'Collectes comparées',
    before: 'Avant', after: 'Après', element: 'Élément', field: 'Champ',
    section: 'Section', perimeter: 'Périmètre', added: 'Ajouts', removed: 'Suppressions', changed: 'Modifications',
    addedRow: 'Ligne ajoutée', removedRow: 'Ligne supprimée', state: 'État de la section', collected: 'Collectée',
    clusters: 'Clusters', clusterAdded: 'Cluster ajouté', clusterRemoved: 'Cluster retiré', present: 'Présent', absent: 'Absent',
    none: 'Aucun écart entre les deux collectes.', pc: 'Prism Central', cluster: 'Cluster',
    collectedOn: 'collectée le', app: 'version', scopeEmpty: '—', colon: ' : ',
  },
  en: {
    project: 'Change report', summary: 'Summary of changes', scope: 'Compared collections',
    before: 'Before', after: 'After', element: 'Item', field: 'Field',
    section: 'Section', perimeter: 'Scope', added: 'Added', removed: 'Removed', changed: 'Changed',
    addedRow: 'Row added', removedRow: 'Row removed', state: 'Section state', collected: 'Collected',
    clusters: 'Clusters', clusterAdded: 'Cluster added', clusterRemoved: 'Cluster removed', present: 'Present', absent: 'Absent',
    none: 'No change between the two collections.', pc: 'Prism Central', cluster: 'Cluster',
    collectedOn: 'collected on', app: 'version', scopeEmpty: '—', colon: ': ',
  },
};

// Compared: the tables and key/value lists. Diagrams and the presentation text derive from them;
// annexes (collection log, gaps against the Build) belong to each collection.
const COMPARED = new Set(['table', 'kv']);
const KEY_COLUMNS_MAX = 3;

const show = (v) => (v == null || v === '' ? null : String(v));
const same = (a, b) => show(a) === show(b);

/**
 * Row keys for one table on both sides: the fewest leading columns that tell every row apart in
 * each collection (a disk is its node, tier and serial; a user its type and name). When nothing
 * short enough is unique, the occurrence rank breaks the tie.
 */
export function rowKeys(beforeRows, afterRows) {
  const width = Math.max(1, ...[...beforeRows, ...afterRows].map(r => r.length));
  const keyOf = (n) => (cells) => cells.slice(0, n).map(c => show(c) ?? '').join(' · ');
  const unique = (rows, k) => new Set(rows.map(k)).size === rows.length;
  for (let n = 1; n <= Math.min(KEY_COLUMNS_MAX, width); n++) {
    const k = keyOf(n);
    if (unique(beforeRows, k) && unique(afterRows, k)) return { size: n, of: (rows) => rows.map(k) };
  }
  const k = keyOf(1);
  const ranked = (rows) => {
    const seen = {};
    return rows.map(r => { const base = k(r); seen[base] = (seen[base] || 0) + 1; return seen[base] > 1 ? `${base} #${seen[base]}` : base; });
  };
  return { size: 1, of: ranked };
}

/** The differences of one section, as report rows [element, field, before, after]. */
export function diffSection(before, after, t) {
  const rows = [];
  const counts = { added: 0, removed: 0, changed: 0 };
  const change = (element, field, a, b) => { rows.push([element, field, show(a), show(b)]); counts.changed++; };

  // Collected on one side only: the state is the change, the content cannot be compared.
  if (before.empty !== after.empty) {
    change(null, t.state, before.empty ? before.emptyText : t.collected, after.empty ? after.emptyText : t.collected);
    return { rows, counts };
  }
  if (before.empty) return { rows, counts };

  if (before.kind === 'kv') {
    const a = new Map(before.rows.map(r => [r.label, r.value]));
    const b = new Map(after.rows.map(r => [r.label, r.value]));
    for (const [label, value] of b) {
      if (!a.has(label)) { rows.push([label, t.addedRow, null, show(value)]); counts.added++; }
      else if (!same(a.get(label), value)) change(label, null, a.get(label), value);
    }
    for (const [label, value] of a) if (!b.has(label)) { rows.push([label, t.removedRow, show(value), null]); counts.removed++; }
    return { rows, counts };
  }

  // Tables: columns matched by name, so a column added by a newer version does not shift the rest.
  const columns = after.columns;
  const align = (s) => s.rows.map(r => columns.map(c => { const i = s.columns.indexOf(c); return i < 0 ? undefined : r.cells[i]; }));
  const a = align(before), b = align(after);
  const keys = rowKeys(a, b);
  const ka = keys.of(a), kb = keys.of(b);
  // An added or removed row, told in full: each value with its column, the key aside.
  const rest = (cells) => cells.map((c, j) => (j < keys.size || show(c) == null ? null : `${columns[j]}${t.colon}${show(c)}`))
    .filter(Boolean).join(' · ') || null;
  const byKey = new Map(ka.map((k, i) => [k, a[i]]));
  const inAfter = new Set(kb);

  kb.forEach((k, i) => {
    const old = byKey.get(k);
    if (!old) { rows.push([k, t.addedRow, null, rest(b[i])]); counts.added++; return; }
    columns.forEach((c, j) => {
      if (j < keys.size || old[j] === undefined) return;   // key columns, or absent before
      if (!same(old[j], b[i][j])) change(k, c, old[j], b[i][j]);
    });
  });
  ka.forEach((k, i) => { if (!inAfter.has(k)) { rows.push([k, t.removedRow, rest(a[i]), null]); counts.removed++; } });
  return { rows, counts };
}

const date = (iso, lang) => (iso ? new Date(iso).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') : null);

/**
 * Compare two exported collections ({ bundle, inputs, exportedAt, appVersion }). Returns a model
 * for `generateAsBuiltDocx`, and `total`, the number of differences.
 */
export function compareCollections(before, after, { lang = 'fr', catalog = SECTIONS } = {}) {
  const t = L[lang] || L.fr;
  const build = (file) => buildAsBuiltModel({ bundle: file.bundle, catalog, enabled: null, lang });
  const ma = build(before), mb = build(after);

  // Clusters paired by identity, then by name (a cluster recreated keeps its name).
  const clusterOf = (m, c) => ({ ...c, key: c.ref });
  const ca = ma.clusters.map(c => clusterOf(ma, c)), cb = mb.clusters.map(c => clusterOf(mb, c));
  const pairOf = (c) => ca.find(x => x.ref === c.ref) || ca.find(x => x.name && x.name === c.name) || null;
  const paired = cb.map(c => [pairOf(c), c]).filter(([x]) => x);
  const addedClusters = cb.filter(c => !pairOf(c));
  const removedClusters = ca.filter(x => !paired.some(([p]) => p === x));

  const sections = [];
  const summary = [];
  let total = 0;

  const compare = (sa, sb, perimeter) => {
    if (!sa || !sb || !COMPARED.has(sb.kind)) return;
    const { rows, counts } = diffSection(sa, sb, t);
    if (!rows.length) return;
    total += rows.length;
    summary.push([sb.title, perimeter, counts.added, counts.removed, counts.changed]);
    sections.push({
      ...sb, kind: 'table', columns: [t.element, t.field, t.before, t.after],
      rows: rows.map(cells => ({ cells, provenance: 'api' })), empty: false, emptyKind: null, emptyText: null, data: null,
    });
  };

  const own = (m, scope, ref) => m.sections.filter(s => s.scope === scope && (scope !== 'cluster' || s.clusterRef === ref));
  const pcA = own(ma, 'pc'), pcB = own(mb, 'pc');
  for (const sb of pcB) compare(pcA.find(s => s.id === sb.id), sb, t.pc);
  for (const [x, c] of paired) {
    const sa = own(ma, 'cluster', x.ref);
    for (const sb of own(mb, 'cluster', c.ref)) compare(sa.find(s => s.id === sb.id), sb, `${t.cluster} ${c.name || '—'}`);
  }

  const clusterRows = [
    ...addedClusters.map(c => [c.name || c.ref, t.clusterAdded, t.absent, t.present]),
    ...removedClusters.map(c => [c.name || c.ref, t.clusterRemoved, t.present, t.absent]),
  ];
  total += clusterRows.length;

  const side = (file, m) => [m.meta.pcHost, `${t.collectedOn} ${date(file.exportedAt || file.bundle?.meta?.generatedAt, lang) || '—'}`,
    file.appVersion ? `${t.app} ${file.appVersion}` : null].filter(Boolean).join(' · ');
  const head = (id, title, extra) => ({
    id, chapter: 'intro', scope: 'pc', title, clusterRef: null, clusterName: null, source: null,
    data: null, text: null, untitled: false, failure: null, ...extra,
  });
  const lead = [
    head('diff.scope', t.scope, {
      kind: 'kv', columns: [], empty: false, emptyKind: null, emptyText: null,
      rows: [{ label: t.before, value: side(before, ma) }, { label: t.after, value: side(after, mb) }],
    }),
    head('diff.summary', t.summary, {
      kind: 'table', columns: [t.section, t.perimeter, t.added, t.removed, t.changed],
      rows: summary.map(cells => ({ cells, provenance: 'api' })),
      empty: !summary.length && !clusterRows.length, emptyKind: 'custom', emptyText: t.none,
    }),
    ...(clusterRows.length ? [head('diff.clusters', t.clusters, {
      kind: 'table', columns: [t.element, t.field, t.before, t.after],
      rows: clusterRows.map(cells => ({ cells, provenance: 'api' })), empty: false, emptyKind: null, emptyText: null,
    })] : []),
  ];

  return {
    total,
    model: {
      meta: {
        generatedAt: after.exportedAt || mb.meta.generatedAt || null, lang,
        projectName: t.project, pcHost: mb.meta.pcHost, clusterCount: mb.clusters.length,
      },
      chapters: mb.chapters,
      clusters: paired.map(([, c]) => c),
      sections: [...lead, ...sections],
      gaps: [], collection: [],
    },
  };
}

export const compareFileName = (model) =>
  `ecarts_${String(model.meta.pcHost || 'prism').replace(/[^\w.-]+/g, '_')}_${(model.meta.generatedAt || '').slice(0, 10) || 'export'}.docx`;
