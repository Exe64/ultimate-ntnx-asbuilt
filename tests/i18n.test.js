import { test, expect } from 'bun:test';
import fs from 'node:fs';
import { EN, toEnglish } from '../web/i18n';

// Same in both languages: names, numbering, examples.
const SAME = new Set(['Ultimate As-Built Generator', '1', '2', '3', 'Prism Element', 'Document', 'Cluster',
  'Français', 'English','pc.exemple.local', 'Prism Central', 'GitHub', 'Blog']);

test('page : chaque texte de index.html a sa traduction anglaise', () => {
  const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8')
    .replace(/<style>[\s\S]*?<\/style>/, '').replace(/<script[\s\S]*?<\/script>/g, '');
  const texts = [
    ...[...html.matchAll(/>([^<>]+)</g)].map(m => m[1]),
    ...[...html.matchAll(/placeholder="([^"]+)"/g)].map(m => m[1]),
  ].map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const missing = texts.filter(t => !SAME.has(t) && !(t in EN));
  expect(missing).toEqual([]);
});

test('page : textes variables et messages du serveur en anglais', () => {
  expect(toEnglish('3 cluster(s) détecté(s).')).toBe('3 cluster(s) detected.');
  expect(toEnglish('Collecte des Prism Element… 2/5')).toBe('Collecting Prism Elements… 2/5');
  expect(toEnglish(' · sans réponse : v4_snmp, v4_vpcs')).toBe(' · no response: v4_snmp, v4_vpcs');
  expect(toEnglish('non collecté (identifiants Prism Element non fournis)')).toBe('not collected (Prism Element credentials not provided)');
  expect(toEnglish('Prism Central injoignable ou refusé (HTTP 503) : aucune réponse'))
    .toBe('Prism Central unreachable or refused (HTTP 503): no response');
  expect(toEnglish('identifiants refusés (HTTP 401), aucune autre requête envoyée')).toBe('credentials refused (HTTP 401), no further request sent');
  expect(toEnglish('Jeton invalide')).toMatch(/^Invalid token/);
  expect(toEnglish('SVG illisible pour la rasterisation')).toBe('Diagram could not be rendered to an image');
  // Ce qui n'est pas du texte de la page reste tel quel : noms, adresses, clés.
  for (const s of ['NTNX-LAB-1', '192.168.84.201', 'v4_snmp', '']) expect(toEnglish(s)).toBe(s);
});
