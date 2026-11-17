/**
 * Couche de compatibilité des API sortantes (plan #22).
 *
 * Tout appel vers Prism Central, Prism Element, Move ou vCenter obtient son
 * chemin ici, jamais en dur : `url(client, capacité, suffixe)`. La capacité est
 * résolue contre `matrix.json` et contre la version de la cible, portée par le
 * client (`bind`) :
 *
 *  - version connue : premier endpoint dont la version minimale est atteinte
 *    (repli vers une API plus ancienne quand la matrice en déclare une), sinon
 *    `UnsupportedError` — version requise contre version détectée ;
 *  - version inconnue (jamais détectée, détection impossible) : aucun filtrage,
 *    endpoint préféré d'abord. C'est le comportement d'avant la couche : une
 *    cible qu'on ne sait pas dater n'est jamais bloquée.
 *
 * Les namespaces v4 gardent leur propre mineure, lue sur le PC
 * (`/api/{ns}/unversioned/info`) et mise en cache 24 h.
 */

'use strict';

const MATRIX = require('./matrix.json');

const TTL_MS = 24 * 60 * 60 * 1000;

// ─── Versions ────────────────────────────────────────────────────────────────

/**
 * « pc.2024.3 », « 6.8.1 », « 8.0.2.00100 », « v5.3 » → [n, n, …] comparable,
 * null si illisible.
 */
function parseVersion(product, raw) {
  if (raw == null) return null;
  const m = String(raw).trim().toLowerCase().replace(/^pc\./, '').replace(/^v/, '').match(/^\d+(\.\d+)*/);
  if (!m) return null;
  const parts = m[0].split('.').map(Number);
  // Prism Central est passé de pc.2024.x à pc.7.3 : sans correction, 7.3 < 2024.1.
  // ponytail: règle ad hoc pour le seul saut de numérotation connu ; à revoir si Nutanix renumérote encore.
  if (product === 'pc' && parts[0] >= 7 && parts[0] < 2000) parts[0] += 10000;
  return parts;
}

function compareParts(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d;
  }
  return 0;
}

/** Version ≥ minimum ? null si l'une des deux est illisible. */
function atLeast(product, version, min) {
  const v = parseVersion(product, version);
  const m = parseVersion(product, min);
  return v && m ? compareParts(v, m) >= 0 : null;
}

// ─── Cibles ──────────────────────────────────────────────────────────────────

/** Attache produit + version détectée au client. Renvoie le client. */
function bind(client, product, version) {
  if (client) client.compat = { product, version: version || null };
  return client;
}

/** Version absente ou détectée il y a plus de 24 h. `undefined` = la ligne ne porte pas l'information. */
function isStale(detectedAt) {
  if (detectedAt === undefined) return false;
  return detectedAt === null || Date.now() - new Date(detectedAt).getTime() > TTL_MS;
}

// ─── Erreur de blocage ───────────────────────────────────────────────────────

class UnsupportedError extends Error {
  constructor(capability, product, detected, required) {
    const label = MATRIX.products[product]?.label || product;
    super(required
      ? `${label} ${required} ou plus récent requis pour cette opération (version détectée : ${detected})`
      : `Opération indisponible sur ${label} (version détectée : ${detected})`);
    this.name = 'UnsupportedError';
    this.code = 'API_UNSUPPORTED';
    this.status = 422;
    this.capability = capability;
    this.product = product;
    this.detected = detected;
    this.required = required || null;
  }
}

// ─── Résolution ──────────────────────────────────────────────────────────────

/**
 * Endpoints d'une capacité. Au-delà des capacités nommées de la matrice, deux
 * formes génériques : une famille (« prism.v2 », « move.v2 », suffixe = chemin
 * relatif) et « prism.v4/<namespace> ».
 */
function endpointsOf(capability) {
  const named = MATRIX.capabilities[capability];
  if (named) return named;
  if (MATRIX.apis[capability]) return [{ api: capability, path: '' }];
  const m = /^prism\.v4\/([a-z]+)$/.exec(capability);
  if (m) return [{ api: 'prism.v4', namespace: m[1], path: '' }];
  throw new Error(`Capacité d'API inconnue : ${capability}`);
}

function minFor(endpoint, product) {
  return (endpoint.min || MATRIX.apis[endpoint.api].min)[product];
}

/**
 * Endpoints utilisables pour ce client, dans l'ordre de préférence. Lève
 * `UnsupportedError` quand la version connue de la cible n'en permet aucun.
 * `opts.api` restreint à une famille (garder la même génération sur une session).
 */
function endpoints(client, capability, opts = {}) {
  const all = endpointsOf(capability).filter(e => !opts.api || e.api === opts.api);
  const { product, version } = client?.compat || {};
  if (!product || !parseVersion(product, version)) return all;

  const ok = all.filter(e => {
    const min = minFor(e, product);
    return min != null && atLeast(product, version, min);
  });
  if (ok.length) return ok;

  const mins = all.map(e => minFor(e, product)).filter(Boolean)
    .sort((a, b) => compareParts(parseVersion(product, a), parseVersion(product, b)));
  throw new UnsupportedError(capability, product, version, mins[0]);
}

