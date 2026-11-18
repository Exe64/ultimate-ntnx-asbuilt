import { test, expect, afterAll } from 'bun:test';
import { isNewer, checkGithub, updateSource, NONE } from '../server/update';
import { startServer } from '../server/app';

// A fake GitHub API: answers what `reply` says, counts the requests.
let reply = () => Response.json({ tag_name: 'v9.9.9', html_url: 'https://github.com/x/y/releases/tag/v9.9.9' });
let hits = 0;
const github = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => { hits++; return reply(); } });
const api = `http://127.0.0.1:${github.port}/latest`;
afterAll(() => github.stop(true));

test('versions : seule une version strictement plus récente compte', () => {
  expect(isNewer('0.3.0', '0.2.2')).toBe(true);
  expect(isNewer('v0.10.0', '0.9.9')).toBe(true);   // numeric, not alphabetical
  expect(isNewer('1.0.0', '0.99.99')).toBe(true);
  expect(isNewer('0.2.2', '0.2.2')).toBe(false);
  expect(isNewer('0.2.1', '0.2.2')).toBe(false);
  expect(isNewer('garbage', '0.2.2')).toBe(false);
});

test('exécutable portable : la dernière release GitHub, avec son lien', async () => {
  expect(await checkGithub({ url: api, installed: '0.2.2' }))
    .toEqual({ available: true, version: '9.9.9', url: 'https://github.com/x/y/releases/tag/v9.9.9', canApply: false });
  expect(await checkGithub({ url: api, installed: '9.9.9' })).toEqual(NONE);
});

test('hors ligne, réponse illisible ou erreur : rien à signaler, sans exception', async () => {
  reply = () => new Response('rate limited', { status: 403 });
  expect(await checkGithub({ url: api })).toEqual(NONE);
  reply = () => new Response('not json');
  expect(await checkGithub({ url: api })).toEqual(NONE);
  reply = () => Response.json({});
  expect(await checkGithub({ url: api })).toEqual(NONE);
  // Nothing listens on port 9 here: the request fails at once.
  expect(await checkGithub({ url: 'http://127.0.0.1:9/latest' })).toEqual(NONE);
});

test('réseau muet : abandon après le délai, sans bloquer', async () => {
  reply = () => new Promise(() => {});   // never answers
  const t0 = Date.now();
  expect(await checkGithub({ url: api, timeoutMs: 200 })).toEqual(NONE);
  expect(Date.now() - t0).toBeLessThan(2000);
});

test('NO_UPDATE_CHECK=1 : aucune requête envoyée', async () => {
  hits = 0;
  const src = updateSource({ check: () => checkGithub({ url: api }), env: { NO_UPDATE_CHECK: '1' } });
  expect(await src.result).toEqual(NONE);
  expect(src.apply).toBe(null);
  expect(hits).toBe(0);
});

test('une seule vérification par lancement, quelle que soit la fréquence des questions', async () => {
  reply = () => Response.json({ tag_name: 'v9.9.9' });
  hits = 0;
  const src = updateSource({ check: () => checkGithub({ url: api, installed: '0.2.2' }), env: {} });
  await Promise.all([src.result, src.result, src.result]);
  expect(hits).toBe(1);
  // A check that throws is the same as nothing to report.
  expect(await updateSource({ check: () => { throw new Error('boom'); }, env: {} }).result).toEqual(NONE);
});

// The server routes, with an injected source: the desktop's Updater stands behind the same shape.
const serve = (update) => {
  const { server, token } = startServer({ '/': () => new Response('page') }, update);
  const base = `http://127.0.0.1:${server.port}`;
  return { server, base, get: (h = { 'x-token': token }) => fetch(`${base}/api/update`, { headers: h }),
    apply: (h = { 'x-token': token }) => fetch(`${base}/api/update/apply`, { method: 'POST', headers: h }) };
};

test('/api/update : la page lit le résultat ; sans jeton, refusé', async () => {
  const s = serve({ result: Promise.resolve({ available: true, version: '9.9.9', url: 'u', canApply: false }), apply: null });
  try {
    expect((await s.get({})).status).toBe(403);
    expect((await s.apply({})).status).toBe(403);
    expect(await (await s.get()).json()).toEqual({ available: true, version: '9.9.9', url: 'u', canApply: false });
    // Portable executable: nothing to apply.
    expect((await s.apply()).status).toBe(409);
  } finally { s.server.stop(true); }
});

test('/api/update/apply (desktop) : prépare, répond, puis redémarre', async () => {
  let restarted = false;
  const s = serve({
    result: Promise.resolve({ available: true, version: '9.9.9', url: 'u', canApply: true }),
    apply: async () => () => { restarted = true; },
  });
  try {
    expect((await (await s.get()).json()).canApply).toBe(true);
    const res = await s.apply();
    expect(res.status).toBe(200);
    expect(restarted).toBe(false);   // the answer leaves before the restart
    await Bun.sleep(700);
    expect(restarted).toBe(true);
  } finally { s.server.stop(true); }
});

test('/api/update/apply : un échec de téléchargement se dit, l\'application reste ouverte', async () => {
  const s = serve({
    result: Promise.resolve({ available: true, version: '9.9.9', canApply: true }),
    apply: async () => { throw new Error('Téléchargement de la mise à jour impossible'); },
  });
  try {
    const res = await s.apply();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/Téléchargement/);
  } finally { s.server.stop(true); }
});
