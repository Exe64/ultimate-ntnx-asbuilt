// Collecte directe pour l'as-built, quand aucun snapshot d'audit récent n'est disponible
// (cf. docs/ASBUILT.md §3.1, niveau 2).
//
// Parti pris qui vaut d'être dit : cette collecte remplit **les mêmes clés que le snapshot
// d'audit** (`cluster_v2`, `hosts_v2`, `v4_clusters`…). Le modèle du document n'a donc qu'une
// seule forme à connaître, et rien à réinventer selon la provenance. Le prix est une table de
// correspondance endpoint → clé, tenue ici, en regard de celle du worker
// (services/audit-worker/ntnx_audit/collectors.py).
//
// Chaque appel est isolé : un endpoint absent sur cette version d'AOS, ou refusé, laisse sa clé
// vide et s'inscrit dans les erreurs de collecte. Le document se génère quand même, et dit ce
// qui manque — l'inverse d'un export qui échoue en bloc parce qu'un cluster ne sait pas répondre
// sur /snmp.

const { X509Certificate } = require('node:crypto');
const { listAll } = require('../nutanixV4');
const compat = require('../apiCompat');

// ─── Prism Central (v4) ───────────────────────────────────────────────────────
// [clé, namespace, chemin] — l'ordre n'a pas d'importance, les appels sont concurrents.
// Chemins résolus par apiCompat (capacité générique `prism.v4/<namespace>`).
const PC_ENDPOINTS = [
  ['v4_clusters',            'clustermgmt',    '/config/clusters'],
  ['v4_hosts',               'clustermgmt',    '/config/hosts'],
  ['v4_storage_containers',  'clustermgmt',    '/config/storage-containers'],
  ['v4_disks',               'clustermgmt',    '/config/disks'],
  ['v4_subnets',             'networking',     '/config/subnets'],
  ['v4_virtual_switches',    'networking',     '/config/virtual-switches'],
  ['v4_vms',                 'vmm',            '/ahv/config/vms'],
  ['v4_users',               'iam',            '/authn/users'],
  ['v4_roles',               'iam',            '/authz/roles'],
  ['v4_directory_services',  'iam',            '/authn/directory-services'],
  ['v4_protection_policies', 'datapolicies',   '/config/protection-policies'],
  ['v4_license_keys',        'licensing',      '/config/license-keys'],
  ['v4_categories',          'prism',          '/config/categories'],
  ['v4_lcm_entities',        'lifecycle',      '/resources/entities'],
  // Images et services : chemins relevés dans la spec officielle v4.0 de chaque namespace. Un
  // service optionnel non déployé (Flow, Files, Objects) ne sert pas son namespace : 404, ou 503 de la
  // passerelle qui ne trouve pas le service derrière (vu sur le lab), valent « aucun ».
  // vmm et volumes sont toujours servis : un 404 y reste une erreur, il trahirait un chemin faux.
  ['v4_images',              'vmm',            '/content/images'],
  // Flow Network Security non activé : `microseg` répond 403, même à un admin (vu sur le lab).
  // ponytail: un compte sans droit sur Flow activé passerait aussi pour « aucun » ; le distinguer
  // demanderait de lire l'état d'activation de Flow.
  ['v4_network_security_policies', 'microseg', '/config/policies',           { absentOk: true, absentStatus: [403] }],
  ['v4_vpcs',                'networking',     '/config/vpcs',               { absentOk: true }],
  ['v4_file_servers',        'files',          '/config/file-servers',       { absentOk: true }],
  ['v4_object_stores',       'objects',        '/config/object-stores',      { absentOk: true }],
  ['v4_volume_groups',       'volumes',        '/config/volume-groups'],
  // Ce qui demandait jusqu'ici les identifiants du Prism Element. Le PC sert aussi ces chemins sous
  // le préfixe v4.0 (vérifié sur pc.7.6) : la mineure par défaut d'apiCompat suffit.
  // Licences : une entrée par cluster, d'extId celui du cluster.
  ['v4_license_entitlements', 'licensing',     '/config/entitlements'],
  ['v4_license_compliances', 'licensing',      '/config/compliances'],
  ['v4_recovery_plans',      'datapolicies',   '/config/recovery-plans'],
  ['v4_key_management_servers', 'security',    '/config/key-management-servers'],
  ['v4_saml_identity_providers', 'iam',        '/authn/saml-identity-providers'],
  // La configuration e-mail des alertes est celle du PC, et un objet, pas une liste : pas de pagination.
  ['v4_alert_email_config',  'monitoring',     '/serviceability/alerts/email-config', { single: true }],
  // Plan #18 — servis sous le préfixe v4.0 par pc.7.6.0.10 (dépôt NutanixAPISwaggers, checks/).
  ['v4_uplink_bonds',        'networking',     '/config/uplink-bonds'],
  ['v4_vm_host_affinity_policies', 'vmm',      '/ahv/policies/vm-host-affinity-policies'],
  ['v4_vm_anti_affinity_policies', 'vmm',      '/ahv/policies/vm-anti-affinity-policies'],
  ['v4_legacy_vm_anti_affinity_policies', 'vmm', '/ahv/policies/legacy-vm-anti-affinity-policies'],
  // Politiques de démarrage : pc.7.5 et plus ; un PC antérieur répond 404, qui vaut « aucune ».
  ['v4_vm_startup_policies', 'vmm',            '/ahv/policies/vm-startup-policies', { absentOk: true }],
  // Politiques d'autorisation : ce qu'un as-built en dit (nom, rôle, identités, périmètre), pas plus —
  // le reste est volumineux et inutile au document.
  ['v4_authz_policies',      'iam',            '/authz/authorization-policies', { pick: ['extId', 'displayName', 'description', 'role', 'identities', 'entities', 'isSystemDefined', 'assignedUsersCount', 'assignedUserGroupsCount'] }],
  ['v4_user_groups',         'iam',            '/authn/user-groups'],
  ['v4_lcm_config',          'lifecycle',      '/resources/config', { single: true }],
  // Plan #19 — sections de contexte. Champs choisis (`pick`) : plusieurs objets portent des secrets que
  // `scrub` ne reconnaît pas toujours (IPsec d'un VPN), ou des textes volumineux (correctifs STIG).
  ['v4_storage_policies',    'datapolicies',   '/config/storage-policies', { absentOk: true, pick: ['name', 'categoryExtIds', 'compressionSpec', 'encryptionSpec', 'qosSpec', 'faultToleranceSpec', 'policyType'] }],
  ['v4_alert_user_policies', 'monitoring',     '/serviceability/alerts/user-defined-policies', { pick: ['title', 'description', 'isEnabled', 'isAutoResolved', 'entityType', 'impactTypes'] }],
  ['v4_stigs',               'security',       '/report/stigs', { absentOk: true, pick: ['title', 'ruleId', 'severity', 'status', 'affectedClusters'] }],
  ['v4_security_summaries',  'security',       '/report/security-summaries', { absentOk: true, pick: ['clusterExtId', 'stigSummary', 'passwordSummary', 'lastRefreshTime'] }],
  ['v4_security_profiles',   'security',       '/config/security-profiles', { absentOk: true, pick: ['clusterExtId', 'type'] }],
  ['v4_templates',           'vmm',            '/content/templates', { pick: ['templateName', 'templateDescription', 'createTime'] }],
  ['v4_guest_profiles',      'vmm',            '/ahv/config/vm-guest-customization-profiles', { absentOk: true, pick: ['name', 'description'] }],
  ['v4_image_placement_policies', 'vmm',       '/images/config/placement-policies', { pick: ['name', 'description', 'placementType', 'enforcementState'] }],
  ['v4_iscsi_clients',       'volumes',        '/config/iscsi-clients', { pick: ['iscsiInitiatorName', 'enabledAuthentications', 'numVirtualTargets', 'clusterReference', 'attachmentSite'] }],
];