/** Chemin complet d'un endpoint (sonde la mineure v4 au besoin). */
async function urlFor(client, endpoint, suffix = '') {
  let base = MATRIX.apis[endpoint.api].base;
  if (endpoint.api === 'prism.v4') {
    const version = await resolveV4Version(client, endpoint.namespace);
    base = base.replace('{namespace}', endpoint.namespace).replace('{version}', version);
  }
  return `${base}${endpoint.path}${suffix}`;
}

/** Chemin de l'endpoint préféré. */
async function url(client, capability, suffix = '', opts = {}) {
  const ep = endpoints(client, capability, opts)[0];
  return urlFor(client, ep, suffix);
}

// ─── Statut d'une cible (UI) ─────────────────────────────────────────────────

/** 'unknown' | 'supported' | 'degraded' (sous le minimum, API anciennes encore joignables) | 'unsupported'. */
function productStatus(product, version) {
  if (!parseVersion(product, version)) return 'unknown';
  if (atLeast(product, version, MATRIX.products[product].min)) return 'supported';
  const reachable = Object.values(MATRIX.apis)
    .some(a => a.min[product] && atLeast(product, version, a.min[product]));
  return reachable ? 'degraded' : 'unsupported';
}

/** Ce que l'UI affiche d'une cible : version, date, badge, capacités bloquées. */
function describe(product, version, detectedAt) {
  const status = productStatus(product, version);
  const blocked = [];
  if (status !== 'unknown') {
    const probe = { compat: { product, version } };
    for (const cap of Object.keys(MATRIX.capabilities)) {
      if (!MATRIX.capabilities[cap].some(e => minFor(e, product) != null)) continue;
      try { endpoints(probe, cap); } catch (e) {
        if (e instanceof UnsupportedError) blocked.push({ capability: cap, required: e.required, message: e.message });
      }
    }
  }
  return {
    product,
    label: MATRIX.products[product].label,
    version: version || null,
    detectedAt: detectedAt || null,
    min: MATRIX.products[product].min,
    status,
    blocked,
  };
}

// ─── Mineures v4 ─────────────────────────────────────────────────────────────

const v4Cache = new Map(); // `${baseURL}|${namespace}` → { version, at }

/**
 * La réponse d'`unversioned/info` n'est pas contractuelle : on ramasse toute
 * chaîne `v4.x` (ou `v4.x.bN` pour une bêta) dans l'arbre.
 */
function collectV4Versions(node, out, depth = 0) {
  if (node == null || depth > 6) return out;
  if (typeof node === 'string') {
    const m = node.match(/v4\.\d+(?:\.[ab]\d+)?/i);
    if (m) out.add(m[0].toLowerCase());
  } else if (Array.isArray(node)) {
    for (const n of node) collectV4Versions(n, out, depth + 1);
  } else if (typeof node === 'object') {
    for (const n of Object.values(node)) collectV4Versions(n, out, depth + 1);
  }
  return out;
}

/**
 * Plus haute GA ; à défaut, plus haute bêta. Une bêta (pc.2022–2023) n'est
 * jamais lue comme la GA de même mineure : `v4.0.b1` ≠ `v4.0`, qui y répond 404.
 */
function pickV4Version(versions) {
  const key = v => v.slice(1).split(/\.[ab]?/).map(Number); // v4.2 → [4,2] ; v4.0.b1 → [4,0,1]
  const sorted = [...versions].sort((a, b) => compareParts(key(a), key(b)));
  const ga = sorted.filter(v => !/\.[ab]\d+$/.test(v));
  return (ga.length ? ga : sorted).pop() || null;
}

/** Mineure v4 servie par ce PC pour ce namespace. Ne lève jamais. */
async function resolveV4Version(client, namespace) {
  const key = `${client?.defaults?.baseURL || '?'}|${namespace}`;
  const hit = v4Cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.version;

  let version = null;
  try {
    const resp = await client.get(`/api/${namespace}/unversioned/info`, { timeout: 10000 });
    version = pickV4Version(collectV4Versions(resp?.data, new Set()));
  } catch {
    // PC ancien, endpoint absent, droits : repli sur la mineure par défaut, mise
    // en cache elle aussi pour ne pas sonder à chaque requête.
  }
  if (!version) version = MATRIX.v4.defaults[namespace] || 'v4.0';
  v4Cache.set(key, { version, at: Date.now() });
  return version;
}

/** Remise à zéro du cache des mineures v4 — réservé aux tests. */
function _resetV4Cache() {
  v4Cache.clear();
}

module.exports = {
  MATRIX,
  TTL_MS,
  parseVersion,
  atLeast,
  bind,
  isStale,
  UnsupportedError,
  endpoints,
  urlFor,
  url,
  productStatus,
  describe,
  resolveV4Version,
  pickV4Version,
  DEFAULT_V4_VERSIONS: MATRIX.v4.defaults,
  _resetV4Cache,
};
