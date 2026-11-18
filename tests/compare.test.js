import { test, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import * as docx from 'docx';
import { compareCollections, diffSection, rowKeys, compareFileName } from '../engine/asbuilt/compare';
import { generateAsBuiltDocx } from '../engine/asbuilt/exportAsBuiltDocx';
import { buildExport } from '../web/exportFile';
import { bundle as fixtureBundle } from '../engine/asbuilt/__fixtures__/middleEarth';

const TEMPLATE = fs.readFileSync(path.resolve(import.meta.dir, '../assets/asbuilt-default.docx'));
const exported = (bundle, at) => ({ ...buildExport(bundle, { values: {}, checked: [] }, '0.3.3'), exportedAt: at });

// The same cluster some months later: one network more, one container less, HA and licence changed,
// and a second cluster registered.
function later() {
  const b = structuredClone(fixtureBundle);
  const d = b.clusters[0].data;
  d.networks_v2.entities.push({ name: 'VLAN-100', uuid: 'net-100', vlan_id: 100, ip_config: {} });
  d.storage_containers_v2.entities.splice(1, 1);
  d.ha_v2.ha_state = 'Normal';
  d.license_v1.licenseName = 'Pro';
  b.clusters.push({ extId: 'rivendell-0001', name: 'Rivendell', planRef: null, source: { kind: 'absent', reason: 'not-registered' }, data: {} });
  return b;
}
const before = exported(fixtureBundle, '2026-05-01T10:00:00.000Z');
const after = exported(later(), '2026-11-18T10:00:00.000Z');
const byId = (model, id) => model.sections.filter(s => s.id === id);
const cells = (s) => s.rows.map(r => r.cells);

test('une collecte comparée à elle-même : aucun écart', () => {
  const { total, model } = compareCollections(before, before, { lang: 'fr' });
  expect(total).toBe(0);
  const summary = byId(model, 'diff.summary')[0];
  expect(summary.empty).toBe(true);
  expect(summary.emptyText).toBe('Aucun écart entre les deux collectes.');
  expect(model.sections.filter(s => !s.id.startsWith('diff.'))).toEqual([]);
});

test('ligne ajoutée, ligne supprimée, valeurs modifiées, cluster ajouté', () => {
  const { total, model } = compareCollections(before, after, { lang: 'fr' });
  expect(total).toBeGreaterThan(0);

  const networks = byId(model, 'cfg.networks')[0];
  expect(networks.clusterName).toBe('MiddleEarth');
  expect(networks.columns).toEqual(['Élément', 'Champ', 'Avant', 'Après']);
  expect(cells(networks)).toEqual([['VLAN-100', 'Ligne ajoutée', null, 'VLAN : 100']]);

  const containers = byId(model, 'cfg.containers')[0];
  expect(cells(containers).every(c => c[1] === 'Ligne supprimée' && c[3] === null)).toBe(true);
  expect(cells(containers)).toHaveLength(1);

  // Key/value sections: the label is the element, the values are the engine's wording.
  const licensing = cells(byId(model, 'cfg.licensing')[0]);
  expect(licensing).toContainEqual(['Licence', null, 'Community', 'Pro']);
  expect(byId(model, 'cfg.ha')[0].rows.length).toBeGreaterThan(0);

  expect(cells(byId(model, 'diff.clusters')[0])).toEqual([['Rivendell', 'Cluster ajouté', 'Absent', 'Présent']]);

  // Summary: one row per changed section, with its counts.
  const summary = cells(byId(model, 'diff.summary')[0]);
  const net = summary.find(r => r[0] === networks.title);
  expect(net).toEqual([networks.title, 'Cluster MiddleEarth', 1, 0, 0]);
  // Nothing about the cluster that was only added: it is listed, not diffed.
  expect(model.sections.some(s => s.clusterName === 'Rivendell')).toBe(false);
  // The collection log is the collection's own: never compared.
  expect(model.sections.some(s => s.scope === 'annex')).toBe(false);
});

test('clé de ligne : les premières colonnes qui distinguent chaque ligne, le rang en dernier recours', () => {
  const disks = [['n1', 'SSD', 'S1'], ['n1', 'HDD', 'S2']];
  expect(rowKeys(disks, disks).size).toBe(2);
  expect(rowKeys(disks, disks).of(disks)).toEqual(['n1 · SSD', 'n1 · HDD']);
  const twins = [['a', 'x'], ['a', 'x']];
  expect(rowKeys(twins, twins).of(twins)).toEqual(['a', 'a #2']);
});

test('section collectée d\'un côté seulement : l\'état est l\'écart', () => {
  const t = { state: 'État de la section', collected: 'Collectée' };
  const full = { kind: 'table', empty: false, columns: ['Nom'], rows: [{ cells: ['x'] }] };
  const none = { kind: 'table', empty: true, emptyText: 'Non collecté — HTTP 503', columns: [], rows: [] };
  expect(diffSection(full, none, t).rows).toEqual([[null, 'État de la section', 'Collectée', 'Non collecté — HTTP 503']]);
});

test('colonnes appariées par leur nom : une colonne nouvelle ne décale pas les autres', () => {
  const t = { addedRow: '+', removedRow: '-' };
  const a = { kind: 'table', empty: false, columns: ['Nom', 'VLAN'], rows: [{ cells: ['n', 10] }] };
  const b = { kind: 'table', empty: false, columns: ['Nom', 'MTU', 'VLAN'], rows: [{ cells: ['n', 1500, 10] }] };
  expect(diffSection(a, b, t).rows).toEqual([]);
});

test('anglais : le rapport suit la langue', () => {
  const { model } = compareCollections(before, after, { lang: 'en' });
  expect(model.meta.projectName).toBe('Change report');
  expect(cells(byId(model, 'diff.clusters')[0])).toEqual([['Rivendell', 'Cluster added', 'Absent', 'Present']]);
});

test('rapport .docx rendu dans le template, sans marqueur résiduel', async () => {
  const { model } = compareCollections(before, after, { lang: 'fr' });
  const out = await generateAsBuiltDocx(docx, model, { template: TEMPLATE, lang: 'fr', outputType: 'nodebuffer', appVersion: '0.3.3' });
  const xml = await (await JSZip.loadAsync(out)).file('word/document.xml').async('string');
  expect(xml).not.toMatch(/\{\{\w+\}\}/);
  for (const s of ["Rapport d'écarts", 'Synthèse des écarts', 'VLAN-100', 'Rivendell', 'Ligne ajoutée']) expect(xml).toContain(s);
  expect(compareFileName(model)).toMatch(/^ecarts_.+_2026-11-18\.docx$/);
});
