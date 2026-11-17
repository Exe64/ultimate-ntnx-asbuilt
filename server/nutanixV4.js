/**
 * Résolution de version des namespaces v4 de Prism Central, et lecteurs
 * normalisés au-dessus.
 *
 * Pourquoi ce module existe
 * -------------------------
 * Les mineures v4 avancent namespace par namespace : au moment où ces lignes
 * sont écrites, `licensing` est en v4.4, `networking` en v4.3, `clustermgmt` et
 * `vmm` en v4.2, `security` en v4.1. Coder une mineure en dur casse des deux
 * côtés — trop haut, l'endpoint n'existe pas sur un PC ancien ; trop bas, on
 * rate les champs récents. Le même fichier appelait `clustermgmt/v4.0` et
 * `clustermgmt/v4.2` à dix lignes d'écart.
 *
 * Prism Central expose `/api/{namespace}/unversioned/info`, qui dit quelle
 * version il parle réellement. On l'interroge une fois par (hôte, namespace),
 * on met en cache, et on retombe sur la mineure qui était codée en dur avant ce
 * module si l'endpoint est absent. Un PC qui ne connaît pas `unversioned/info`
 * se comporte donc exactement comme avant.
 */

/**
 * Lecteurs normalisés au-dessus de Prism Central (clusters, utilisateurs,
 * alertes), v4 d'abord avec repli v3.
 *
 * Les chemins et la mineure de chaque namespace v4 viennent de la couche de
 * compatibilité (`apiCompat`) : ce module ne décide que de la forme de sortie,
 * identique quelle que soit la génération d'API qui a répondu.
 */

'use strict';

const compat = require('./apiCompat');

/**
 * Collecte paginée d'un endpoint de liste v4 ($page 0-based, $limit).
 * Retourne le tableau agrégé ; lève si le premier appel échoue.
 */