// Flow Virtual Networking (plan #19) : interrogé seulement quand le PC déclare des VPC. Les tables de
// routage ne sont pas lues : leurs routes demandent un appel par table, pour peu d'information.
const FVN_ENDPOINTS = [
  ['v4_gateways',            'networking',     '/config/gateways', { pick: ['name', 'vpcReference', 'isActive', 'status', 'installedSoftwareVersion', 'gatewayDeviceVendor'] }],
  ['v4_vpn_connections',     'networking',     '/config/vpn-connections', { pick: ['name', 'localGatewayReference', 'remoteGatewayReference', 'localGatewayRole', 'ipsecTunnelStatus', 'ebgpStatus'] }],
  ['v4_bgp_sessions',        'networking',     '/config/bgp-sessions', { pick: ['name', 'localGatewayReference', 'remoteGatewayReference', 'status', 'dynamicRoutePriority'] }],
  ['v4_floating_ips',        'networking',     '/config/floating-ips', { pick: ['name', 'floatingIp', 'privateIp', 'vpcReference', 'associationStatus'] }],
  ['v4_layer2_stretches',    'networking',     '/config/layer2-stretches', { pick: ['name', 'connectionType', 'stretchStatus', 'mtu', 'vni'] }],
];

// ─── Prism Element (v2 / v1) ──────────────────────────────────────────────────
// [clé, famille, chemin, { list }] — `list` marque les endpoints qui répondent {entities:[…]}.
// Préfixes versionnés résolus par apiCompat.
const PE_ENDPOINTS = [
  ['cluster_v2',             'prism.v2', '/cluster/'],
  ['hosts_v2',               'prism.v2', '/hosts/',               { list: true }],
  ['storage_containers_v2',  'prism.v2', '/storage_containers/',  { list: true }],
  // Les storage pools n'existent qu'en v1 ; la clé garde son nom, celui du snapshot d'audit.
  ['storage_pools_v2',       'prism.v1', '/storage_pools',        { list: true }],
  ['disks_v2',               'prism.v2', '/disks/',               { list: true }],
  ['vms_v2',                 'prism.v2', '/vms/',                 { list: true, params: { include_vm_nic_config: true } }],
  ['networks_v2',            'prism.v2', '/networks/',            { list: true }],
  ['ha_v2',                  'prism.v2', '/ha/'],
  ['protection_domains_v2',  'prism.v2', '/protection_domains/',  { list: true }],
  ['remote_sites_v2',        'prism.v2', '/remote_sites/',        { list: true }],
  ['license_v1',             'prism.v1', '/license'],
  ['auth_types_v1',          'prism.v1', '/authconfig/auth_types'],
  ['auth_directories_v1',    'prism.v1', '/authconfig/directories'],
  ['snmp_v1',                'prism.v1', '/snmp'],
  ['alerts_config_v1',       'prism.v1', '/alerts/configuration'],
  ['pulse_v1',               'prism.v1', '/pulse'],
  // vCPU des CVM : ni la v2 (/vms exclut les CVM) ni la v4 (`numVcpus` vaut 1 pour 4 vCPU sur
  // pc.7.6) ne le donnent juste ; la v1 filtrée sur les CVM, oui.
  ['cvms_v1',                'prism.v1', '/vms',                  { list: true, params: { filterCriteria: 'is_cvm==1' } }],
  // Plan #19 — formes relevées dans les déclarations Swagger 1.2 d'AOS 7.6.0.6 (dépôt NutanixAPISwaggers).
  // `pick` ne garde que ce que le document dit : le Witness porte `username`/`password`, le tunnel de
  // support un proxy (identifiants possibles), une VM des dizaines de champs.
  ['dare_v1',                'prism.v1', '/data_at_rest_encryption', { pick: (d) => ({
    softwareEncryptionScope: d?.softwareEncryptionScope ?? null, desiredPasswordProtection: d?.desiredPasswordProtection ?? null,
    PCKeyManagerStatus: d?.PCKeyManagerStatus ?? null, storageContainerEncryptionStatus: d?.storageContainerEncryptionStatus ?? null,
    diskEncryptionStatus: d?.diskEncryptionStatus ?? null }) }],
  ['metro_witness_v1',       'prism.v1', '/cluster/metro_witness', { pick: (d) => ({ entities: (Array.isArray(d) ? d : d?.entities || []).map(w => ({
    witnessName: w.witnessName, clusterName: w.clusterName, ipAddresses: w.ipAddresses, nosFullVersion: w.nosFullVersion || w.nosVersion, markedForRemoval: w.markedForRemoval })) }) }],
  ['remote_support_v1',      'prism.v1', '/cluster/remote_support', { pick: (d) => ({
    enabled: d?.enable?.enabled ?? null, duration: d?.enable?.duration ?? null, connectionStatus: d?.tunnelDetails?.connectionStatus?.status ?? d?.tunnelDetails?.connectionStatus ?? null }) }],
  ['unprotected_vms_v1',     'prism.v1', '/protection_domains/unprotected_vms', { pick: (d) => ({ entities: (Array.isArray(d) ? d : d?.entities || []).map(v => ({
    vmName: v.vmName, hostName: v.hostName, powerState: v.powerState })) }) }],
];

