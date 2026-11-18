import { buildAsBuiltModel } from '../engine/asbuilt/asBuiltModel';
import { generateAsBuiltDocx, asBuiltFileName, sectionKey } from '../engine/asbuilt/exportAsBuiltDocx';
import { svgToPng } from '../engine/asbuilt/diagrams/rasterize';
import { resolveTemplate } from '../engine/asbuilt/template';
import { CHAPTERS, SECTIONS } from '../engine/asbuilt/sections';
import { withDiagrams, renderDiagram } from './diagrams';
import { cleanModel } from './clean';
import { checkTemplate } from './templateCheck';
import { buildExport, parseExport, exportFileName } from './exportFile';
import { version } from '../package.json';
import { startI18n, setLang, browserLang } from './i18n';

const $ = (id) => document.getElementById(id);
$('appVersion').textContent = `v${version}`;
const token = location.hash.slice(1);
let bundle = null;
const CATALOG = withDiagrams(SECTIONS);

// Page and document share one language: changing either changes both. Remembered per browser,
// the browser's language otherwise.
const stored = () => { try { return localStorage.getItem('lang'); } catch { return null; } };
let lang = ['fr', 'en'].includes(stored()) ? stored() : browserLang();
function applyLang(next) {
  lang = next;
  try { localStorage.setItem('lang', next); } catch { /* private window: not remembered */ }
  $('pageLang').value = next;
  $('generate').elements.lang.value = next;
  setLang(next);
  // Section and chapter titles come from the catalog, in each language.
  if (!$('doc').hidden) renderDocumentStep();
}

// Ce que Prism ne sait pas dire : la collecte ne voit ni le site ni les switches.
const CLUSTER_FIELDS = [
  ['siteId', 'Site / Datacenter', 'text'],
  ['torSwitches', 'Switches ToR (nombre)', 'number'],
  ['switchModel', 'Modèle des switches', 'text'],
  ['switchMode', 'Mode des switches (MLAG, VPC…)', 'text'],
  ['portSpeed', 'Vitesse des ports (ex. 25 GbE)', 'text'],
  // À 10G, rien dans l'API ne distingue une cage SFP+ d'un port cuivre 10GBASE-T.
  ['tenGigMedia', 'Connectique des ports 10G', 'select', [['sfp', 'SFP+ (fibre / DAC)'], ['rj45', 'RJ45 (10GBASE-T)']]],
];

const el = (tag, props = {}, children = []) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...children);
  return n;
};

function status(text, error = false) {
  $('status').textContent = text;
  $('status').className = error ? 'error' : '';
}

// Collections and generations under way: an update restarts the app, so it waits for them.
let working = 0;

async function busy(form, label, fn) {
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  working++; refreshUpdate();
  status(label);
  try { await fn(); } catch (err) { status(err.message || String(err), true); }
  working--; refreshUpdate();
  btn.disabled = false;
}

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-token': token }, body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
  return json;
}

function download(blob, name) {
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  a.click();
  // Révoquer tout de suite peut annuler le téléchargement : certains navigateurs le démarrent après le clic.
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

// Saisies de l'étape 3, hors template : ce qu'un export garde et ce qu'un nouveau rendu doit rendre.
const fields = (form) => [...form.elements].filter(e => e.name && e.type !== 'file');
const readInputs = (form) => ({
  values: Object.fromEntries(fields(form).filter(e => e.type !== 'checkbox').map(e => [e.name, e.value])),
  checked: fields(form).filter(e => e.type === 'checkbox' && e.checked).map(e => (e.name === 'section' ? e.value : e.name)),
});
function writeInputs(form, inputs) {
  if (!inputs?.values || !Array.isArray(inputs.checked)) return;
  for (const e of fields(form)) {
    if (e.type === 'checkbox') e.checked = inputs.checked.includes(e.name === 'section' ? e.value : e.name);
    else if (inputs.values[e.name] != null) e.value = inputs.values[e.name];
  }
}

$('connect').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = new FormData(ev.target);
  busy(ev.target, 'Interrogation du Prism Central…', async () => {
    ({ bundle } = await post('/api/pc', { ...Object.fromEntries(f), ignoreSSL: f.has('ignoreSSL') }));
    $('doc').hidden = true;
    renderPeStep();
    // Sans cluster déclaré, il n'y a pas de Prism Element à interroger : le document est prêt.
    if (!bundle.clusters.length) renderDocumentStep();
    status(`${bundle.clusters.length} cluster(s) détecté(s).`);
  });
});

function renderPeStep() {
  $('peRows').replaceChildren(...bundle.clusters.map(c => el('tr', {}, [
    el('td', { textContent: c.name }),
    // Modifiable : le PC ne connaît pas toujours la VIP, et elle n'est pas toujours joignable d'ici.
    el('td', {}, [el('input', { type: 'text', name: `host.${c.extId}`, value: c.address || '', placeholder: 'IP ou FQDN' })]),
    el('td', {}, [el('input', { type: 'text', name: `user.${c.extId}`, value: 'admin' })]),
    el('td', {}, [el('input', { type: 'password', name: `pass.${c.extId}`, autocomplete: 'off' })]),
    el('td', { id: `state.${c.extId}` }),
  ])));
  $('pe').hidden = !bundle.clusters.length;
}

