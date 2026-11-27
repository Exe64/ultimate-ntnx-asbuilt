// Collecte d'un as-built sans base ni projet : un Prism Central, ses clusters, et pour chacun
// son Prism Element. Produit le bundle que consomme engine/asbuilt/asBuiltModel.js, sans
// snapshots d'audit.
import axios from 'axios';
import https from 'node:https';
import { collectPc, collectPe, isPrismCentral, mapLimit, HOST_CONCURRENCY } from './prism/collect.js';
import { partitionPcData, asList } from './prism/projection.js';
import { fetchAhvClusters, listAll } from './nutanixV4.js';

// Délai par appel : 60 s conviennent à un parc courant ; un Prism lent ou lointain se règle sans recompiler.
export const TIMEOUT_MS = (Number(process.env.ASBUILT_TIMEOUT_S) > 0 ? Number(process.env.ASBUILT_TIMEOUT_S) : 60) * 1000;

function prismClient(host, user, pass, ignoreSSL) {
  const h = String(host).trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return axios.create({
    baseURL: `https://${/:\d+$/.test(h) ? h : `${h}:9440`}`,
    timeout: TIMEOUT_MS,
    httpsAgent: new https.Agent({ rejectUnauthorized: !ignoreSSL }),
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,
    },
  });
}

const liveSource = (target, out) => ({
  kind: 'live', collectedAt: new Date().toISOString(), target,
  collectors: out.collectors,
  errors: out.errors.map(e => ({ key: e.key, error: e.status ? `${e.status} ${e.message}` : e.message })),
});
const absentSource = (target, reason) => ({ kind: 'absent', collectedAt: null, target, reason });

const extIpOf = (c) => c.network?.externalAddress?.ipv4?.value || c.network?.externalAddress?.fqdn?.value || null;

/** Étape 1 : le Prism Central, et les clusters qu'il déclare — chacun avec l'adresse de son Prism Element. */
export async function collectPcBundle({ pcHost, pcUser, pcPass, ignoreSSL = true }) {
  if (!pcHost || !pcUser || !pcPass) throw new Error('Adresse, utilisateur et mot de passe du Prism Central requis');
  const pc = prismClient(pcHost, pcUser, pcPass, ignoreSSL);
  const out = await collectPc(pc);
  // Aucun collecteur n'a répondu : ce n'est pas un document maigre, c'est une connexion ratée
  // (adresse, identifiants, certificat) — on le dit au lieu de générer un document vide.
  if (!out.collectors.ok) throw new Error(`Prism Central ${failure(out)}`);

  // Ports physiques en v4, hôte par hôte : vitesse négociée (`linkSpeedInKbps`), capacité, état et
  // description du contrôleur. Un hôte v4 désigne son cluster par `cluster.uuid` sur pc.7.6, pas par
  // `cluster.extId` : sans ce repli, aucun hôte ne passait le filtre et la v4 n'était jamais lue.
  const clusterOfHost = (h) => h.cluster?.extId || h.clusterExtId || h.cluster?.uuid;
  const hosts = asList(out.data.v4_hosts).filter(h => h.extId && clusterOfHost(h));
  if (hosts.length) {
    out.collectors.total += 1;
    let lastError = null;
    const nics = (await mapLimit(hosts, HOST_CONCURRENCY, async (h) => {
      try {
        const list = await listAll(pc, 'prism.v4/clustermgmt', { suffix: `/config/clusters/${clusterOfHost(h)}/hosts/${h.extId}/host-nics` });
        return list.map(n => ({ ...n, _host_uuid: h.extId, _host_name: h.hostName || h.name, clusterExtId: clusterOfHost(h) }));
      } catch (err) { lastError = err; return []; }
    })).flat();
    if (nics.length) { out.data.v4_host_nics = { data: nics }; out.collectors.ok += 1; }
    else out.errors.push({ key: 'v4_host_nics', status: lastError?.response?.status ?? null, message: lastError?.message || 'aucun port remonté' });
  }

  let ahv = asList(out.data.v4_clusters)
    .filter(c => c.extId && !isPrismCentral(c))
    .map(c => ({ extId: c.extId, name: c.name, externalIp: extIpOf(c) }));
  if (!ahv.length) {
    try { ahv = (await fetchAhvClusters(pc)).map(c => ({ extId: c.extId, name: c.name, externalIp: c.externalIp })); }
    catch { /* PC sans clustermgmt v4 ni v3 lisible : document limité au niveau PC */ }
  }

  const { byCluster, unattributed } = partitionPcData(out.data, ahv.map(c => c.extId));
  return {
    meta: { generatedAt: new Date().toISOString() },
    pc: { host: pcHost, source: { ...liveSource(pcHost, out), ...(unattributed.length ? { unattributed } : {}) }, data: out.data },
    clusters: ahv.map((c, i) => ({
      extId: c.extId, name: c.name, address: c.externalIp, planRef: i,
      source: absentSource(c.name, c.externalIp ? 'identifiants Prism Element non fournis' : 'adresse du Prism Element inconnue'),
      pcData: byCluster[c.extId] || {}, data: byCluster[c.extId] || {},
    })),
  };
}

const failure = (out) => {
  const e = out.errors[0] || {};
  return `injoignable ou refusé${e.status ? ` (HTTP ${e.status})` : ''} : ${e.message || 'aucune réponse'}`;
};

/**
 * Étape 2 : les Prism Element, chacun avec SES identifiants. Complète le bundle en place et rend,
 * par cluster tenté, `null` ou l'erreur — un PE refusé n'empêche pas les autres, et se retente.
 */
export async function collectPes(bundle, creds, ignoreSSL = true) {
  const results = await Promise.all(creds.map(async ({ extId, host, user, pass }) => {
    const c = bundle.clusters.find(x => x.extId === extId);
    if (c && host) c.address = host;
    if (!c || !c.address || !user || !pass) return [extId, 'adresse ou identifiants manquants'];
    try {
      const out = await collectPe(prismClient(c.address, user, pass, ignoreSSL));
      if (!out.collectors.ok) throw new Error(failure(out));
      c.data = { ...c.pcData, ...out.data };
      c.source = liveSource(c.name, out);
      return [extId, null];
    } catch (err) {
      c.data = c.pcData;
      c.source = absentSource(c.name, err.message);
      return [extId, err.message];
    }
  }));
  return Object.fromEntries(results);
}