const errorOf = (err) => ({
  status: err.response?.status ?? null,
  message: (err.response?.data?.message || err.message || String(err)).slice(0, 200),
});

// Un appel par hôte, sur un parc de plusieurs centaines d'hôtes, ne part pas d'un bloc : Prism
// refuse (429) ou s'étouffe. Huit à la fois tient le débit sans le saturer.
const HOST_CONCURRENCY = 8;

/**
 * Un seul appel avant les autres : avec un mot de passe faux, chaque appel parallèle compte comme
 * un échec de connexion, et Prism verrouille le compte au bout de quelques-uns. Sur 401/403, on
 * s'arrête là ; toute autre réponse (404 d'un endpoint absent, délai) laisse la collecte se faire.
 */
async function checkAuth(client, path) {
  try { await client.get(path); }
  catch (err) {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      throw Object.assign(new Error(`identifiants refusés (HTTP ${status}), aucune autre requête envoyée`), { status });
    }
  }
}

/** `Promise.all(items.map(fn))`, mais avec au plus `limit` appels en vol. L'ordre est conservé. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Exécute des appels indépendants, garde ce qui a répondu, consigne le reste. */
async function gather(tasks) {
  const data = {};
  const errors = [];
  const results = await Promise.all(tasks.map(async ({ key, run }) => {
    try { return { key, value: await run() }; }
    catch (err) { return { key, error: errorOf(err) }; }
  }));
  for (const r of results) {
    if (r.error) errors.push({ key: r.key, ...r.error });
    else if (r.value !== undefined && r.value !== null) data[r.key] = r.value;
  }
  return { data, errors, collectors: { ok: Object.keys(data).length, total: tasks.length } };
}