async function pageAll(client, url, { params = {}, pageSize = 100, maxPages = 500 } = {}) {
  const out = [];
  for (let page = 0; page < maxPages; page++) {
    const resp = await client.get(url, { params: { ...params, $page: page, $limit: pageSize } });
    const chunk = resp?.data?.data || [];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return out;
}

/** Liste v4 complète d'une capacité (`opts.suffix` pour un sous-chemin). */
async function listAll(client, capability, opts = {}) {
  return pageAll(client, await compat.url(client, capability, opts.suffix || '', { api: 'prism.v4' }), opts);
}

/**
 * Essaie les endpoints d'une capacité dans l'ordre de la matrice. `run(ep, api)`
 * rend `undefined` pour passer au suivant (réponse vide). Si aucun n'aboutit,
 * l'erreur v4 est remontée de préférence : v3 n'est qu'un repli, et il refuse
 * par construction certaines auth (clé API de service account) — son 401
 * masquerait la vraie cause.
 */
async function firstOf(client, capability, run) {
  let lastErr = null;
  let v4Err = null;
  for (const ep of compat.endpoints(client, capability)) {
    try {
      const out = await run(ep, ep.api);
      if (out !== undefined) return out;
    } catch (e) {
      lastErr = e;
      if (ep.api === 'prism.v4') v4Err = e;
    }
  }
  if (v4Err || lastErr) throw v4Err || lastErr;
  return [];
}

// ─── Normalisation des clusters ───────────────────────────────────────────────
// Une seule forme de sortie, que la source soit v4 ou v3. Les appelants n'ont
// plus à connaître la génération d'API utilisée.

/** v4 renvoie des adresses sous forme { ipv4: { value } } | { fqdn: { value } }. */
function addrValue(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  return entry.ipv4?.value || entry.ipv6?.value || entry.fqdn?.value || null;
}

function addrList(list) {
  return (Array.isArray(list) ? list : []).map(addrValue).filter(Boolean);
}

function normalizeV4Cluster(c) {
  const cfg = c.config || {};
  const net = c.network || {};
  const fns = cfg.clusterFunction || cfg.clusterFunctions || [];
  const ft  = cfg.faultToleranceState || {};
  const currentFt = ft.currentMaxFaultTolerance;
  const rf = cfg.redundancyFactor || (currentFt != null ? currentFt + 1 : 1);

  return {
    extId:      c.extId,
    name:       c.name,
    isPrismCentral: (Array.isArray(fns) ? fns : [fns])
      .map(x => String(x).toUpperCase()).some(f => f.includes('PRISM_CENTRAL')),
    aosVersion: cfg.buildInfo?.version || null,
    numNodes:   c.nodes?.numberOfNodes || 0,
    externalIp: addrValue(net.externalAddress),
    redundancyFactor:        rf,
    desiredRedundancyFactor: ft.desiredMaxFaultTolerance != null
      ? ft.desiredMaxFaultTolerance + 1 : rf,
    hypervisor: 'AHV',
    dns:      addrList(net.nameServerIpList),
    ntp:      addrList(net.ntpServerIpList),
    timezone: cfg.timezone || null,
    faultTolerance: {
      currentMax:  currentFt ?? null,
      desiredMax:  ft.desiredMaxFaultTolerance ?? null,
      domainAwarenessLevel: ft.domainAwarenessLevel || null,
    },
    pulseEnabled: cfg.pulseStatus?.isEnabled ?? null,
    _source: 'v4',
    _raw: c,
  };
}

function normalizeV3Cluster(c) {
  const cfg = c.status?.resources?.config  || {};
  const net = c.status?.resources?.network || {};
  const nodes = c.status?.resources?.nodes?.hypervisor_server_list || [];
  const rf = cfg.redundancy_factor || 1;

  return {
    extId:      c.metadata?.uuid,
    name:       c.spec?.name || c.status?.name,
    isPrismCentral: (cfg.service_list || []).includes('PRISM_CENTRAL'),
    aosVersion: cfg.software_map?.NOS?.version || cfg.software_map?.PC?.version || cfg.build?.version || null,
    numNodes:   nodes.length || 0,
    externalIp: net.external_ip || null,
    redundancyFactor:        rf,
    desiredRedundancyFactor: cfg.desired_redundancy_factor || rf,
    hypervisor: 'AHV',
    dns:      net.name_server_ip_list || [],
    ntp:      net.ntp_server_ip_list  || [],
    timezone: cfg.timezone || null,
    faultTolerance: null, // absent de la vue v3 : les appelants dérivent depuis le RF
    pulseEnabled: null,
    _source: 'v3',
    _raw: c,
  };
}

/**
 * Liste normalisée de TOUS les clusters vus par ce PC, Prism Central compris
 * (repérable via `isPrismCentral`).
 *
 * v4 d'abord, repli v3 sur n'importe quelle erreur ou sur une réponse vide :
 * `clustermgmt` n'est pas exposé sur les PC les plus anciens, et le repli garde
 * le comportement d'avant à l'identique.
 */
async function fetchClusters(client) {
  return firstOf(client, 'pc.clusters', async (ep, api) => {
    if (api === 'prism.v4') {
      const rows = await pageAll(client, await compat.urlFor(client, ep), { pageSize: 100, maxPages: 20 });
      return rows.length ? rows.filter(c => c.extId).map(normalizeV4Cluster) : undefined;
    }
    const resp = await client.post(await compat.urlFor(client, ep, '/list'), { kind: 'cluster', length: 100 });
    return (resp?.data?.entities || []).map(normalizeV3Cluster);
  });
}

/** Les seuls clusters AHV — le PC lui-même est exclu. */
async function fetchAhvClusters(client) {
  return (await fetchClusters(client)).filter(c => !c.isPrismCentral);
}

/** L'entité Prism Central elle-même (timezone / DNS / NTP du PC). */
async function fetchPcCluster(client) {
  return (await fetchClusters(client)).find(c => c.isPrismCentral) || null;
}

/**
 * Versions à stocker pour une connexion Prism Central, tirées de la liste des
 * clusters (déjà lue pour tester la connexion : aucun appel de plus).
 * `aos` est indexé par extId, avec l'IP externe pour retrouver un PE adressé
 * par IP seule.
 */
function versionsFromClusters(clusters) {
  const pc = clusters.find(c => c.isPrismCentral);
  const aos = {};
  for (const c of clusters) {
    if (c.isPrismCentral || !c.extId) continue;
    aos[c.extId] = { name: c.name || null, ip: c.externalIp || null, version: c.aosVersion || null };
  }
  return { pc: pc?.aosVersion || null, aos };
}

// ─── Utilisateurs ─────────────────────────────────────────────────────────────

function normalizeV4User(u) {
  const type = String(u.userType || '').toUpperCase();
  return {
    name: u.username || u.displayName || null,
    userType: type || null,
    isLocal: type === 'LOCAL' || type === '',
    // v4 n'expose pas password_force_change : le verdict « mot de passe par
    // défaut » ne peut pas être rendu depuis cette source.
    forcePasswordChange: null,
    _source: 'v4',
  };
}

function normalizeV3User(u) {
  const type = String(u.status?.resources?.user_type || u.spec?.resources?.user_type || '').toUpperCase();
  return {
    name: u.status?.name || u.spec?.resources?.username || u.metadata?.name || null,
    userType: type || null,
    isLocal: !type || type === 'LOCAL',
    forcePasswordChange: u.spec?.resources?.password_force_change === true
                      || u.status?.resources?.password_force_change === true,
    _source: 'v3',
  };
}

/**
 * Utilisateurs du PC. v3 reste prioritaire ici, à dessein : `iam` v4 n'expose
 * pas `password_force_change`, dont dépend le contrôle « mots de passe par
 * défaut ». v4 ne sert que de repli quand v3 est indisponible.
 */
async function fetchUsers(client) {
  return firstOf(client, 'pc.users', async (ep, api) => {
    if (api === 'prism.v3') {
      const resp = await client.post(await compat.urlFor(client, ep, '/list'), { kind: 'user', length: 200 });
      const entities = resp?.data?.entities;
      return Array.isArray(entities) ? entities.map(normalizeV3User) : undefined;
    }
    const rows = await pageAll(client, await compat.urlFor(client, ep), { pageSize: 100, maxPages: 5 });
    return rows.map(normalizeV4User);
  });
}

// ─── Alertes ──────────────────────────────────────────────────────────────────

function normalizeV4Alert(a) {
  return {
    severity:    String(a.severity || '').toUpperCase(),
    message:     a.title || a.message || 'Alert',
    clusterUuid: a.clusterExtId || a.cluster?.extId || null,
    resolved:    a.isResolved === true,
    _source: 'v4',
  };
}

function normalizeV3Alert(a) {
  const r = a.status?.resources || {};
  return {
    severity:    String(r.severity || '').toUpperCase(),
    message:     r.default_message || r.alert_title || 'Alert',
    clusterUuid: r.cluster_reference?.uuid || r.cluster_uuid || null,
    resolved:    r.resolved === true,
    _source: 'v3',
  };
}

/**
 * Alertes non résolues, tous clusters confondus. v4 `monitoring` d'abord, repli
 * v3. Le filtrage par cluster reste à la charge de l'appelant : `clusterExtId`
 * n'est pas indexé partout et un filtre côté serveur y perd des alertes.
 */
async function fetchOpenAlerts(client) {
  return firstOf(client, 'pc.alerts', async (ep, api) => {
    if (api === 'prism.v4') {
      const rows = await pageAll(client, await compat.urlFor(client, ep), {
        params: { $filter: 'isResolved eq false' },
        pageSize: 100,
        maxPages: 10,
      });
      return rows.length ? rows.map(normalizeV4Alert) : undefined;
    }
    const resp = await client.post(await compat.urlFor(client, ep, '/list'), {
      kind: 'alert', length: 1000, filter: 'resolved==false',
    });
    return (resp?.data?.entities || []).map(normalizeV3Alert);
  });
}


module.exports = {
  DEFAULT_VERSIONS: compat.DEFAULT_V4_VERSIONS,
  resolveV4Version: compat.resolveV4Version,
  pageAll,
  listAll,
  fetchClusters,
  fetchAhvClusters,
  fetchPcCluster,
  fetchUsers,
  fetchOpenAlerts,
  versionsFromClusters,
  normalizeV4Cluster,
  normalizeV3Cluster,
  _resetV4Cache: compat._resetV4Cache,
};