function renderPeStates(errors = {}) {
  for (const c of bundle.clusters) {
    const cell = $(`state.${c.extId}`);
    const error = errors[c.extId];
    cell.className = c.source.kind === 'live' ? 'ok' : (error ? 'ko' : '');
    cell.textContent = c.source.kind === 'live' ? 'Collecté' : (error || 'Sans identifiants : Prism Central seul');
  }
}

$('peCopy').addEventListener('click', () => {
  const [first, ...rest] = $('peRows').rows;
  if (!first) return;
  const [, user, pass] = first.querySelectorAll('input');
  for (const row of rest) {
    const [, u, p] = row.querySelectorAll('input');
    u.value = user.value; p.value = pass.value;
  }
});

// Clusters collectés en même temps : assez pour ne pas attendre, pas assez pour saturer le poste.
const PE_CONCURRENCY = 3;

$('peForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = new FormData(ev.target);
  const creds = bundle.clusters
    .map(c => ({ extId: c.extId, host: f.get(`host.${c.extId}`).trim(), user: f.get(`user.${c.extId}`), pass: f.get(`pass.${c.extId}`) }))
    .filter(c => c.pass);
  busy(ev.target, 'Collecte des Prism Element…', async () => {
    // Une requête par cluster : chaque ligne dit où elle en est, et un cluster lent ne masque pas les autres.
    const errors = {};
    const queue = [...creds];
    let done = 0;
    const cell = (extId, className, text) => Object.assign($(`state.${extId}`), { className, textContent: text });
    for (const c of creds) cell(c.extId, '', 'En attente…');
    const worker = async () => {
      for (let c; (c = queue.shift());) {
        cell(c.extId, '', 'Collecte en cours…');
        try {
          errors[c.extId] = (await post('/api/pe', { creds: [c] })).errors[c.extId] ?? null;
        } catch (err) { errors[c.extId] = err.message || String(err); }
        cell(c.extId, errors[c.extId] ? 'ko' : 'ok', errors[c.extId] || 'Collecté');
        status(`Collecte des Prism Element… ${++done}/${creds.length}`);
      }
    };
    await Promise.all(Array.from({ length: PE_CONCURRENCY }, worker));
    // Les réponses se croisent : la collecte complète se relit une fois toutes les lignes finies.
    ({ bundle } = await post('/api/pe', { creds: [] }));
    renderPeStates(errors);
    renderDocumentStep();
    const failed = Object.values(errors).filter(Boolean).length;
    status(failed ? `${failed} Prism Element en échec : corrigez la ligne et relancez, ou générez sans.` : 'Collecte terminée.', failed > 0);
  });
});

function renderDocumentStep() {
  // Retenter un Prism Element redessine l'étape : ce qui était déjà saisi ne doit pas s'effacer.
  const kept = $('doc').hidden ? null : readInputs($('generate'));
  const line = (name, s) => el('li', {}, [
    `${name} — `,
    s.kind === 'absent' ? `non collecté (${s.reason})` : `${s.collectors.ok}/${s.collectors.total} collecteurs`,
    ...(s.errors?.length ? [el('small', { textContent: ` · sans réponse : ${s.errors.map(e => e.key).join(', ')}` })] : []),
  ]);
  $('log').replaceChildren(
    line(`Prism Central ${bundle.pc.host}`, bundle.pc.source),
    ...bundle.clusters.map(c => line(`Cluster ${c.name}`, c.source)),
  );

  $('clusters').replaceChildren(...bundle.clusters.map((c, i) => el('fieldset', {}, [
    el('legend', { textContent: `Cluster ${c.name}` }),
    el('div', { className: 'grid' }, CLUSTER_FIELDS.map(([key, label, type, options]) =>
      el('label', { textContent: label }, [options
        ? el('select', { name: `c${i}.${key}` }, options.map(([value, text]) => el('option', { value, textContent: text })))
        : el('input', { type, name: `c${i}.${key}`, min: 0 })]))),
  ])));

  const { entries } = resolveTemplate(null, CATALOG);
  $('sections').replaceChildren(...CHAPTERS.flatMap(ch => {
    const items = entries.filter(e => e.chapter === ch.id);
    return items.length ? [
      el('div', { className: 'chapter', textContent: ch.title[lang] || ch.title.fr }),
      ...items.map(e => el('label', { className: 'check' }, [
        el('input', { type: 'checkbox', name: 'section', value: e.id, checked: e.enabled }), e.title[lang] || e.title.fr,
      ])),
    ] : [];
  }));
  $('doc').hidden = false;
  writeInputs($('generate'), kept);
}

$('exportBtn').addEventListener('click', () => {
  const file = buildExport(bundle, readInputs($('generate')), version);
  download(new Blob([JSON.stringify(file)], { type: 'application/json' }), exportFileName(bundle));
  status('Collecte exportée.');
});