/** Une tâche de collecte PC v4 : liste paginée, objet seul (`single`), champs choisis (`pick`). */
const pcTask = (client) => ([key, ns, path, opts = {}]) => ({
  key,
  run: async () => {
    try {
      if (opts.single) {
        const r = await client.get(await compat.url(client, `prism.v4/${ns}`, path, { api: 'prism.v4' }));
        return { data: r.data?.data ? [r.data.data] : [] };
      }
      const list = await listAll(client, `prism.v4/${ns}`, { suffix: path, pageSize: 100 });
      return { data: opts.pick ? list.map(x => Object.fromEntries(opts.pick.filter(k => x[k] !== undefined).map(k => [k, x[k]]))) : list };
    }
    // ponytail: un service déployé mais tombé répond aussi 503 et passerait pour « aucun » ; le
    // distinguer demanderait d'interroger le gestionnaire du service.
    catch (err) {
      if (opts.absentOk && [404, 503, ...(opts.absentStatus || [])].includes(err.response?.status)) return { data: [] };
      throw err;
    }
  },
});

/**
 * Collecte Prism Central. `client` est le client axios du PC (buildClient).
 * Les hôtes sont relus cluster par cluster quand la liste à plat ne porte pas de référence de
 * cluster : `/config/clusters/{extId}/hosts` est le chemin vérifié en production (routes/clusters.js),
 * et il rend l'attribution certaine au lieu de la déduire.
 */
