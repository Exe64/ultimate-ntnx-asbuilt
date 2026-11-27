// Projection d'un snapshot d'audit vers un bundle d'as-built (cf. docs/ASBUILT.md §3, §8).
//
// Deux responsabilités, toutes deux pures et donc testables sans base ni cluster :
//
//   1. NE GARDER QUE CE QUE LE DOCUMENT DEMANDE. Un snapshot d'audit contient tout ce que le
//      cluster sait dire — alertes, événements, vdisks, politiques de microsegmentation. Le
//      document n'en veut qu'une fraction. Projeter ici, côté serveur, c'est ce qui permet de
//      générer un as-built sans la capacité `audit:secrets` : le navigateur ne reçoit jamais le
//      snapshot brut, seulement les clés déclarées ci-dessous.
//
//   2. RATTACHER LES ENTITÉS DU PC À LEUR CLUSTER. Les collecteurs v4 interrogent le Prism
//      Central, qui répond à plat pour tout le parc. Le document, lui, est organisé cluster par
//      cluster.
//
// Les clés listées ici doivent rester alignées sur les chaînes de résolution du catalogue
// (frontend/src/asbuilt/sections.js §4 de la spec) : une clé oubliée ici, et la section
// correspondante se retrouve `non collecté` alors que la donnée était disponible.

// Clés lues sur un snapshot de Prism Central.
const PC_KEYS = [
  'v4_clusters', 'v4_hosts', 'v4_storage_containers', 'v4_disks', 'v4_subnets',
  'v4_virtual_switches', 'v4_vms', 'v4_snmp', 'v4_users', 'v4_roles',
  'v4_directory_services', 'v4_protection_policies', 'v4_recovery_points',
  'v4_license_keys', 'v4_categories', 'v4_lcm_entities', 'v4_domain_managers',
  'v4_rsyslog', 'v4_ssl_certificates', 'v4_images', 'v4_network_security_policies', 'v4_vpcs',
  'v4_file_servers', 'v4_object_stores', 'v4_volume_groups',
  'v4_host_nics', 'v4_cvms', 'v4_license_entitlements', 'v4_license_compliances', 'v4_recovery_plans',
  'v4_key_management_servers', 'v4_saml_identity_providers', 'v4_alert_email_config',
  'pc_clusters_v3',   // repli quand clustermgmt v4 n'est pas exposé
];

// Clés lues sur un snapshot de Prism Element. Ce que v4 n'expose pas au niveau PC : HA, nom et seuil
// ILM des pools de stockage, protection domains hérités. Le reste n'y sert plus que de secours quand
// la v4 n'a pas répondu (cf. plan #17).
const PE_KEYS = [
  'cluster_v2', 'hosts_v2', 'host_nics_v2', 'storage_containers_v2', 'storage_pools_v2', 'disks_v2',
  'vms_v2', 'networks_v2', 'ha_v2', 'protection_domains_v2', 'pd_status_v2',
  'remote_sites_v2', 'license_v1', 'license_allowances_v1', 'authconfig_v1',
  'auth_types_v1', 'auth_directories_v1', 'snmp_v1', 'alerts_config_v1', 'pulse_v1',
  'cluster_params_v1',
];

// Où lire la référence de cluster, clé par clé. Les noms de champs diffèrent d'un namespace v4
// à l'autre (et d'une version à l'autre) : on essaie les alias connus dans l'ordre. Une clé
// absente de cette table reste au niveau PC — c'est le cas des utilisateurs, des rôles ou des
// catégories, qui n'appartiennent à aucun cluster.
const CLUSTER_REF_PATHS = {
  v4_hosts: ['cluster.extId', 'clusterExtId', 'cluster.uuid'],
  v4_storage_containers: ['clusterExtId', 'cluster.extId'],
  v4_disks: ['clusterExtId', 'cluster.extId'],
  v4_subnets: ['clusterReference', 'clusterExtId', 'cluster.extId'],
  v4_vms: ['cluster.extId', 'clusterExtId'],
  // Un virtual switch peut couvrir plusieurs clusters : `clusters[].extId`, lu par clusterRefsOf.
  v4_virtual_switches: ['clusterExtId', 'cluster.extId'],
  v4_lcm_entities: ['clusterExtId', 'cluster.extId'],
  v4_snmp: ['clusterExtId'],
  v4_rsyslog: ['clusterExtId'],
  v4_ssl_certificates: ['clusterExtId'],
  v4_host_nics: ['clusterExtId'],
  v4_cvms: ['clusterExtId'],
  // Licences : chaque entrée EST un cluster (son extId), le PC compris.
  v4_license_entitlements: ['extId'],
  v4_license_compliances: ['extId'],
};

