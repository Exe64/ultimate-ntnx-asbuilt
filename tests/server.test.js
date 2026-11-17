import { test, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { checkTemplate } from '../web/templateCheck';
import { buildExport, parseExport, FORMAT, VERSION } from '../web/exportFile';
import { startFakePrism } from './fixtures/fakePrism';

const ROOT = path.resolve(import.meta.dir, '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'assets/asbuilt-default.docx'));

// Le vrai serveur, lancé comme le fait l'exécutable : le jeton se lit dans l'URL qu'il affiche.
let proc, base, token, prism;

beforeAll(async () => {
  prism = startFakePrism();
  proc = Bun.spawn([process.execPath, 'server/main.js'], { cwd: ROOT, env: { ...process.env, NO_OPEN: '1', PORT: '0' }, stdout: 'pipe' });
  let out = '';
  for await (const chunk of proc.stdout) {
    out += new TextDecoder().decode(chunk);
    const m = out.match(/(http:\/\/127\.0\.0\.1:\d+)\/#(\S+)/);
    if (m) { [, base, token] = m; break; }
  }
});
afterAll(() => { proc.kill(); prism.stop(); });

const post = (route, body, headers = { 'x-token': token }) => fetch(base + route, {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});

test('la page et le template se servent sans jeton', async () => {
  const page = await fetch(`${base}/`);
  expect(page.status).toBe(200);
  // Le script de la page se construit : une erreur d'import dans web/ casserait ici.
  const script = (await page.text()).match(/<script[^>]+src="([^"]+)"/)[1];
  const js = await fetch(new URL(script, `${base}/`));
  expect(js.status).toBe(200);
  expect(await js.text()).toContain('/api/import');
  const tpl = await fetch(`${base}/template.docx`);
  expect(tpl.status).toBe(200);
  expect((await tpl.arrayBuffer()).byteLength).toBe(TEMPLATE.length);
  expect((await fetch(`${base}/api/pc`)).status).toBe(404);   // l'API ne répond qu'en POST
});

test('sans le jeton du lancement, l\'API refuse de collecter', async () => {
  const body = { pcHost: prism.host, pcUser: 'admin', pcPass: 'secret' };
  for (const headers of [{}, { 'x-token': '' }, { 'x-token': 'faux' }]) {
    for (const route of ['/api/pc', '/api/pe']) {
      const res = await post(route, body, headers);
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe('Jeton invalide');
    }
  }
  expect(prism.seen.length).toBe(0);   // refusé avant tout appel sortant
});

test('Prism Central d\'abord, puis Prism Element ; les erreurs se disent sans faire tomber le serveur', async () => {
  let res = await post('/api/pe', { creds: [] });
  expect(res.status).toBe(502);
  expect((await res.json()).error).toMatch(/Prism Central d'abord/);

  res = await post('/api/pc', { pcHost: prism.host });
  expect(res.status).toBe(502);
  expect((await res.json()).error).toMatch(/requis/);

  res = await post('/api/pc', { pcHost: prism.host, pcUser: 'admin', pcPass: 'faux' });
  expect(res.status).toBe(502);
  expect((await res.json()).error).toMatch(/401/);

  res = await post('/api/pc', { pcHost: prism.host, pcUser: 'admin', pcPass: 'secret' });
  expect(res.status).toBe(200);
  let { bundle } = await res.json();
  expect(bundle.clusters.map(c => [c.name, c.source.kind])).toEqual([['Gondor', 'absent']]);

  res = await post('/api/pe', { creds: [{ extId: 'c-1', user: 'admin', pass: 'faux' }] });
  expect(res.status).toBe(200);
  expect((await res.json()).errors['c-1']).toMatch(/401/);

  res = await post('/api/pe', { creds: [{ extId: 'c-1', user: 'admin', pass: 'secret' }] });
  const json = await res.json();
  expect(json.errors).toEqual({ 'c-1': null });
  expect(json.bundle.clusters[0].source.kind).toBe('live');
  // Les identifiants ne reviennent jamais dans la collecte.
  expect(JSON.stringify(json)).not.toContain('secret');
});

const rezip = async (edit) => {
  const zip = await JSZip.loadAsync(TEMPLATE);
  await edit(zip);
  return zip.generateAsync({ type: 'arraybuffer' });
};
const patch = (file, from, to) => async (zip) => {
  const xml = await zip.file(file).async('string');
  expect(xml).toContain(from);
  zip.file(file, xml.replaceAll(from, to));
};

test('contrôle du template : le template livré passe, un template inutilisable est refusé avec sa raison', async () => {
  await checkTemplate(TEMPLATE);
  await expect(checkTemplate(new TextEncoder().encode('pas un zip'))).rejects.toThrow(/illisible/);
  await expect(checkTemplate(await rezip(zip => zip.remove('word/document.xml')))).rejects.toThrow(/marqueur \{\{corps\}\}/);
  await expect(checkTemplate(await rezip(patch('word/document.xml', 'corps', 'body')))).rejects.toThrow(/marqueur \{\{corps\}\}/);
  await expect(checkTemplate(await rezip(patch('word/styles.xml', 'w:styleId="AsBuiltTable"', 'w:styleId="Autre"')))).rejects.toThrow(/AsBuiltTable/);
  // Word découpe un marqueur en plusieurs « runs » : il reste reconnu.
  await checkTemplate(await rezip(patch('word/document.xml', '{{corps}}', '{{co</w:t></w:r><w:r><w:t>rps}}')));
});

test('export / import : le fichier se relit, recharge le serveur, et ne porte aucun identifiant', async () => {
  let res = await post('/api/pc', { pcHost: prism.host, pcUser: 'admin', pcPass: 'secret' });
  const { bundle } = await res.json();
  const inputs = { values: { client: 'ACME', 'c0.siteId': 'Minas Tirith' }, checked: ['hideEmpty', 'pc.inventory'] };
  const text = JSON.stringify(buildExport(bundle, inputs, '0.0.0'));
  expect(text).not.toContain('secret');
  expect(text).not.toMatch(/authorization|password|pcPass/i);

  const back = parseExport(text);
  expect(back.bundle).toEqual(bundle);
  expect(back.inputs).toEqual(inputs);

  // Un fichier inutilisable est refusé avec sa raison, côté page comme côté serveur.
  expect(() => parseExport('{')).toThrow(/illisible/);
  expect(() => parseExport('{"format":"autre"}')).toThrow(/n'est pas une collecte/);
  expect(() => parseExport(JSON.stringify({ format: FORMAT, version: VERSION + 1, bundle }))).toThrow(/format 2/);
  expect(() => parseExport(JSON.stringify({ format: FORMAT, version: VERSION, bundle: { pc: bundle.pc } }))).toThrow(/incomplète/);
  res = await post('/api/import', { bundle: { clusters: [] } });
  expect(res.status).toBe(502);
  expect((await res.json()).error).toMatch(/incomplète/);
  expect((await post('/api/import', { bundle }, {})).status).toBe(403);

  // Reprise : le serveur retrouve la collecte importée, et un Prism Element se retente dessus.
  const renamed = structuredClone(bundle);
  renamed.clusters[0].name = 'Gondor-importé';
  res = await post('/api/import', { bundle: renamed });
  expect(res.status).toBe(200);
  expect((await res.json()).bundle.clusters[0].name).toBe('Gondor-importé');
  res = await post('/api/pe', { creds: [{ extId: 'c-1', user: 'admin', pass: 'secret' }] });
  const json = await res.json();
  expect(json.errors).toEqual({ 'c-1': null });
  expect(json.bundle.clusters[0].name).toBe('Gondor-importé');
  expect(json.bundle.clusters[0].source.kind).toBe('live');
});