async function collectPc(client) {
  // Avant toute sonde `unversioned/info` d'apiCompat : elles aussi s'authentifient.
  await checkAuth(client, '/api/nutanix/v3/users/me');
  const out = await gather(PC_ENDPOINTS.map(pcTask(client)));

  // Flow Virtual Networking : une seconde vague, seulement quand des VPC existent.
  if ((out.data.v4_vpcs?.data || []).length) {
    const fvn = await gather(FVN_ENDPOINTS.map(pcTask(client)));
    Object.assign(out.data, fvn.data);
    out.errors.push(...fvn.errors);
    out.collectors.ok += fvn.collectors.ok; out.collectors.total += fvn.collectors.total;
  } else if (out.data.v4_vpcs) {
    // VPC lus et aucun : FVN n'est pas configuré, ce n'est pas une donnée manquante.
    for (const [key] of FVN_ENDPOINTS) out.data[key] = { data: [] };
  }

  const clusters = (out.data.v4_clusters?.data || []).filter(c => c.extId && !isPrismCentral(c));
  const hostsFlat = out.data.v4_hosts?.data || [];
  const needsPerCluster = clusters.length > 1
    && !hostsFlat.some(h => h.cluster?.extId || h.clusterExtId);

  if (needsPerCluster) {
    const perCluster = await Promise.all(clusters.map(async (c) => {
      try {
        const r = await client.get(await compat.url(client, 'pc.clusters', `/${c.extId}/hosts`, { api: 'prism.v4' }), { params: { $limit: 100 } });
        return (r.data?.data || []).map(h => ({ ...h, clusterExtId: c.extId }));
      } catch { return []; }
    }));
    const merged = perCluster.flat();
    if (merged.length) out.data.v4_hosts = { data: merged };
  }

  // Le Prism Central lui-même : taille, ressources, réseau. `/config/domain-managers` ne prend pas
  // de pagination, et sa config porte des identifiants (`credentials`) et un cloud-init : on ne
  // garde ni l'un ni l'autre, le bundle s'exporte et se dumpe.
  out.collectors.total += 1;
  try {
    const r = await client.get(await compat.url(client, 'prism.v4/prism', '/config/domain-managers', { api: 'prism.v4' }));
    out.data.v4_domain_managers = { data: (r.data?.data || []).map(({ config: { credentials, bootstrapConfig, ...config } = {}, ...dm }) => ({ ...dm, config })) };
    out.collectors.ok += 1;
  } catch (err) { out.errors.push({ key: 'v4_domain_managers', ...errorOf(err) }); }

  // Cibles de sauvegarde du PC (plan #18) : une liste par domain-manager.
  const dms = (out.data.v4_domain_managers?.data || []).filter(dm => dm.extId);
  if (dms.length) {
    out.collectors.total += 1;
    try {
      const lists = await Promise.all(dms.map(dm => listAll(client, 'prism.v4/prism', { suffix: `/management/domain-managers/${dm.extId}/backup-targets` })
        .then(l => l.map(t => ({ ...t, domainManagerExtId: dm.extId })))));
      out.data.v4_pc_backup_targets = { data: lists.flat() };
      out.collectors.ok += 1;
    } catch (err) { out.errors.push({ key: 'v4_pc_backup_targets', ...errorOf(err) }); }
  }

  // SNMP, syslog et certificat n'ont pas de liste à plat : ils se lisent cluster par cluster.
  // SNMP : les utilisateurs seuls, jamais leurs clés d'authentification ni de chiffrement.
  await perCluster(client, out, clusters, 'v4_snmp', '/snmp',
    (d) => (d?.users || []).map(u => ({ username: u.username, authType: u.authType, privType: u.privType })));
  // Destinations des traps (plan #18), jamais leur chaîne de communauté ni leur engine ID : `scrub` ne
  // reconnaît pas `communityString`. Second appel au même chemin, pour garder `v4_snmp` = utilisateurs.
  // ponytail: un GET /snmp de plus par cluster ; à fusionner si un parc de centaines de clusters le sent.
  await perCluster(client, out, clusters, 'v4_snmp_traps', '/snmp', (d) => [
    ...(d?.traps || []).map(t => ({ kind: 'trap', address: t.address, port: t.port, protocol: t.protocol, version: t.version, username: t.username, receiver: t.recieverName, inform: t.shouldInform })),
    ...(d?.transports || []).map(t => ({ kind: 'transport', protocol: t.protocol, port: t.port })),
  ]);
  await perCluster(client, out, clusters, 'v4_rsyslog', '/rsyslog-servers', (d) => d || []);
  // Certificat SSL (clustermgmt v4.2+) : la réponse porte la clé privée ; on n'en garde que ce
  // qu'on lit dans le certificat public.
  await perCluster(client, out, clusters, 'v4_ssl_certificates', '/ssl-certificate', (d) => (d ? [certInfo(d)] : []));
  // Dimensionnement des CVM (mémoire ; le nombre de vCPU reste à confronter au Prism Element).
  await perCluster(client, out, clusters, 'v4_cvms', '/cvms', (d) => d || []);
  // Plan #18 : blocs, segmentation réseau et configuration de stockage (ces deux dernières : pc.7.6).
  await perCluster(client, out, clusters, 'v4_rackable_units', '/rackable-units', (d) => d || []);
  await perCluster(client, out, clusters, 'v4_network_segments', '/network-segments', (d) => d || []);
  await perCluster(client, out, clusters, 'v4_storage_config', '/storage-config', (d) => (d ? [d] : []));
  out.data = scrub(out.data);
  return out;
}