$('importFile').addEventListener('change', async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  status('Lecture de la collecte…');
  try {
    const { bundle: imported, inputs } = parseExport(await file.text());
    ({ bundle } = await post('/api/import', { bundle: imported, ignoreSSL: $('connect').elements.ignoreSSL.checked }));
    $('doc').hidden = true;
    renderPeStep();
    renderPeStates();
    renderDocumentStep();
    writeInputs($('generate'), inputs);
    applyLang($('generate').elements.lang.value);   // the collection's document language wins
    status(`Collecte de ${bundle.pc.host} reprise : ${bundle.clusters.length} cluster(s).`);
  } catch (err) { status(err.message || String(err), true); }
  ev.target.value = '';   // le même fichier doit pouvoir être rechargé
});

$('generate').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = new FormData(ev.target);
  busy(ev.target, 'Génération…', async () => {
    const lang = f.get('lang');
    const project = {
      name: f.get('projet') || f.get('client') || bundle.pc.host,
      // Le chapitre « Présentation » nomme le client et l'intégrateur quand ils sont saisis.
      scoping: { engagement: { customer: f.get('client') || null } },
      build: {
        clusters: bundle.clusters.map((c, i) => ({
          clusterName: c.name,
          ...Object.fromEntries(CLUSTER_FIELDS.map(([key]) => [key, f.get(`c${i}.${key}`) || null])),
        })),
      },
    };
    const { catalog } = resolveTemplate(null, CATALOG);
    let model = buildAsBuiltModel({ bundle, project, catalog, enabled: f.getAll('section'), lang, integrator: f.get('integrateur') || null });
    if (f.has('hideEmpty')) model = cleanModel(model);

    const file = f.get('template');
    let template;
    if (file?.size) { template = await file.arrayBuffer(); await checkTemplate(template); }
    else template = await (await fetch('/template.docx')).arrayBuffer();

    // Un schéma sans rien à dessiner sort du document, comme une section sans donnée.
    const images = {};
    for (const s of model.sections.filter(x => x.kind === 'diagram')) {
      const svg = renderDiagram(s.data, lang);
      if (svg) images[sectionKey(s)] = await svgToPng(svg);
    }
    model.sections = model.sections.filter(s => s.kind !== 'diagram' || images[sectionKey(s)]);

    const docx = await import('docx');
    const blob = await generateAsBuiltDocx(docx, model, {
      lang, template, images, appVersion: version, branding: { customer: f.get('client') },
    });
    download(blob, asBuiltFileName(model, 'docx'));
    status('Document généré.');
  });
});

// Theme: dark by default, light on demand. The <head> script applies a stored light choice
// before the first paint; this only keeps the control and the storage in step.
const isLight = document.documentElement.dataset.theme === 'light';
for (const input of document.querySelectorAll('input[name=theme]')) {
  input.checked = input.value === (isLight ? 'light' : 'dark');
  input.addEventListener('change', () => {
    const root = document.documentElement;
    if (input.value === 'light') root.dataset.theme = 'light'; else delete root.dataset.theme;
    try { localStorage.setItem('theme', input.value); } catch { /* private window: not remembered */ }
  });
}

// New version, checked once by the server at launch. Desktop: one click installs and restarts;
// portable executables: a link to the release. Offline or up to date: the band stays hidden.
let update = null, applying = false;
function refreshUpdate() {
  $('updateBtn').disabled = $('updateConfirm').disabled = applying || working > 0;
  $('updateBtn').title = working > 0 ? 'Disponible une fois la collecte ou la génération terminée' : '';
}
async function showUpdate() {
  try {
    const res = await fetch('/api/update', { headers: { 'x-token': token } });
    if (res.ok) update = await res.json();
  } catch { /* offline: nothing to say */ }
  if (!update?.available) return;
  $('updateText').textContent = `Version ${update.version} disponible.`;
  $('updateBtn').hidden = !update.canApply;
  Object.assign($('updateLink'), { hidden: update.canApply || !update.url, href: update.url || '' });
  $('update').hidden = false;
  refreshUpdate();
}
async function applyUpdate() {
  applying = true; refreshUpdate();
  status('Téléchargement de la mise à jour…');
  try {
    await post('/api/update/apply', {});
    status('Redémarrage sur la nouvelle version…');
  } catch (err) {
    applying = false; refreshUpdate();
    status(err.message || String(err), true);
  }
}
// A collection on screen may hold inputs not exported yet: say so, and ask a second click.
$('updateBtn').addEventListener('click', () => {
  if (!bundle) return applyUpdate();
  $('updateBtn').hidden = true;
  $('updateWarn').hidden = $('updateConfirm').hidden = false;
});
$('updateConfirm').addEventListener('click', applyUpdate);

$('pageLang').addEventListener('change', (ev) => applyLang(ev.target.value));
$('generate').elements.lang.addEventListener('change', (ev) => applyLang(ev.target.value));
startI18n(lang);
applyLang(lang);
showUpdate();
