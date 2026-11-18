import { test, expect } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resumeStore } from '../server/resume';
import { startServer } from '../server/app';
import { buildExport } from '../web/exportFile';
import { bundle as fixtureBundle } from '../engine/asbuilt/__fixtures__/middleEarth';

const file = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'asbuilt-resume-')), 'resume-after-update.json');
const work = buildExport(fixtureBundle, { values: { client: 'Orbis' }, checked: ['hideEmpty'] }, '0.3.2');

// The desktop's server: an update source that can apply, and a resume store at `at`.
function serve(at, apply = async () => () => {}) {
  const update = { result: Promise.resolve({ available: true, version: '9.9.9', canApply: true }), apply };
  const { server, token } = startServer({ '/': () => new Response('page') }, update, resumeStore(at));
  const base = `http://127.0.0.1:${server.port}`;
  const h = { 'x-token': token, 'content-type': 'application/json' };
  return {
    server,
    apply: (body) => fetch(`${base}/api/update/apply`, { method: 'POST', headers: h, body: JSON.stringify(body) }),
    resume: (headers = h) => fetch(`${base}/api/resume`, { headers }),
  };
}

test('mise à jour : la collecte est écrite avant le redémarrage, puis rendue une fois au lancement suivant', async () => {
  const at = file();
  const before = serve(at);
  try {
    expect((await before.apply({ resume: work })).status).toBe(200);
    expect(fs.existsSync(at)).toBe(true);
  } finally { before.server.stop(true); }

  // Next launch: the file is read and deleted at once, whether the page asks or not.
  const after = serve(at);
  try {
    expect(fs.existsSync(at)).toBe(false);
    const res = await after.resume();
    expect(res.status).toBe(200);
    const back = await res.json();
    expect(back.bundle.pc.host).toBe(fixtureBundle.pc.host);
    expect(back.inputs).toEqual({ values: { client: 'Orbis' }, checked: ['hideEmpty'] });
    expect((await after.resume()).status).toBe(204);   // once only
  } finally { after.server.stop(true); }
});

test('aucun identifiant dans la sauvegarde : seul le format d\'export est accepté', async () => {
  const at = file();
  let applied = false;
  const s = serve(at, async () => { applied = true; return () => {}; });
  try {
    const res = await s.apply({ resume: { bundle: fixtureBundle, pcPass: 'secret' } });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/Sauvegarde de la collecte invalide/);
    expect(applied).toBe(false);   // no update without a saved collection
    expect(fs.existsSync(at)).toBe(false);
  } finally { s.server.stop(true); }
});

test('téléchargement en échec : la sauvegarde est retirée, rien ne revient au lancement suivant', async () => {
  const at = file();
  const s = serve(at, async () => { throw new Error('Téléchargement de la mise à jour impossible'); });
  try {
    expect((await s.apply({ resume: work })).status).toBe(502);
    expect(fs.existsSync(at)).toBe(false);
  } finally { s.server.stop(true); }
});

test('sans collecte à l\'écran, rien n\'est écrit ; /api/resume demande le jeton', async () => {
  const at = file();
  const s = serve(at);
  try {
    expect((await s.apply({})).status).toBe(200);
    expect(fs.existsSync(at)).toBe(false);
    expect((await s.resume({})).status).toBe(403);
    expect((await s.resume()).status).toBe(204);
  } finally { s.server.stop(true); }
});

test('fichier de reprise illisible : ignoré et supprimé', async () => {
  const at = file();
  fs.writeFileSync(at, '{ not json');
  const s = serve(at);
  try {
    expect(fs.existsSync(at)).toBe(false);
    expect((await s.resume()).status).toBe(204);
  } finally { s.server.stop(true); }
});