/**
 * Une lecture par cluster, chaque entité rattachée à son cluster. La clé n'est en erreur que si
 * aucun cluster n'a répondu ; lue mais vide, elle reste présente (« Non configuré »).
 */
async function perCluster(client, out, clusters, key, suffix, pick) {
  if (!clusters.length) return;
  out.collectors.total += 1;
  let lastError = null;
  const found = (await Promise.all(clusters.map(async (c) => {
    try {
      const r = await client.get(await compat.url(client, 'pc.clusters', `/${c.extId}${suffix}`, { api: 'prism.v4' }));
      return pick(r.data?.data).map(x => ({ ...x, clusterExtId: c.extId }));
    } catch (err) { lastError = err; return null; }
  }))).filter(Boolean);
  if (found.length) { out.data[key] = { data: found.flat() }; out.collectors.ok += 1; }
  else out.errors.push({ key, ...errorOf(lastError) });
}

const day = (d) => (Number.isNaN(Date.parse(d)) ? null : new Date(d).toISOString().slice(0, 10));

/** Ce qu'un as-built dit d'un certificat : à qui, par qui, jusqu'à quand. Jamais la clé privée. */
function certInfo(c) {
  let x = null;
  try { x = new X509Certificate(c.publicCertificate); } catch { /* PEM absent ou illisible */ }
  const dn = (s) => (s ? s.split('\n').filter(Boolean).join(', ') : null);
  return {
    subject: dn(x?.subject), issuer: dn(x?.issuer),
    validFrom: x ? day(x.validFrom) : null, validTo: x ? day(x.validTo) : null,
    keyAlgorithm: c.privateKeyAlgorithm || null,
  };
}