const getPath = (obj, path) =>
  path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/** Les collecteurs renvoient tantôt {entities}, tantôt {data}, tantôt un tableau nu. */
function asList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.entities)) return raw.entities;
  if (Array.isArray(raw.data)) return raw.data;
  return [];
}

function clusterRefOf(entity, key) {
  for (const p of CLUSTER_REF_PATHS[key] || []) {
    const v = getPath(entity, p);
    if (typeof v === 'string' && v) return v;
    if (v && typeof v === 'object' && typeof v.extId === 'string') return v.extId;
  }
  return null;
}

/** Tous les clusters auxquels une entité se rattache — un seul, sauf pour un virtual switch. */
function clusterRefsOf(entity, key) {
  const many = Array.isArray(entity.clusters) ? entity.clusters.map(c => c?.extId).filter(Boolean) : [];
  if (many.length) return many;
  const one = clusterRefOf(entity, key);
  return one ? [one] : [];
}

/** Ne retient d'un snapshot que les clés demandées. Une clé absente reste absente. */
function pickKeys(snapshot, keys) {
  const out = {};
  for (const k of keys) if (snapshot && snapshot[k] !== undefined) out[k] = snapshot[k];
  return out;
}

const projectPcSnapshot = (snapshot) => pickKeys(snapshot, PC_KEYS);
const projectPeSnapshot = (snapshot) => pickKeys(snapshot, PE_KEYS);

/**
 * Répartit les entités d'un snapshot PC entre les clusters.
 *
 * Renvoie `{ byCluster, unattributed }` :
 *   byCluster     { [extId]: { v4_clusters: {data:[…]}, v4_hosts: {data:[…]}, … } }
 *   unattributed  clés dont les entités ne portaient aucune référence de cluster exploitable.
 *
 * Cas particulier assumé : si une clé ne porte aucune référence ET qu'il n'y a qu'un seul
 * cluster, tout lui revient — c'est vrai par construction. À partir de deux clusters, on
 * préfère ne rien attribuer et le dire (la clé remonte dans `unattributed`, et le journal de
 * collecte l'affiche) plutôt que de prêter à un cluster les disques d'un autre.
 */
function partitionPcData(pcData, clusterIds) {
  const byCluster = Object.fromEntries(clusterIds.map(id => [id, {}]));
  const unattributed = [];
  const known = new Set(clusterIds);

  for (const [key, raw] of Object.entries(pcData || {})) {
    const entities = asList(raw);
    if (!entities.length) continue;

    if (key === 'v4_clusters') {
      for (const c of entities) {
        if (known.has(c.extId)) byCluster[c.extId].v4_clusters = { data: [c] };
      }
      continue;
    }
    if (!CLUSTER_REF_PATHS[key]) continue;  // donnée de niveau PC : rien à répartir

    const buckets = {};
    let attributed = 0;
    for (const e of entities) {
      for (const ref of clusterRefsOf(e, key)) {
        if (known.has(ref)) { (buckets[ref] ||= []).push(e); attributed += 1; }
      }
    }

    if (!attributed) {
      if (clusterIds.length === 1) byCluster[clusterIds[0]][key] = { data: entities };
      else unattributed.push(key);
      continue;
    }
    for (const [id, list] of Object.entries(buckets)) byCluster[id][key] = { data: list };
  }

  return { byCluster, unattributed };
}

module.exports = {
  PC_KEYS, PE_KEYS, CLUSTER_REF_PATHS,
  asList, pickKeys, projectPcSnapshot, projectPeSnapshot, partitionPcData,
};