// Défense en profondeur : aucun secret dans un bundle qui s'exporte et se dumpe, quel que soit
// l'endpoint (mot de passe d'un proxy, secret CHAP d'un volume group…). Seules les chaînes sont
// retirées : un drapeau comme `isPasswordRemoteLoginEnabled` reste.
const SECRET_KEY = /password|passphrase|secret|privatekey/i;
function scrub(v) {
  if (Array.isArray(v)) return v.map(scrub);
  if (!v || typeof v !== 'object') return v;
  return Object.fromEntries(Object.entries(v)
    .filter(([k, x]) => !(SECRET_KEY.test(k) && typeof x === 'string'))
    .map(([k, x]) => [k, scrub(x)]));
}

const isPrismCentral = (c) => {
  const fns = c.config?.clusterFunction || c.config?.clusterFunctions || [];
  return (Array.isArray(fns) ? fns : [fns]).some(x => String(x).toUpperCase().includes('PRISM_CENTRAL'));
};

/** Collecte Prism Element. `peClient` vient de buildPeClient (creds par cluster, PE, ou PC). */
async function collectPe(peClient) {
  await checkAuth(peClient, '/PrismGateway/services/rest/v2.0/cluster/');
  const out = await gather(PE_ENDPOINTS.map(([key, api, path, opts = {}]) => ({
    key,
    run: async () => {
      const r = await peClient.get(await compat.url(peClient, api, path), opts.params ? { params: opts.params } : undefined);
      // Les endpoints de liste v2 répondent {entities:[…]} : on garde la forme telle quelle,
      // c'est celle que le snapshot d'audit produit et que le modèle sait lire.
      return opts.pick ? opts.pick(r.data) : r.data;
    },
  })));

  // SNMP du PE : utilisateurs et types seulement, jamais leurs clés (le bundle s'exporte et se dumpe).
  const snmp = out.data.snmp_v1;
  if (snmp) {
    const safe = (list) => (list || []).map(u => ({ username: u.username, authType: u.authType, privType: u.privType }));
    out.data.snmp_v1 = { ...snmp, ...(snmp.snmpUsers ? { snmpUsers: safe(snmp.snmpUsers) } : {}), ...(snmp.users ? { users: safe(snmp.users) } : {}) };
  }

  // Les ports physiques ne se lisent qu'hôte par hôte : ce n'est pas un endpoint de liste, d'où
  // ce second temps, une fois les hôtes connus. Même clé et même forme que le collecteur spécial
  // du worker d'audit (`_host_nics`), pour que le modèle n'ait qu'une seule forme à lire.
  const hosts = ((out.data.hosts_v2?.entities) || []).filter(h => h?.uuid);
  if (hosts.length) {
    out.collectors.total += 1;
    const nics = await collectHostNics(peClient, hosts);
    if (nics) { out.data.host_nics_v2 = nics; out.collectors.ok += 1; }
    else out.errors.push({ key: 'host_nics_v2', status: null, message: 'aucun port lisible sur les hôtes' });
  }
  out.data = scrub(out.data);
  return out;
}

/** Un appel par hôte, isolé : un hôte qui ne répond pas retire ses ports, pas ceux des autres. */
async function collectHostNics(peClient, hosts) {
  const perHost = await mapLimit(hosts, HOST_CONCURRENCY, async (h) => {
    try {
      const r = await peClient.get(await compat.url(peClient, 'prism.v2', `/hosts/${h.uuid}/host_nics`));
      const nics = Array.isArray(r.data) ? r.data : (r.data?.entities || []);
      return nics.map(n => ({ ...n, _host_name: h.name, _host_uuid: h.uuid }));
    } catch { return []; }
  });
  const entities = perHost.flat();
  return entities.length ? { entities } : null;
}

module.exports = { collectPc, collectPe, isPrismCentral, mapLimit, HOST_CONCURRENCY, PC_ENDPOINTS, PE_ENDPOINTS };
