// Catalogue des sections de l'as-built (cf. docs/ASBUILT.md §4).
//
// C'est le point d'évolution du module : ajouter une information au document, c'est ajouter
// ou étendre une entrée ici. Le moteur (asBuiltModel.js) parcourt ce catalogue, le rendu
// parcourt ce que le moteur produit — ni l'un ni l'autre ne connaît le contenu métier.
//
// Chaque entrée :
//   id             identifiant stable, référencé par les préférences d'activation
//   chapter        chapitre du document (voir CHAPTERS)
//   kind           'table' | 'kv' | 'diagram' | 'text'
//   title          { fr, en }
//   defaultEnabled false = section proposée mais décochée par défaut
//   keys           clés de collecte lues : elles permettent au moteur de dire si une section vide
//                  l'est faute de configuration (« Non configuré ») ou faute de lecture
//                  (« Non collecté », avec l'erreur de la clé)
//   untitled       true = pas de titre propre, le contenu s'écrit sous le titre du chapitre
//   build(ctx)     → { columns, rows } | { rows } | { data } | { text } — ou null si rien à dire ;
//                  `ctx.notCollected(raison)` et `{ rows: [], emptyText }` précisent un vide
//
// `ctx` est décrit en tête d'asBuiltModel.js. Règle absolue : une section ne lit jamais un
// champ marqué secret (mot de passe IPMI…), qui n'a rien à faire dans un document qui circule.

import { addr, addrList } from './normalize';

// `scope: 'pc'` = chapitre de niveau document, produit une fois ; `cluster` = une fois par cluster.
export const CHAPTERS = [
  { id: 'intro', scope: 'pc',      title: { fr: 'Présentation', en: 'Introduction' } },
  { id: 'pc',    scope: 'pc',      title: { fr: 'Prism Central', en: 'Prism Central' } },
  { id: 'sec',   scope: 'pc',      title: { fr: 'Sécurité et accès', en: 'Security and Access' } },
  { id: 'env',   scope: 'cluster', title: { fr: "Construction de l'environnement", en: 'Environment Build' } },
  { id: 'host',  scope: 'cluster', title: { fr: 'Conception des hôtes', en: 'Hypervisor Host Design' } },
  { id: 'cfg',   scope: 'cluster', title: { fr: 'Configuration Nutanix', en: 'Nutanix Configuration' } },
  { id: 'annex', scope: 'annex',   title: { fr: 'Annexes', en: 'Appendices' } },
];

// Catégories prédéfinies par la plateforme. `SYSTEM` est créé au démarrage du Prism Central,
// `INTERNAL` n'apparaît même pas dans son interface : ni l'une ni l'autre ne décrit une décision
// d'installation, et les lister noierait les quelques catégories réellement créées pour le client.
const PLATFORM_CATEGORY_TYPES = ['SYSTEM', 'INTERNAL'];
const isPlatformCategory = (c) =>
  PLATFORM_CATEGORY_TYPES.includes(String(c.type ?? '').toUpperCase());

// Catégories référencées par extId (politiques VM, plan #18) → « Clé: valeur ».
const categoryNames = (ctx, refs) => {
  const byId = new Map(ctx.pc.list('v4_categories').map(c => [c.extId, `${c.key}: ${c.value}`]));
  return (refs || []).map(r => byId.get(r.extId) || r.extId).join(', ');
};

// ─── Chapitre Présentation ────────────────────────────────────────────────────

// Texte du document de référence. Le client et l'intégrateur ne sont nommés que s'ils sont connus :
// un as-built sans client ni intégrateur saisi reste lisible.
const PRESENTATION = {
  fr: ({ forCustomer, byIntegrator }) => [
    `Ce document « As Built » Nutanix a été élaboré pour fournir une description détaillée et exhaustive de l'infrastructure Nutanix mise en place${forCustomer}${byIntegrator}.`,
    'Il contient des informations précises sur la configuration matérielle et logicielle, les paramètres de réseau, les politiques de sécurité, ainsi que les procédures de déploiement et de gestion.',
    "Ce document est essentiel pour garantir une compréhension claire et complète de l'environnement Nutanix, facilitant ainsi la maintenance, le support et les futures évolutions de l'infrastructure.",
    'Il est destiné aux équipes techniques, aux administrateurs système et aux responsables de projet, offrant une référence fiable et structurée pour toute intervention ou audit.',
  ],
  en: ({ forCustomer, byIntegrator }) => [
    `This Nutanix "As Built" document provides a detailed and comprehensive description of the Nutanix infrastructure deployed${forCustomer}${byIntegrator}.`,
    'It contains precise information on the hardware and software configuration, network settings, security policies, and deployment and management procedures.',
    'This document is essential to a clear and complete understanding of the Nutanix environment, and so eases maintenance, support and future evolutions of the infrastructure.',
    'It is intended for technical teams, system administrators and project managers, as a reliable and structured reference for any intervention or audit.',
  ],
};

const INTRO_SECTIONS = [
  {
    id: 'intro.presentation', chapter: 'intro', kind: 'text', untitled: true,
    title: { fr: 'Présentation', en: 'Introduction' },
    build: (ctx) => {
      const fr = ctx.lang !== 'en';
      return {
        text: (PRESENTATION[ctx.lang] || PRESENTATION.fr)({
          forCustomer: ctx.customer ? `${fr ? ' pour ' : ' for '}${ctx.customer}` : '',
          byIntegrator: !ctx.integrator ? ''
            : fr ? ` par les équipes ${/^[aeiouyh]/i.test(ctx.integrator) ? "d'" : 'de '}${ctx.integrator}`
              : ` by the ${ctx.integrator} teams`,
        }).join('\n'),
      };
    },
  },
];

// ─── Le Prism Central lui-même ────────────────────────────────────────────────
// Le domain-manager v4 décrit le PC (taille, ressources, réseau) ; son entrée dans `v4_clusters`
// donne les IP de ses VM, DNS et NTP — et reste lisible sur un PC antérieur à pc.2024.3.

const PC_SIZE = { STARTER: 'Starter', SMALL: 'Small', LARGE: 'Large', EXTRALARGE: 'X-Large' };
const GiB = 1024 ** 3;

function pcView(ctx) {
  const dm = ctx.pc.list('v4_domain_managers')[0] || null;
  const pc = ctx.pc.entity;
  const net = dm?.network || {};
  const cnet = pc?.network || {};
  const ext = (net.externalNetworks || [])[0] || {};
  const vmIps = (pc?.nodes?.nodeList || []).map(n => addr(n.controllerVmIp)).filter(Boolean);
  const ranges = (ext.ipRanges || []).map(r => [addr(r.begin), addr(r.end)].filter(Boolean))
    .map(([b, e]) => (e && e !== b ? `${b} – ${e}` : b)).filter(Boolean);
  const res = dm?.config?.resourceConfig || {};
  const nodeCount = dm?.nodeExtIds?.length || vmIps.length || pc?.nodes?.numberOfNodes || null;
  const pick = (a, b) => (a.length ? a : b);
  return {
    dm, pc,
    extId: pc?.extId || null,
    name: dm?.config?.name || pc?.name || null,
    fqdn: addr(net.fqdn) || addr(cnet.fqdn) || null,
    version: dm?.config?.buildInfo?.version || ctx.pc.version,
    size: PC_SIZE[dm?.config?.size] || dm?.config?.size || null,
    nodeCount,
    hostingCluster: dm?.hostingClusterExtId
      ? (ctx.allClusters.find(c => c.uuid === dm.hostingClusterExtId)?.name || dm.hostingClusterExtId) : null,
    vip: addr(net.externalAddress) || addr(cnet.externalAddress) || ctx.pc.host,
    vmIps: vmIps.length ? vmIps : ranges,
    mask: addr(ext.subnetMask), gateway: addr(ext.defaultGateway),
    dns: pick(addrList(net.nameServers), addrList(cnet.nameServerIpList)),
    ntp: pick(addrList(net.ntpServers), addrList(cnet.ntpServerIpList)),
    vcpu: res.numVcpus ?? null,
    memoryGb: res.memorySizeBytes != null ? res.memorySizeBytes / GiB : null,
    diskGb: res.dataDiskSizeBytes != null ? res.dataDiskSizeBytes / GiB : null,
  };
}

/** Nom d'un cluster du parc à partir de son extId ; l'extId à défaut. */
const clusterName = (ctx, id) => (id ? (ctx.allClusters.find(c => c.uuid === id)?.name || id) : null);

/** Les VM du PC, retrouvées dans l'inventaire v4 par leurs IP. */
function pcVms(ctx, ips) {
  if (!ips.length) return [];
  const ipsOf = (v) => (v.nics || []).flatMap(n => [
    n.networkInfo?.ipv4Config?.ipAddress, ...(n.networkInfo?.ipv4Info?.learnedIpAddresses || []),
  ]).map(addr).filter(Boolean);
  return ctx.pc.list('v4_vms').flatMap(v => {
    const ip = ipsOf(v).find(i => ips.includes(i));
    return ip ? [{
      name: v.name, ip,
      vcpu: (v.numSockets || 0) * (v.numCoresPerSocket || 0) * (v.numThreadsPerCore || 1) || null,
      memoryGb: v.memorySizeBytes != null ? v.memorySizeBytes / GiB : null,
    }] : [];
  });
}

const PC_SHEET_SECTIONS = [
  {
    id: 'pc.info', chapter: 'pc', kind: 'kv',
    title: { fr: 'Informations du Prism Central', en: 'Prism Central Information' },
    keys: ['v4_domain_managers'],
    build: (ctx) => {
      const v = pcView(ctx);
      if (!v.pc && !v.dm) return null;
      const fr = ctx.lang !== 'en';
      const deployment = v.nodeCount == null ? null
        : v.nodeCount > 1 ? (fr ? `Scale-out (${v.nodeCount} VM)` : `Scale-out (${v.nodeCount} VMs)`)
          : (fr ? 'Une VM' : 'Single VM');
      return {
        rows: [
          ctx.kv({ fr: 'Nom', en: 'Name' }, v.name, null),
          ctx.kv({ fr: 'FQDN', en: 'FQDN' }, v.fqdn, null),
          ctx.kv({ fr: 'Version', en: 'Version' }, v.version, null),
          ctx.kv({ fr: 'Taille', en: 'Size' }, v.size, null),
          ctx.kv({ fr: 'Déploiement', en: 'Deployment' }, deployment, null),
          ctx.kv({ fr: 'Cluster hôte', en: 'Hosting Cluster' }, v.hostingCluster, null),
        ],
      };
    },
  },
  {
    id: 'pc.addressing', chapter: 'pc', kind: 'kv',
    title: { fr: 'Adressage du Prism Central', en: 'Prism Central Addressing' },
    keys: ['v4_domain_managers'],
    build: (ctx) => {
      const v = pcView(ctx);
      if (!v.pc && !v.dm) return null;
      const list = (a) => (a.length ? a.join(', ') : null);
      return {
        rows: [
          ctx.kv({ fr: 'Adresse virtuelle', en: 'Virtual IP' }, v.vip, null),
          ctx.kv({ fr: 'IP des VM', en: 'VM IPs' }, list(v.vmIps), null),
          ctx.kv({ fr: 'Masque', en: 'Netmask' }, v.mask, null),
          ctx.kv({ fr: 'Passerelle', en: 'Gateway' }, v.gateway, null),
          ctx.kv({ fr: 'DNS', en: 'DNS' }, list(v.dns), null),
          ctx.kv({ fr: 'NTP', en: 'NTP' }, list(v.ntp), null),
        ],
      };
    },
  },
  {
    id: 'pc.resources', chapter: 'pc', kind: 'table',
    title: { fr: 'CPU et mémoire du Prism Central', en: 'Prism Central CPU and Memory' },
    keys: ['v4_domain_managers', 'v4_vms'],
    build: (ctx) => {
      const v = pcView(ctx);
      // Une ligne par VM du PC quand l'inventaire les montre ; sinon la dotation du domain-manager.
      const vms = pcVms(ctx, v.vmIps);
      const rows = vms.length
        ? vms.map(m => ctx.row([m.name, m.ip, m.vcpu, m.memoryGb != null ? ctx.f.gb(m.memoryGb) : null,
          v.diskGb != null ? ctx.f.gb(v.diskGb) : null], 'api'))
        : (v.vcpu != null || v.memoryGb != null)
          ? [ctx.row([v.name || 'Prism Central', v.vmIps.join(', ') || v.vip, v.vcpu,
            v.memoryGb != null ? ctx.f.gb(v.memoryGb) : null, v.diskGb != null ? ctx.f.gb(v.diskGb) : null], 'api')]
          : [];
      if (!rows.length) return null;
      return {
        columns: [
          { fr: 'VM', en: 'VM' }, { fr: 'IP', en: 'IP' }, { fr: 'vCPU', en: 'vCPU' },
          { fr: 'Mémoire', en: 'Memory' }, { fr: 'Disque de données', en: 'Data Disk' },
        ],
        rows,
      };
    },
  },
  {
    id: 'pc.versions', chapter: 'pc', kind: 'table',
    title: { fr: 'Versions du Prism Central', en: 'Prism Central Versions' },
    keys: ['v4_lcm_entities'],
    build: (ctx) => {
      const v = pcView(ctx);
      // Le PC est une VM : pas de firmware, seulement ses logiciels tels que LCM les inventorie.
      const seen = new Set();
      const lcm = ctx.pc.list('v4_lcm_entities')
        .filter(e => v.extId && (e.clusterExtId || e.cluster?.extId) === v.extId)
        .filter(e => e.entityModel !== 'PC')   // le PC lui-même : déjà la première ligne
        .map(e => [e.entityModel || e.entityClass, e.entityVersion || e.version])
        .filter(([c, ver]) => c && ver && !seen.has(`${c}|${ver}`) && seen.add(`${c}|${ver}`))
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      const rows = [...(v.version ? [['Prism Central', v.version]] : []), ...lcm];
      if (!rows.length) return null;
      return {
        columns: [{ fr: 'Composant', en: 'Component' }, { fr: 'Version', en: 'Version' }],
        rows: rows.map(r => ctx.row(r, 'api')),
      };
    },
  },
];

// ─── Chapitre Prism Central ───────────────────────────────────────────────────

const PC_SECTIONS = [
  {
    id: 'pc.overview', chapter: 'pc', kind: 'diagram',
    title: { fr: "Vue d'ensemble", en: 'High Level Overview' },
    build: (ctx) => ({
      data: {
        shape: 'pc-overview',
        pc: { host: ctx.pc.host, name: ctx.pc.name, version: ctx.pc.version },
        clusters: ctx.allClusters.map(c => ({
          name: c.name, aos: c.aosVersion, ahv: c.hypervisorVersion, nodes: c.nodeCount,
          cores: c.cpuCores, ramGb: c.memoryGb, storageTb: c.storageTb,
          pcMode: c.plan?.pc?.mode || null,
        })),
      },
    }),
  },
  ...PC_SHEET_SECTIONS,
  {
    id: 'pc.inventory', chapter: 'pc', kind: 'table',
    title: { fr: 'Clusters enregistrés', en: 'Registered Clusters' },
    // La version d'hyperviseur du parc se lit sur les hôtes, comme la version d'AOS se lit sur le
    // cluster : les deux colonnes viennent de la plateforme, jamais de la saisie — un inventaire
    // du Prism Central n'inventorie que ce qu'il voit.
    build: (ctx) => ({
      columns: [
        { fr: 'Cluster', en: 'Cluster' }, { fr: 'AOS', en: 'AOS' }, { fr: 'AHV', en: 'AHV' },
        { fr: 'Nœuds', en: 'Nodes' },
        { fr: 'Cœurs', en: 'Cores' }, { fr: 'RAM', en: 'Memory' }, { fr: 'Capacité', en: 'Capacity' },
        { fr: 'RF', en: 'RF' },
      ],
      rows: ctx.allClusters.map(c => ctx.row([
        c.name, c.aosVersion, c.hypervisorVersion, c.nodeCount, c.cpuCores,
        c.memoryGb != null ? ctx.f.gb(c.memoryGb) : null,
        c.storageTb != null ? ctx.f.tb(c.storageTb) : null,
        c.rf,
      ], c.hasApi ? 'api' : 'build')),
    }),
  },
  {
    id: 'pc.identity', chapter: 'pc', kind: 'table',
    title: { fr: 'Comptes, rôles et annuaires', en: 'Accounts, Roles and Directories' },
    keys: ['v4_users', 'v4_directory_services', 'v4_user_groups'],
    build: (ctx) => {
      const users = ctx.pc.list('v4_users');
      const dirs  = ctx.pc.list('v4_directory_services');
      const groups = ctx.pc.list('v4_user_groups');
      if (!users.length && !dirs.length && !groups.length) return null;
      return {
        columns: [
          { fr: 'Type', en: 'Type' }, { fr: 'Nom', en: 'Name' },
          { fr: 'Détail', en: 'Detail' }, { fr: 'État', en: 'State' },
        ],
        rows: [
          ...users.map(u => ctx.row([
            ctx.lang === 'en' ? 'User' : 'Utilisateur', u.username || u.name,
            ctx.f.label(u.userType) || u.emailId || '', ctx.f.label(u.status || u.state) || '',
          ], 'api')),
          ...dirs.map(d => ctx.row([
            ctx.lang === 'en' ? 'Directory' : 'Annuaire', d.name,
            d.url || (d.serviceAccount?.username ?? ''), ctx.f.label(d.directoryType) || '',
          ], 'api')),
          ...groups.map(g => ctx.row([
            ctx.lang === 'en' ? 'Group' : 'Groupe', g.name, g.distinguishedName || '', ctx.f.label(g.groupType) || '',
          ], 'api')),
        ],
      };
    },
  },
  {
    id: 'pc.categories', chapter: 'pc', kind: 'table', defaultEnabled: false,
    title: { fr: 'Catégories', en: 'Categories' },
    keys: ['v4_categories'],
    build: (ctx) => {
      const cats = ctx.pc.list('v4_categories').filter(c => !isPlatformCategory(c));
      if (!cats.length) return null;
      return {
        columns: [{ fr: 'Clé', en: 'Key' }, { fr: 'Valeur', en: 'Value' }, { fr: 'Description', en: 'Description' }],
        rows: cats.map(c => ctx.row([c.key, c.value, c.description || ''], 'api')),
      };
    },
  },
  {
    id: 'pc.vmplacement', chapter: 'pc', kind: 'table',
    title: { fr: 'Règles de placement des VM', en: 'VM Placement Rules' },
    keys: ['v4_vm_host_affinity_policies', 'v4_vm_anti_affinity_policies', 'v4_legacy_vm_anti_affinity_policies'],
    build: (ctx) => {
      const en = ctx.lang === 'en';
      const compliance = (p) => (p.numCompliantVms != null || p.numNonCompliantVms != null)
        ? `${p.numCompliantVms ?? 0} ${en ? 'compliant' : 'conforme(s)'}, ${p.numNonCompliantVms ?? 0} ${en ? 'not compliant' : 'non conforme(s)'}` : '';
      const names = new Map(ctx.pc.list('v4_clusters').map(c => [c.extId, c.name]));
      const rows = [
        ...ctx.pc.list('v4_vm_host_affinity_policies').map(p => ctx.row([
          en ? 'VM-host affinity' : 'Affinité VM-hôte', p.name, categoryNames(ctx, p.vmCategories), categoryNames(ctx, p.hostCategories), compliance(p),
        ], 'api')),
        ...ctx.pc.list('v4_vm_anti_affinity_policies').map(p => ctx.row([
          en ? 'VM-VM anti-affinity' : 'Anti-affinité VM-VM', p.name, categoryNames(ctx, p.categories), '', compliance(p),
        ], 'api')),
        ...ctx.pc.list('v4_legacy_vm_anti_affinity_policies').map(p => ctx.row([
          en ? 'Anti-affinity (legacy)' : 'Anti-affinité (héritée)', p.name, `${(p.vms || []).length} VM`, names.get(p.cluster?.extId) || '', '',
        ], 'api')),
      ];
      if (!rows.length) return null;
      return {
        columns: [
          { fr: 'Type', en: 'Type' }, { fr: 'Nom', en: 'Name' }, { fr: 'VM', en: 'VMs' },
          { fr: 'Hôtes', en: 'Hosts' }, { fr: 'Conformité', en: 'Compliance' },
        ],
        rows,
      };
    },
  },
  {
    id: 'pc.vmstartup', chapter: 'pc', kind: 'table',
    title: { fr: 'Ordre de démarrage des VM', en: 'VM Startup Order' },
    keys: ['v4_vm_startup_policies'],
    build: (ctx) => {
      const pol = ctx.pc.list('v4_vm_startup_policies');
      if (!pol.length) return null;
      const en = ctx.lang === 'en';
      return {
        columns: [{ fr: 'Politique', en: 'Policy' }, { fr: 'Ordre des groupes', en: 'Group Order' }, { fr: 'Conditions de démarrage', en: 'Start Conditions' }],
        rows: pol.map(p => ctx.row([
          p.name,
          (p.groups || []).map(g => categoryNames(ctx, g.categories)).join(' → '),
          (p.startConditions || []).map(c => [ctx.f.label(c.powerStateCriteria), c.delayDurationSecs != null ? `${en ? 'delay' : 'délai'} ${c.delayDurationSecs} s` : null].filter(Boolean).join(', ')).join(' ; '),
        ], 'api')),
      };
    },
  },
  {
    id: 'pc.backup', chapter: 'pc', kind: 'table',
    title: { fr: 'Sauvegarde du Prism Central', en: 'Prism Central Backup' },
    keys: ['v4_pc_backup_targets'],
    build: (ctx) => {
      const targets = ctx.pc.list('v4_pc_backup_targets');
      if (!targets.length) return null;
      const en = ctx.lang === 'en';
      // Cible : un cluster (ClusterReference) ou un magasin objet (S3, Nutanix Objects).
      const where = (loc = {}) => loc.config
        ? [en ? 'Cluster' : 'Cluster', loc.config.name || loc.config.extId]
        : [en ? 'Object store' : 'Magasin objet', loc.providerConfig?.bucketName || loc.providerConfig?.endpoint || ''];
      return {
        columns: [{ fr: 'Type', en: 'Type' }, { fr: 'Cible', en: 'Target' }, { fr: 'Dernière synchronisation', en: 'Last Sync' }, { fr: 'État', en: 'State' }],
        rows: targets.map(t => ctx.row([
          ...where(t.location), t.lastSyncTime ? String(t.lastSyncTime).slice(0, 10) : '',
          t.isBackupPaused ? `${en ? 'Paused' : 'En pause'}${t.backupPauseReason ? ` (${t.backupPauseReason})` : ''}` : (en ? 'Active' : 'Active'),
        ], 'api')),
      };
    },
  },
  {
    id: 'pc.lcm', chapter: 'pc', kind: 'kv',
    title: { fr: 'Configuration LCM', en: 'LCM Configuration' },
    keys: ['v4_lcm_config'],
    build: (ctx) => {
      const c = ctx.pc.list('v4_lcm_config')[0];
      if (!c) return null;
      return {
        rows: [
          ctx.kv({ fr: 'Version LCM', en: 'LCM Version' }, c.displayVersion || c.version, null),
          ctx.kv({ fr: 'Source des mises à jour', en: 'Update Source' }, c.url, null),
          ctx.kv({ fr: 'Connectivité', en: 'Connectivity' }, ctx.f.label(c.connectivityType), null),
          ctx.kv({ fr: 'HTTPS', en: 'HTTPS' }, ctx.f.bool(c.isHttpsEnabled), null),
          ctx.kv({ fr: 'Inventaire automatique', en: 'Auto Inventory' }, c.isAutoInventoryEnabled ? [ctx.f.bool(true), c.autoInventorySchedule].filter(Boolean).join(', ') : ctx.f.bool(false), null),
        ],
      };
    },
  },
  {
    id: 'pc.dataprotection', chapter: 'pc', kind: 'table',
    title: { fr: 'Politiques de protection', en: 'Protection Policies' },
    keys: ['v4_protection_policies'],
    build: (ctx) => {
      const pol = ctx.pc.list('v4_protection_policies');
      if (!pol.length) return null;
      return {
        columns: [
          { fr: 'Nom', en: 'Name' }, { fr: 'Catégories', en: 'Categories' },
          { fr: 'RPO', en: 'RPO' }, { fr: 'Rétention', en: 'Retention' },
        ],
        rows: pol.map(p => ctx.row([
          p.name,
          (p.categoryIds || []).join(', '),
          ctx.f.duration(p.replicationConfigurations?.[0]?.scheduleConfig?.recoveryPointObjectiveTimeSeconds) ?? '',
          p.replicationConfigurations?.[0]?.scheduleConfig?.retention?.localRetentionCount ?? '',
        ], 'api')),
      };
    },
  },
  {
    id: 'pc.recoveryplans', chapter: 'pc', kind: 'table',
    title: { fr: 'Plans de reprise', en: 'Recovery Plans' },
    keys: ['v4_recovery_plans'],
    build: (ctx) => {
      const plans = ctx.pc.list('v4_recovery_plans');
      if (!plans.length) return null;
      const names = new Map(ctx.pc.list('v4_clusters').map(c => [c.extId, c.name]));
      const site = (loc) => (loc?.clusters || []).map(c => names.get(c.extId) || c.extId).join(', ')
        || (loc?.domainManagerExtId ? (ctx.lang === 'en' ? 'remote Prism Central' : 'Prism Central distant') : '');
      return {
        columns: [
          { fr: 'Nom', en: 'Name' }, { fr: 'Site principal', en: 'Primary Location' },
          { fr: 'Site de reprise', en: 'Recovery Location' }, { fr: 'Description', en: 'Description' },
        ],
        rows: plans.map(p => ctx.row([p.name, site(p.primaryLocation), site(p.recoveryLocation), p.description || ''], 'api')),
      };
    },
  },
  {
    id: 'pc.alerts', chapter: 'pc', kind: 'kv',
    title: { fr: 'Alertes par e-mail', en: 'Alert Email Configuration' },
    keys: ['v4_alert_email_config'],
    build: (ctx) => {
      const cfg = ctx.pc.list('v4_alert_email_config')[0];
      if (!cfg) return null;
      return {
        rows: [
          ctx.kv({ fr: 'Alertes par e-mail', en: 'Email Alerts' }, ctx.f.bool(cfg.isEnabled), null),
          ctx.kv({ fr: 'Digest quotidien', en: 'Email Digest Enabled' }, ctx.f.bool(cfg.isEmailDigestEnabled), null),
          ctx.kv({ fr: 'Destinataires', en: 'Email Contact List' }, ctx.f.joinList(cfg.emailContactList), null),
          ctx.kv({ fr: 'Copie au support Nutanix', en: 'Nutanix Support Copy' }, cfg.hasDefaultNutanixEmail ? cfg.defaultNutanixEmail : ctx.f.bool(false), null),
          ...(cfg.tunnelDetails?.connectionStatus?.status ? [ctx.kv({ fr: 'Liaison avec Nutanix', en: 'Nutanix Connection' }, ctx.f.label(cfg.tunnelDetails.connectionStatus.status), null)] : []),
        ],
      };
    },
  },
  {
    id: 'pc.storagepolicies', chapter: 'pc', kind: 'table', defaultEnabled: false,
    title: { fr: 'Politiques de stockage', en: 'Storage Policies' },
    keys: ['v4_storage_policies'],
    build: (ctx) => {
      const pol = ctx.pc.list('v4_storage_policies');
      if (!pol.length) return null;
      return {
        columns: [
          { fr: 'Politique', en: 'Policy' }, { fr: 'Catégories', en: 'Categories' }, { fr: 'Compression', en: 'Compression' },
          { fr: 'Chiffrement', en: 'Encryption' }, { fr: 'QoS (IOPS)', en: 'QoS (IOPS)' }, { fr: 'Réplication', en: 'Replication' },
        ],
        rows: pol.map(p => ctx.row([
          p.name, categoryNames(ctx, (p.categoryExtIds || []).map(extId => ({ extId }))),
          ctx.f.label(p.compressionSpec?.compressionState), ctx.f.label(p.encryptionSpec?.encryptionState),
          p.qosSpec?.throttledIops ?? null, ctx.f.label(p.faultToleranceSpec?.replicationFactor),
        ], 'api')),
      };
    },
  },
  {
    id: 'pc.alertpolicies', chapter: 'pc', kind: 'table', defaultEnabled: false,
    title: { fr: "Politiques d'alerte personnalisées", en: 'Custom Alert Policies' },
    keys: ['v4_alert_user_policies'],
    build: (ctx) => {
      const pol = ctx.pc.list('v4_alert_user_policies');
      if (!pol.length) return null;
      return {
        columns: [{ fr: 'Politique', en: 'Policy' }, { fr: 'Entité', en: 'Entity' }, { fr: 'Impact', en: 'Impact' }, { fr: 'Activée', en: 'Enabled' }],
        rows: pol.map(p => ctx.row([p.title, ctx.f.label(p.entityType), (p.impactTypes || []).map(i => ctx.f.label(i)).join(', '), ctx.f.bool(p.isEnabled)], 'api')),
      };
    },
  },
  {
    id: 'pc.fvn', chapter: 'pc', kind: 'table', defaultEnabled: false,
    title: { fr: 'Flow Virtual Networking', en: 'Flow Virtual Networking' },
    keys: ['v4_gateways', 'v4_vpn_connections', 'v4_bgp_sessions', 'v4_floating_ips', 'v4_layer2_stretches'],
    build: (ctx) => {
      const en = ctx.lang === 'en';
      const vpcs = new Map(ctx.pc.list('v4_vpcs').map(v => [v.extId, v.name]));
      const gws = new Map(ctx.pc.list('v4_gateways').map(g => [g.extId, g.name]));
      const gw = (ref) => gws.get(ref) || ref;
      const state = (x) => ctx.f.label(typeof x === 'object' && x ? x.state : x);
      const rows = [
        ...ctx.pc.list('v4_gateways').map(g => ctx.row([en ? 'Gateway' : 'Passerelle', g.name, vpcs.get(g.vpcReference) || g.vpcReference || '', state(g.status)], 'api')),
        ...ctx.pc.list('v4_vpn_connections').map(v => ctx.row(['VPN', v.name, `${gw(v.localGatewayReference)} ↔ ${gw(v.remoteGatewayReference)}`, state(v.ipsecTunnelStatus)], 'api')),
        ...ctx.pc.list('v4_bgp_sessions').map(b => ctx.row(['BGP', b.name, `${gw(b.localGatewayReference)} ↔ ${gw(b.remoteGatewayReference)}`, state(b.status)], 'api')),
        ...ctx.pc.list('v4_floating_ips').map(f => ctx.row([en ? 'Floating IP' : 'IP flottante', f.name, `${addr(f.floatingIp) || ''} → ${addr(f.privateIp) || ''}`, ctx.f.label(f.associationStatus)], 'api')),
        ...ctx.pc.list('v4_layer2_stretches').map(l => ctx.row([en ? 'Layer 2 stretch' : 'Extension L2', l.name, [ctx.f.label(l.connectionType), l.vni != null ? `VNI ${l.vni}` : null].filter(Boolean).join(', '), state(l.stretchStatus)], 'api')),
      ];
      if (!rows.length) return null;
      return {
        columns: [{ fr: 'Type', en: 'Type' }, { fr: 'Nom', en: 'Name' }, { fr: 'Détail', en: 'Detail' }, { fr: 'État', en: 'State' }],
        rows,
      };
    },
  },
  {
    id: 'pc.catalog', chapter: 'pc', kind: 'table', defaultEnabled: false,
    title: { fr: 'Catalogue', en: 'Catalog' },
    keys: ['v4_templates', 'v4_guest_profiles', 'v4_image_placement_policies'],
    build: (ctx) => {
      const en = ctx.lang === 'en';
      const rows = [
        ...ctx.pc.list('v4_templates').map(t => ctx.row([en ? 'Template' : 'Modèle de VM', t.templateName, t.templateDescription || ''], 'api')),
        ...ctx.pc.list('v4_guest_profiles').map(g => ctx.row([en ? 'Guest customization' : 'Personnalisation invité', g.name, g.description || ''], 'api')),
        ...ctx.pc.list('v4_image_placement_policies').map(p => ctx.row([en ? 'Image placement' : 'Placement des images',
          p.name, [ctx.f.label(p.placementType), ctx.f.label(p.enforcementState)].filter(Boolean).join(', ')], 'api')),
      ];
      if (!rows.length) return null;
      return { columns: [{ fr: 'Type', en: 'Type' }, { fr: 'Nom', en: 'Name' }, { fr: 'Détail', en: 'Detail' }], rows };
    },
  },
  {
    id: 'pc.iscsi', chapter: 'pc', kind: 'table', defaultEnabled: false,
    title: { fr: 'Clients iSCSI', en: 'iSCSI Clients' },
    keys: ['v4_iscsi_clients'],
    build: (ctx) => {
      const clients = ctx.pc.list('v4_iscsi_clients');
      if (!clients.length) return null;
      const names = new Map(ctx.pc.list('v4_clusters').map(c => [c.extId, c.name]));
      return {
        columns: [{ fr: 'Initiateur', en: 'Initiator' }, { fr: 'Cluster', en: 'Cluster' }, { fr: 'Authentification', en: 'Authentication' }, { fr: 'Cibles', en: 'Targets' }],
        rows: clients.map(c => ctx.row([c.iscsiInitiatorName, names.get(c.clusterReference) || c.clusterReference || '', ctx.f.label(c.enabledAuthentications), c.numVirtualTargets], 'api')),
      };
    },
  },
  {
    id: 'pc.licensing', chapter: 'pc', kind: 'table',
    title: { fr: 'Licences', en: 'Licensing' },
    keys: ['v4_license_keys'],
    build: (ctx) => {
      const keys = ctx.pc.list('v4_license_keys');
      if (!keys.length) return null;
      return {
        columns: [
          { fr: 'Licence', en: 'License' }, { fr: 'Type', en: 'Type' },
          { fr: 'Cluster', en: 'Cluster' }, { fr: 'Échéance', en: 'Expiry' },
        ],
        rows: keys.map(k => ctx.row([
          k.name || k.licenseType, k.licenseClass || k.type,
          k.clusterName || k.clusterExtId || '', k.expiryTime || k.expiryDate || '',
        ], 'api')),
      };
    },
  },

  // ─── Images et services ─────────────────────────────────────────────────────
  // Un service non déployé répond « aucun » (voir PC_ENDPOINTS) : sa section dit « Non configuré ».
  {
    id: 'pc.images', chapter: 'pc', kind: 'table',
    title: { fr: 'Images', en: 'Images' },
    keys: ['v4_images'],
    build: (ctx) => {
      const imgs = ctx.pc.list('v4_images');
      if (!imgs.length) return null;
      return {
        columns: [
          { fr: 'Image', en: 'Image' }, { fr: 'Type', en: 'Type' },
          { fr: 'Taille', en: 'Size' }, { fr: 'Clusters', en: 'Clusters' },
        ],
        rows: imgs.map(i => ctx.row([
          i.name, ctx.f.label(i.type),
          i.sizeBytes != null ? ctx.f.gb(i.sizeBytes / GiB) : null,
          (i.clusterLocationExtIds || []).map(id => clusterName(ctx, id)).join(', '),
        ], 'api')),
      };
    },
  },
  {
    id: 'pc.flow', chapter: 'pc', kind: 'table',
    title: { fr: 'Flow : politiques de sécurité réseau', en: 'Flow Network Security Policies' },
    keys: ['v4_network_security_policies'],
    build: (ctx) => {
      // Les politiques livrées avec Flow sont les mêmes partout : seules celles du client comptent.
      const pols = ctx.pc.list('v4_network_security_policies').filter(p => !p.isSystemDefined);
      if (!pols.length) return null;
      return {
        columns: [
          { fr: 'Politique', en: 'Policy' }, { fr: 'Type', en: 'Type' },
          { fr: 'État', en: 'State' }, { fr: 'Description', en: 'Description' },
        ],
        rows: pols.map(p => ctx.row([p.name, ctx.f.label(p.type), ctx.f.label(p.state), p.description || ''], 'api')),
      };
    },
  },
  {
    id: 'pc.vpcs', chapter: 'pc', kind: 'table',
    title: { fr: 'Flow : VPC', en: 'Flow Virtual Private Clouds' },
    keys: ['v4_vpcs'],
    build: (ctx) => {
      const vpcs = ctx.pc.list('v4_vpcs');
      if (!vpcs.length) return null;
      const subnet = (id) => ctx.pc.list('v4_subnets').find(s => s.extId === id)?.name || id;
      return {
        columns: [
          { fr: 'VPC', en: 'VPC' }, { fr: 'Type', en: 'Type' },
          { fr: 'Sous-réseaux externes', en: 'External Subnets' }, { fr: 'Description', en: 'Description' },
        ],
        rows: vpcs.map(v => ctx.row([
          v.name, ctx.f.label(v.vpcType),
          (v.externalSubnets || []).map(e => subnet(e.subnetReference)).filter(Boolean).join(', '),
          v.description || '',
        ], 'api')),
      };
    },
  },
  {
    id: 'pc.files', chapter: 'pc', kind: 'table',
    title: { fr: 'Nutanix Files', en: 'Nutanix Files' },
    keys: ['v4_file_servers'],
    // La spec v4.0 ne garantit que le nom ; version et cluster s'affichent quand le PC les rend.
    build: (ctx) => {
      const fss = ctx.pc.list('v4_file_servers');
      if (!fss.length) return null;
      return {
        columns: [{ fr: 'Serveur de fichiers', en: 'File Server' }, { fr: 'Version', en: 'Version' }, { fr: 'Cluster', en: 'Cluster' }],
        rows: fss.map(f => ctx.row([f.name, f.version, clusterName(ctx, f.clusterExtId)], 'api')),
      };
    },
  },
  {
    id: 'pc.objects', chapter: 'pc', kind: 'table',
    title: { fr: 'Nutanix Objects', en: 'Nutanix Objects' },
    keys: ['v4_object_stores'],
    build: (ctx) => {
      const oss = ctx.pc.list('v4_object_stores');
      if (!oss.length) return null;
      return {
        columns: [
          { fr: 'Object store', en: 'Object Store' }, { fr: 'Domaine', en: 'Domain' },
          { fr: 'Version', en: 'Version' }, { fr: 'Nœuds', en: 'Worker Nodes' },
          { fr: 'Capacité', en: 'Capacity' }, { fr: 'Cluster', en: 'Cluster' }, { fr: 'État', en: 'State' },
        ],
        rows: oss.map(o => ctx.row([
          o.name, o.domain, o.deploymentVersion, o.numWorkerNodes,
          o.totalCapacityGiB != null ? ctx.f.gb(o.totalCapacityGiB) : null,
          clusterName(ctx, o.clusterExtId), ctx.f.label(o.state),
        ], 'api')),
      };
    },
  },
  {
    id: 'pc.volumes', chapter: 'pc', kind: 'table',
    title: { fr: 'Nutanix Volumes', en: 'Nutanix Volumes' },
    keys: ['v4_volume_groups'],
    build: (ctx) => {
      // Les volume groups cachés appartiennent à la plateforme (NKE, Files…), pas au client.
      const vgs = ctx.pc.list('v4_volume_groups').filter(v => !v.isHidden);
      if (!vgs.length) return null;
      return {
        columns: [
          { fr: 'Volume group', en: 'Volume Group' }, { fr: 'Cluster', en: 'Cluster' },
          { fr: 'Usage', en: 'Usage' }, { fr: 'Partage', en: 'Sharing' }, { fr: 'Cible iSCSI', en: 'iSCSI Target' },
        ],
        rows: vgs.map(v => ctx.row([
          v.name, clusterName(ctx, v.clusterReference), ctx.f.label(v.usageType),
          ctx.f.label(v.sharingStatus), v.targetName || v.targetPrefix,
        ], 'api')),
      };
    },
  },
];

// ─── Chapitre Sécurité et accès ───────────────────────────────────────────────
// Noms, rôles et états seulement : ni mot de passe, ni clé, ni jeton (le compte de service d'un
// annuaire est nommé, jamais son secret).

const LOCAL_USER_TYPES = ['LOCAL', 'SERVICE_ACCOUNT'];

const SEC_SECTIONS = [
  {
    id: 'sec.roles', chapter: 'sec', kind: 'table',
    title: { fr: 'Rôles personnalisés', en: 'Custom Roles' },
    keys: ['v4_roles'],
    // Les rôles livrés avec la plateforme sont les mêmes partout : seuls ceux créés pour le
    // client décrivent une décision d'installation.
    build: (ctx) => {
      const roles = ctx.pc.list('v4_roles').filter(r => r.isSystemDefined !== true);
      if (!roles.length) return null;
      return {
        columns: [
          { fr: 'Rôle', en: 'Role' }, { fr: 'Description', en: 'Description' },
          { fr: 'Opérations', en: 'Operations' }, { fr: 'Utilisateurs', en: 'Users' },
          { fr: 'Groupes', en: 'Groups' },
        ],
        rows: roles.map(r => ctx.row([
          r.displayName || r.name, r.description || '',
          Array.isArray(r.operations) ? r.operations.length : null,
          r.assignedUsersCount, r.assignedUserGroupsCount,
        ], 'api')),
      };
    },
  },
  {
    id: 'sec.authz', chapter: 'sec', kind: 'table', defaultEnabled: false,
    title: { fr: "Droits d'accès", en: 'Access Rights' },
    keys: ['v4_authz_policies'],
    // Les politiques système sont les mêmes partout : seules celles du client sont listées, les autres
    // comptées.
    build: (ctx) => {
      const all = ctx.pc.list('v4_authz_policies');
      if (!all.length) return null;
      const own = all.filter(p => p.isSystemDefined !== true);
      const system = all.length - own.length;
      const roles = new Map(ctx.pc.list('v4_roles').map(r => [r.extId, r.displayName || r.name]));
      const en = ctx.lang === 'en';
      return {
        columns: [
          { fr: 'Politique', en: 'Policy' }, { fr: 'Rôle', en: 'Role' }, { fr: 'Utilisateurs', en: 'Users' },
          { fr: 'Groupes', en: 'Groups' }, { fr: 'Description', en: 'Description' },
        ],
        rows: [
          ...own.map(p => ctx.row([p.displayName, roles.get(p.role) || p.role, p.assignedUsersCount, p.assignedUserGroupsCount, p.description || ''], 'api')),
          ...(system ? [ctx.row([en ? `${system} system policies` : `${system} politique(s) système`, '', '', '', ''], 'api')] : []),
        ],
      };
    },
  },
  {
    id: 'sec.stig', chapter: 'sec', kind: 'table', defaultEnabled: false,
    title: { fr: 'Conformité STIG', en: 'STIG Compliance' },
    keys: ['v4_security_summaries', 'v4_security_profiles'],
    build: (ctx) => {
      const sums = ctx.pc.list('v4_security_summaries').filter(x => x.stigSummary); // le PC a une ligne sans compteurs
      if (!sums.length) return null;
      const names = new Map(ctx.pc.list('v4_clusters').map(c => [c.extId, c.name]));
      const profiles = ctx.pc.list('v4_security_profiles');
      return {
        columns: [
          { fr: 'Cluster', en: 'Cluster' }, { fr: 'Profil', en: 'Profile' }, { fr: 'Conformes', en: 'Passed' },
          { fr: 'Non conformes', en: 'Failed' }, { fr: 'Non applicables', en: 'Not Applicable' },
        ],
        rows: sums.map(x => ctx.row([
          names.get(x.clusterExtId) || x.clusterExtId, profiles.filter(p => p.clusterExtId === x.clusterExtId).map(p => ctx.f.label(p.type)).join(', '),
          x.stigSummary?.passedCount, x.stigSummary?.failedCount, x.stigSummary?.notApplicableCount,
        ], 'api')),
      };
    },
  },
  {
    id: 'sec.stigfailed', chapter: 'sec', kind: 'table', defaultEnabled: false,
    title: { fr: 'Contrôles STIG non conformes', en: 'Failed STIG Controls' },
    keys: ['v4_stigs'],
    build: (ctx) => {
      // Spec : APPLICABLE = un cluster échoue le contrôle ; pc.7.6 ne renvoie que ceux-là et les NEEDS_REVIEW.
      const failed = ctx.pc.list('v4_stigs').filter(x => ['APPLICABLE', 'NEEDS_REVIEW'].includes(x.status));
      if (!failed.length) return null;
      return {
        columns: [{ fr: 'Règle', en: 'Rule' }, { fr: 'Contrôle', en: 'Control' }, { fr: 'Sévérité', en: 'Severity' }, { fr: 'État', en: 'Status' }],
        rows: failed.map(x => ctx.row([x.ruleId, x.title, ctx.f.label(x.severity), ctx.f.label(x.status)], 'api')),
      };
    },
  },
  {
    id: 'sec.directories', chapter: 'sec', kind: 'table',
    title: { fr: "Configuration d'authentification", en: 'Authentication Configuration' },
    keys: ['v4_directory_services', 'v4_saml_identity_providers'],
    build: (ctx) => {
      const dirs = ctx.pc.list('v4_directory_services');
      const saml = ctx.pc.list('v4_saml_identity_providers');
      if (!dirs.length && !saml.length) return null;
      return {
        columns: [
          { fr: 'Annuaire', en: 'Directory' }, { fr: 'Type', en: 'Type' },
          { fr: 'Domaine', en: 'Domain' }, { fr: 'URL', en: 'URL' },
          { fr: 'Compte de service', en: 'Service Account' },
        ],
        rows: [
          ...dirs.map(d => ctx.row([
            d.name, ctx.f.label(d.directoryType), d.domainName, d.url, d.serviceAccount?.username,
          ], 'api')),
          ...saml.map(i => ctx.row([i.name, 'SAML', '', i.idpMetadataUrl || i.redirectURL || '', ''], 'api')),
        ],
      };
    },
  },
  {
    id: 'sec.localusers', chapter: 'sec', kind: 'table',
    title: { fr: 'Comptes locaux', en: 'Local Accounts' },
    keys: ['v4_users'],
    build: (ctx) => {
      const users = ctx.pc.list('v4_users').filter(u => !u.userType || LOCAL_USER_TYPES.includes(u.userType));
      if (!users.length) return null;
      return {
        columns: [
          { fr: 'Compte', en: 'Account' }, { fr: 'Nom affiché', en: 'Display Name' },
          { fr: 'Type', en: 'Type' }, { fr: 'État', en: 'State' },
        ],
        rows: users.map(u => ctx.row([
          u.username || u.name, u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' '),
          ctx.f.label(u.userType), ctx.f.label(u.status || u.state),
        ], 'api')),
      };
    },
  },
];

// ─── Ports physiques d'un nœud ────────────────────────────────────────────────

// Tout nœud Nutanix porte un port BMC dédié, à 1 GbE : il ne figure dans aucun inventaire d'hôte
// (le BMC n'est pas l'hyperviseur), mais il existe physiquement et se câble sur un autre switch
// que les uplinks de données. L'omettre du schéma des ports, c'est le faire câbler sur le ToR.
const IPMI_PORT = { name: 'IPMI', speed: '1G', role: 'ipmi' };

// Deux nœuds au même jeu de ports sont dessinés une fois. Le débit ET l'état du lien entrent dans
// la signature : un nœud dont un uplink est éteint n'a pas le même raccordement que ses voisins,
// et le fondre dans leur panneau masquerait exactement ce qu'on documente.
const PORT_PANELS_MAX = 12;

function groupPortPanels(perNode) {
  const panels = [];
  const index = new Map();
  for (const n of perNode) {
    const key = n.ports.map(p => `${p.name}|${p.speed}|${p.role}|${p.active}`).join('/');
    const known = index.get(key);
    if (known) { known.nodes.push(n.node); known.count += 1; continue; }
    const panel = { nodes: [n.node], count: 1, ports: n.ports };
    index.set(key, panel);
    panels.push(panel);
  }
  return panels;
}

/**
 * À défaut de relevé, le raccordement prévu : un uplink par switch ToR, au débit saisi, plus le
 * port IPMI. C'est la même lecture du Build que le schéma de câblage — sans nombre de ToR ni
 * débit, on ne dessine rien plutôt que d'inventer une façade arrière.
 */
function plannedPortPanels(ctx) {
  const speed = ctx.plan('portSpeed');
  const uplinks = Number(ctx.plan('torSwitches')) || 0;
  if (!speed || uplinks < 1) return null;
  return [{
    nodes: [],
    count: Number(ctx.plan('numberOfNodes')) || ctx.cluster.nodeCount || 0,
    ports: [
      IPMI_PORT,
      ...Array.from({ length: uplinks }, () => ({ name: null, speed, role: 'data', active: null })),
    ],
  }];
}

// ─── Chapitre Environment Build (par cluster) ─────────────────────────────────

const ENV_SECTIONS = [
  {
    id: 'env.site', chapter: 'env', kind: 'kv',
    title: { fr: "Détails d'implantation", en: 'Site Installation Details' },
    build: (ctx) => ({
      rows: [
        ctx.kv({ fr: 'Site / Datacenter', en: 'Site / Datacenter' }, null, ctx.plan('siteId')),
        ctx.kv({ fr: 'Nom du cluster', en: 'Cluster name' }, ctx.cluster.name, ctx.plan('clusterName')),
        ctx.kv({ fr: 'Modèle de déploiement', en: 'Deployment model' }, null, ctx.plan('deployment')?.model),
        ctx.kv({ fr: 'Modèle de nœud', en: 'Node make / model' }, ctx.cluster.blockModel, ctx.plan('nodeModel')),
        ctx.kv({ fr: 'Nombre de nœuds', en: 'Number of nodes' }, ctx.cluster.nodeCount, ctx.plan('numberOfNodes')),
      ],
    }),
  },
  {
    id: 'env.overview', chapter: 'env', kind: 'diagram',
    title: { fr: "Vue d'ensemble du cluster", en: 'High Level Overview' },
    build: (ctx) => ({
      data: {
        shape: 'cluster-card',
        cluster: {
          name: ctx.cluster.name, site: ctx.plan('siteId'),
          hypervisor: ctx.cluster.hypervisor, hypervisorVersion: ctx.cluster.hypervisorVersion,
          aos: ctx.cluster.aosVersion, cores: ctx.cluster.cpuCores,
          memoryGb: ctx.cluster.memoryGb, storageTb: ctx.cluster.storageTb,
        },
        nodes: ctx.cluster.nodes.map(n => ({
          name: n.name, cores: n.cores, memoryGb: n.memoryGb, storageTb: n.storageTb,
        })),
      },
    }),
  },
  {
    id: 'env.nodeports', chapter: 'env', kind: 'diagram',
    title: { fr: 'Schéma des ports physiques', en: 'Node Physical Port Layout' },
    // Un port se décrit par son débit ET sa fonction : le port IPMI n'est pas un uplink de
    // données. Les deux relevés côte à côte, c'est ce qui permet de câbler le nœud sans ouvrir
    // le schéma de câblage en même temps.
    build: (ctx) => {
      const measured = ctx.cluster.nodePorts.filter(n => n.ports.length);
      const panels = measured.length
        ? groupPortPanels(measured.map(n => ({
          node: n.node,
          ports: [IPMI_PORT, ...n.ports.map(p => ({ ...p, role: 'data' }))],
        })))
        : plannedPortPanels(ctx);
      if (!panels || !panels.length) return null;
      return {
        data: {
          shape: 'node-ports',
          nodeModel: ctx.cluster.blockModel || ctx.plan('nodeModel'),
          panels: panels.slice(0, PORT_PANELS_MAX),
          hidden: Math.max(0, panels.length - PORT_PANELS_MAX),
        },
      };
    },
  },
  {
    id: 'env.cabling', chapter: 'env', kind: 'diagram',
    title: { fr: 'Schéma de câblage', en: 'Network Cabling Diagram' },
    build: (ctx) => {
      const tor = ctx.plan('torSwitches');
      if (!tor && !ctx.cluster.nodes.length) return null;
      return {
        data: {
          shape: 'cabling',
          nodes: ctx.cluster.nodes.length || Number(ctx.plan('numberOfNodes')) || 0,
          nodeModel: ctx.plan('nodeModel') || ctx.cluster.blockModel,
          tor: { count: Number(tor) || 0, model: ctx.plan('switchModel'), mode: ctx.plan('switchMode'), speed: ctx.plan('portSpeed') },
          ipmi: { speed: '1G' },
        },
      };
    },
  },
  {
    id: 'env.portlayout', chapter: 'env', kind: 'kv',
    title: { fr: 'Raccordement des ports', en: 'Node Port Layout' },
    build: (ctx) => ({
      rows: [
        ctx.kv({ fr: 'Modèle de nœud', en: 'Node model' }, ctx.cluster.blockModel, ctx.plan('nodeModel')),
        ctx.kv({ fr: 'Vitesse des ports de données', en: 'Data port speed' }, null, ctx.plan('portSpeed')),
        ctx.kv({ fr: 'Mode des switches', en: 'Switch mode' }, null, ctx.plan('switchMode')),
        ctx.kv({ fr: 'Port IPMI dédié', en: 'Dedicated IPMI port' }, null, '1GbE'),
      ],
    }),
  },
];

// ─── Chapitre Hypervisor Host Design (par cluster) ────────────────────────────

const HOST_SECTIONS = [
  {
    id: 'host.logical', chapter: 'host', kind: 'diagram',
    title: { fr: 'Conception logique', en: 'Logical Design' },
    // La conception logique montre la chaîne complète : le Prism Central qui pilote, le cluster
    // qu'il administre, et les nœuds qui le composent. Sans le PC en tête, le schéma décrit un
    // cluster isolé — ce qui n'est jamais la réalité d'une plateforme administrée.
    build: (ctx) => {
      const pcPlan = ctx.plan('pc') || {};
      if (!ctx.cluster.nodes.length && !ctx.pc.host) return null;
      return {
        data: {
          shape: 'logical-design',
          pc: {
            name: ctx.pc.name || pcPlan.name || null,
            host: ctx.pc.host || pcPlan.vip || pcPlan.ip1 || null,
            version: ctx.pc.version || null,
            mode: pcPlan.mode || null,
            deploymentType: pcPlan.deploymentType || null,
          },
          cluster: {
            name: ctx.cluster.name,
            hypervisor: ctx.cluster.hypervisor,
            vip: ctx.cluster.vip,
            rf: ctx.cluster.rf,
            nodeCount: ctx.cluster.nodes.length || ctx.cluster.nodeCount,
          },
          nodes: ctx.cluster.nodes.map(n => ({
            name: n.name, cores: n.cores, memoryGb: n.memoryGb, storageTb: n.storageTb,
            cvmIp: n.cvmIp,
          })),
        },
      };
    },
  },
  {
    id: 'host.addresses', chapter: 'host', kind: 'table',
    title: { fr: 'Adressage des hôtes', en: 'AHV Host Information' },
    keys: ['v4_hosts', 'hosts_v2'],
    build: (ctx) => ({
      columns: [
        { fr: 'Hôte', en: 'Hostname' }, { fr: 'IP CVM', en: 'CVM IP' },
        { fr: 'IP hyperviseur', en: 'Host IP' }, { fr: 'IP IPMI', en: 'IPMI IP' },
      ],
      rows: ctx.cluster.nodes.map(n => {
        const p = ctx.planNode(n.name);
        ctx.gapNode(n.name, 'cvmIp', p?.cvmIp, n.cvmIp);
        ctx.gapNode(n.name, 'hypervisorIp', p?.hypervisorIp, n.hostIp);
        ctx.gapNode(n.name, 'ipmiIp', p?.ipmiIp, n.ipmiIp);
        return ctx.row([n.name, n.cvmIp, n.hostIp, n.ipmiIp], n.fromApi ? 'api' : 'build');
      }),
    }),
  },
  {
    id: 'host.versions', chapter: 'host', kind: 'table',
    title: { fr: "Versions d'hyperviseur", en: 'Host Details' },
    keys: ['v4_hosts', 'hosts_v2'],
    build: (ctx) => ({
      columns: [{ fr: 'Hôte', en: 'Hostname' }, { fr: 'Version', en: 'Hypervisor Version' }],
      rows: ctx.cluster.nodes.map(n => ctx.row(
        [n.name, n.hypervisorVersion || ctx.plan('hypervisorVersion')],
        n.hypervisorVersion ? 'api' : (ctx.plan('hypervisorVersion') ? 'build' : 'absent'),
      )),
    }),
  },
  {
    id: 'host.mgmt', chapter: 'host', kind: 'table',
    title: { fr: 'Serveur de management', en: 'Management Server' },
    build: (ctx) => {
      const pcPlan = ctx.plan('pc') || {};
      const mgmt = ctx.cluster.managementServers;
      const rows = mgmt.length
        ? mgmt.map(m => ctx.row([m.type || 'Prism Central', m.ip, ctx.f.bool(!!m.registered)], 'api'))
        : [ctx.row(['Prism Central', pcPlan.vip || pcPlan.ip1 || ctx.pc.host, pcPlan.mode === 'attached' ? 'Attaché' : ''], pcPlan.ip1 || pcPlan.vip ? 'build' : 'absent')];
      return {
        columns: [{ fr: 'Type', en: 'Type' }, { fr: 'Adresse IP', en: 'IP Address' }, { fr: 'Enregistré', en: 'Registered' }],
        rows,
      };
    },
  },
  {
    id: 'host.model', chapter: 'host', kind: 'table',
    title: { fr: 'Modèles et numéros de série', en: 'Host Model Information' },
    keys: ['v4_hosts', 'hosts_v2'],
    build: (ctx) => ({
      columns: [{ fr: 'Hôte', en: 'Hostname' }, { fr: 'Modèle', en: 'Model' }, { fr: 'Numéro de série', en: 'Serial' }],
      rows: ctx.cluster.nodes.map(n => {
        const p = ctx.planNode(n.name);
        ctx.gapNode(n.name, 'serial', p?.serial, n.serial);
        return ctx.row([n.name, n.model, n.serial || p?.serial], n.fromApi ? 'api' : 'build');
      }),
    }),
  },
  {
    id: 'host.blocks', chapter: 'host', kind: 'table',
    title: { fr: 'Blocs', en: 'Blocks' },
    keys: ['v4_rackable_units'],
    build: (ctx) => {
      if (!ctx.cluster.blocks.length) return null;
      return {
        columns: [{ fr: 'Numéro de série', en: 'Block Serial' }, { fr: 'Modèle', en: 'Model' }, { fr: 'Rack', en: 'Rack' }, { fr: 'Nœuds', en: 'Nodes' }],
        rows: ctx.cluster.blocks.map(b => ctx.row([
          b.serial, b.model, b.rack, b.nodes.map(n => (n.position != null ? `${n.name} (${n.position})` : n.name)).join(', '),
        ], 'api')),
      };
    },
  },
  {
    id: 'host.cpumem', chapter: 'host', kind: 'table',
    title: { fr: 'CPU et mémoire', en: 'Host CPU and Memory' },
    keys: ['v4_hosts', 'hosts_v2'],
    build: (ctx) => ({
      columns: [
        { fr: 'Hôte', en: 'Hostname' }, { fr: 'Cœurs', en: 'CPU Cores' },
        { fr: 'Threads', en: 'CPU Threads' }, { fr: 'Mémoire', en: 'Memory' },
      ],
      rows: ctx.cluster.nodes.map(n => ctx.row(
        [n.name, n.cores, n.threads, n.memoryGb != null ? ctx.f.gb(n.memoryGb) : null],
        n.fromApi ? 'api' : 'build',
      )),
    }),
  },
  {
    id: 'host.bios', chapter: 'host', kind: 'table',
    title: { fr: 'BIOS et BMC', en: 'BIOS and BMC' },
    keys: ['v4_lcm_entities'],
    build: (ctx) => {
      if (!ctx.cluster.nodes.some(n => n.biosVersion || n.bmcVersion)) {
        // L'inventaire LCM a répondu mais ne décrit ni BIOS ni BMC : ce n'est pas « non configuré ».
        return ctx.cluster.firmware.length
          ? ctx.notCollected({ fr: "l'inventaire LCM ne décrit ni BIOS ni BMC pour ces hôtes", en: 'the LCM inventory lists no BIOS or BMC for these hosts' })
          : null;
      }
      return {
        columns: [
          { fr: 'Hôte', en: 'Hostname' }, { fr: 'Version BIOS', en: 'BIOS Version' },
          { fr: 'Version BMC', en: 'BMC Version' },
        ],
        rows: ctx.cluster.nodes.map(n => ctx.row([n.name, n.biosVersion, n.bmcVersion], 'api')),
      };
    },
  },
  {
    id: 'host.firmware', chapter: 'host', kind: 'table',
    title: { fr: 'Versions et firmwares', en: 'Versions and Firmware' },
    keys: ['v4_lcm_entities'],
    build: (ctx) => {
      const items = ctx.cluster.firmware;
      if (!items.length) return null;
      return {
        columns: [
          { fr: 'Nœud', en: 'Node' }, { fr: 'Composant', en: 'Component' },
          { fr: 'Modèle', en: 'Model' }, { fr: 'Type', en: 'Type' },
          { fr: 'Version', en: 'Version' }, { fr: 'Quantité', en: 'Count' },
        ],
        rows: items.map(i => ctx.row([
          i.node || 'Cluster', i.component, i.model, ctx.f.label(i.type), i.version, i.count,
        ], 'api')),
      };
    },
  },
];

// ─── Chapitre Nutanix Configuration (par cluster) ─────────────────────────────

const CFG_SECTIONS = [
  {
    id: 'cfg.cluster', chapter: 'cfg', kind: 'kv',
    title: { fr: 'Informations du cluster', en: 'Cluster Information' },
    build: (ctx) => ({
      rows: [
        ctx.kv({ fr: 'Nom', en: 'Cluster Name' }, ctx.cluster.name, ctx.plan('clusterName')),
        ctx.kv({ fr: 'UUID', en: 'Cluster UUID' }, ctx.cluster.uuid, null),
        ctx.kv({ fr: 'VIP', en: 'Cluster VIP' }, ctx.cluster.vip, ctx.plan('clusterVip')),
        ctx.kv({ fr: 'Data Services IP', en: 'Data Services IP' }, ctx.cluster.dsip, ctx.plan('dsip')),
        ctx.kv({ fr: 'Facteur de réplication', en: 'Cluster RF' }, ctx.cluster.rf, ctx.f.rf(ctx.plan('replicationFactor'))),
        ctx.kv({ fr: 'Fuseau horaire', en: 'Time Zone' }, ctx.cluster.timezone, ctx.plan('timeZone')),
        ctx.kv({ fr: 'Version AOS', en: 'AOS Version' }, ctx.cluster.aosVersion, ctx.plan('aosVersion')),
        ctx.kv({ fr: 'Version NCC', en: 'NCC Version' }, ctx.cluster.nccVersion, null),
        ctx.kv({ fr: 'Serveurs NTP', en: 'NTP Server(s)' }, ctx.f.joinList(ctx.cluster.ntp), ctx.plan('ntpServers'), { list: true }),
        ctx.kv({ fr: 'Serveurs DNS', en: 'DNS Server(s)' }, ctx.f.joinList(ctx.cluster.dns), ctx.plan('dnsServers'), { list: true }),
        // Liste blanche NFS (v4, plan #18) : seulement quand elle est configurée.
        ...((ctx.cluster.list('v4_clusters')[0]?.network?.nfsSubnetWhitelist || []).length
          ? [ctx.kv({ fr: 'Liste blanche NFS', en: 'NFS Whitelist' }, ctx.f.joinList(ctx.cluster.list('v4_clusters')[0].network.nfsSubnetWhitelist), null, { list: true })]
          : []),
      ],
    }),
  },
  {
    id: 'cfg.networks', chapter: 'cfg', kind: 'table',
    title: { fr: 'Réseaux', en: 'Networks' },
    keys: ['v4_subnets', 'networks_v2'],
    build: (ctx) => {
      const nets = ctx.cluster.networks;
      if (!nets.length) return null;
      return {
        columns: [
          { fr: 'Nom', en: 'Name' }, { fr: 'VLAN', en: 'VLAN ID' },
          { fr: 'Sous-réseau', en: 'Subnet IP' }, { fr: 'Préfixe', en: 'Prefix Length' },
        ],
        rows: nets.map(n => ctx.row([n.name, n.vlan, n.subnet, n.prefix], 'api')),
      };
    },
  },
  {
    id: 'cfg.vmnetworks', chapter: 'cfg', kind: 'table', defaultEnabled: false,
    title: { fr: 'Réseaux des VMs', en: 'VM Network Info' },
    keys: ['vms_v2', 'v4_vms'],
    build: (ctx) => {
      const vms = ctx.cluster.vms.filter(v => !v.isCvm);
      if (!vms.length) return null;
      return {
        columns: [
          { fr: 'VM', en: 'VM Name' }, { fr: 'Réseaux', en: 'VLANs' },
          { fr: 'Type de carte', en: 'NIC Type' }, { fr: 'Adresses IP', en: 'NIC IPs' },
        ],
        rows: vms.map(v => ctx.row([v.name, v.networks.join(', '), ctx.f.label(v.nicType), v.ips.join(', ')], 'api')),
      };
    },
  },
  {
    id: 'cfg.vswitches', chapter: 'cfg', kind: 'table',
    title: { fr: 'Réseau détaillé', en: 'Detailed Networking' },
    keys: ['v4_virtual_switches'],
    build: (ctx) => {
      const vs = ctx.cluster.vswitches;
      if (!vs.length) return null;
      return {
        columns: [
          { fr: 'Virtual switch', en: 'Virtual Switch' }, { fr: 'Nœud', en: 'Node' },
          { fr: 'Bridge', en: 'Bridge' }, { fr: 'Mode de bond', en: 'Bond Mode' },
          { fr: 'MTU', en: 'MTU' }, { fr: 'Uplinks', en: 'Uplinks' },
        ],
        rows: vs.map(v => ctx.row([
          v.name, v.node, v.bridge, ctx.f.label(v.bondMode), v.mtu, v.uplinks.join(', '),
        ], 'api')),
      };
    },
  },
  {
    id: 'cfg.bonds', chapter: 'cfg', kind: 'table',
    title: { fr: 'Bonds et uplinks', en: 'Uplink Bonds' },
    keys: ['v4_uplink_bonds'],
    build: (ctx) => {
      if (!ctx.cluster.bonds.length) return null;
      return {
        columns: [
          { fr: 'Bond', en: 'Bond' }, { fr: 'Nœud', en: 'Node' }, { fr: 'Virtual switch', en: 'Virtual Switch' },
          { fr: 'Mode', en: 'Mode' }, { fr: 'LACP', en: 'LACP' }, { fr: 'Interfaces', en: 'Interfaces' },
        ],
        rows: ctx.cluster.bonds.map(b => ctx.row([b.name, b.node, b.vswitch, ctx.f.label(b.type), ctx.f.label(b.lacp), b.nics.join(', ')], 'api')),
      };
    },
  },
  {
    id: 'cfg.segments', chapter: 'cfg', kind: 'table',
    title: { fr: 'Segmentation réseau', en: 'Network Segmentation' },
    keys: ['v4_network_segments'],
    build: (ctx) => {
      const segs = ctx.cluster.list('v4_network_segments');
      if (!segs.length) return null;
      return {
        columns: [
          { fr: 'Segment', en: 'Segment' }, { fr: 'Service', en: 'Service' }, { fr: 'VLAN', en: 'VLAN' },
          { fr: 'MTU', en: 'MTU' }, { fr: 'Interface CVM', en: 'CVM Interface' },
        ],
        rows: segs.map(g => ctx.row([g.name, ctx.f.label(g.serviceName), g.vlanId, g.mtu, g.cvmNetworkSegmentInterfaceName], 'api')),
      };
    },
  },
  {
    id: 'cfg.ha', chapter: 'cfg', kind: 'kv',
    title: { fr: 'Haute disponibilité', en: 'High Availability' },
    keys: ['ha_v2'],
    build: (ctx) => {
      const ha = ctx.cluster.one('ha_v2');
      if (!ha) return null;
      return {
        rows: [
          ctx.kv({ fr: 'État', en: 'HA State' }, ctx.f.label(ha.ha_state), null),
          ctx.kv({ fr: 'Bascule activée', en: 'Failover Enabled' }, ctx.f.bool(ha.failover_enabled), null),
          ctx.kv({ fr: 'Pannes d\'hôte tolérées', en: 'Host Failures Tolerated' }, ha.num_host_failures_to_tolerate, null),
          ctx.kv({ fr: 'Type de réservation', en: 'Reservation Type' }, ctx.f.label(ha.reservation_type), null),
        ],
      };
    },
  },
  {
    id: 'cfg.licensing', chapter: 'cfg', kind: 'kv',
    title: { fr: 'Licences du cluster', en: 'Cluster License' },
    keys: ['v4_license_entitlements', 'v4_license_compliances', 'license_v1'],
    build: (ctx) => {
      // v4 (licensing) d'abord : droits et conformité par cluster ; la v1 du PE complète.
      const lic = ctx.cluster.one('license_v1') || {};
      const ent = ctx.cluster.list('v4_license_entitlements')[0];
      const services = ctx.cluster.list('v4_license_compliances')[0]?.services || [];
      const en = ctx.lang === 'en';
      const rights = (ent?.details || []).map(d => [d.name || ctx.f.label(d.category), d.earliestExpiryDate && `${en ? 'expires' : 'échéance'} ${d.earliestExpiryDate}`].filter(Boolean).join(', '));
      const compliance = services.map(sv => `${sv.name} : ${ctx.f.label(sv.licenseType)}, ${sv.isCompliant ? (en ? 'compliant' : 'conforme') : (en ? 'not compliant' : 'non conforme')}`);
      // Lignes propres à la v1 : omises quand la v4 a répondu et que la v1 n'a rien à y mettre (PE
      // absent, ou licence v1 sans ces champs — vu sur pc.7.6 / AOS 7.6).
      const v1Has = [lic.licenseType, lic.type, lic.blockSerial, lic.expiryDate, lic.expiration].some(v => v != null);
      const v1Rows = (rows) => (v1Has || !(ent || services.length) ? rows : []);
      const violations = services.flatMap(sv => (sv.violations || []).map(v => `${ctx.f.label(v.type)}${v.startDate ? ` (${en ? 'since' : 'depuis le'} ${v.startDate})` : ''}`));
      return {
        rows: [
          ctx.kv({ fr: 'Licence', en: 'License' }, rights.join(' ; ') || lic.licenseName || lic.category, ctx.plan('nciLicense')),
          ...v1Rows([ctx.kv({ fr: 'Type', en: 'License Type' }, lic.licenseType || lic.type, null)]),
          ctx.kv({ fr: 'Enregistré', en: 'Registered' }, ent ? ctx.f.bool(ent.isRegistered) : null, null),
          ctx.kv({ fr: 'Conformité', en: 'Compliance' }, compliance.join(' ; ') || null, null),
          ctx.kv({ fr: 'Violations', en: 'Violations' }, violations.join(' ; ') || null, null),
          ...v1Rows([
            ctx.kv({ fr: 'Numéro de série du bloc', en: 'Block Serial Number' }, lic.blockSerial, null),
            ctx.kv({ fr: 'Échéance', en: 'Expiration' }, lic.expiryDate || lic.expiration, null),
          ]),
          ctx.kv({ fr: 'Licence NCM', en: 'NCM license' }, null, ctx.plan('ncmLicense')),
        ],
      };
    },
  },
  {
    id: 'cfg.containers', chapter: 'cfg', kind: 'table',
    title: { fr: 'Containers de stockage', en: 'Storage Containers' },
    keys: ['v4_storage_containers', 'storage_containers_v2'],
    build: (ctx) => {
      const cs = ctx.cluster.containers;
      if (!cs.length) return null;
      return {
        columns: [
          { fr: 'Container', en: 'Container Name' }, { fr: 'Capacité utile max', en: 'Max Usable Capacity' },
          { fr: 'Capacité brute', en: 'Total Raw Capacity' }, { fr: 'Capacité réservée', en: 'Reserved Capacity' },
        ],
        rows: cs.map(c => ctx.row([
          c.name,
          c.maxCapacityTb != null ? ctx.f.tb(c.maxCapacityTb) : null,
          c.rawCapacityTb != null ? ctx.f.tb(c.rawCapacityTb) : null,
          c.reservedTb != null ? ctx.f.tb(c.reservedTb) : null,
        ], 'api')),
      };
    },
  },
  {
    id: 'cfg.containeropts', chapter: 'cfg', kind: 'table',
    title: { fr: 'Options des containers', en: 'Container Options' },
    keys: ['v4_storage_containers', 'storage_containers_v2'],
    build: (ctx) => {
      const cs = ctx.cluster.containers;
      if (!cs.length) return null;
      return {
        columns: [
          { fr: 'Container', en: 'Container Name' }, { fr: 'RF', en: 'RF' },
          { fr: 'Compression', en: 'Compression' }, { fr: 'Dédup SSD', en: 'SSD Dedup' },
          { fr: 'Dédup HDD', en: 'HDD Dedup' }, { fr: 'Erasure coding', en: 'Erasure Coding' },
        ],
        rows: cs.map(c => ctx.row([
          c.name, c.rf, ctx.f.bool(c.compression), ctx.f.onOff(c.ssdDedup),
          ctx.f.onOff(c.hddDedup), ctx.f.onOff(c.erasureCoding),
        ], 'api')),
      };
    },
  },
  {
    id: 'cfg.storageconfig', chapter: 'cfg', kind: 'kv',
    title: { fr: 'Résilience du stockage', en: 'Storage Resiliency' },
    keys: ['v4_storage_config'],
    build: (ctx) => {
      const c = ctx.cluster.list('v4_storage_config')[0];
      if (!c) return null;
      const pct = (v) => (v != null && v >= 0 ? `${v} %` : null);
      return {
        rows: [
          ctx.kv({ fr: 'Réserve de reconstruction', en: 'Rebuild Capacity Reservation' }, ctx.f.bool(c.isRebuildReservationEnabled), null),
          ctx.kv({ fr: 'Seuil d\'alerte de capacité résiliente', en: 'Resilient Capacity Warning Threshold' }, pct(c.resilientCapacityWarningThresholdPercentage), null),
          ctx.kv({ fr: 'Seuil de surallocation', en: 'Over-Provisioning Caution Threshold' }, pct(c.storageOverProvisioningCautionThreshold), null),
          ctx.kv({ fr: 'RF1 autorisé', en: 'RF1 Enabled' }, ctx.f.bool(c.isRf1Enabled), null),
          ctx.kv({ fr: 'Résilience pendant la maintenance', en: 'Delayed Maintenance Resiliency' }, ctx.f.bool(c.isDelayedMaintenanceResiliencyEnabled), null),
        ],
      };
    },
  },
  {
    id: 'cfg.pools', chapter: 'cfg', kind: 'table',
    title: { fr: 'Pools de stockage', en: 'Storage Pools' },
    keys: ['v4_disks', 'storage_pools_v2'],
    build: (ctx) => {
      // La v4 n'a pas d'objet pool : identifiant, capacité et nombre de disques viennent des disques
      // v4 ; le nom et le seuil ILM, du Prism Element quand il est fourni.
      const v2 = ctx.cluster.list('storage_pools_v2');
      const pools = ctx.cluster.storagePools.length
        ? ctx.cluster.storagePools.map(p => {
          const pe = v2.find(x => (x.storagePoolUuid || x.uuid) === p.id) || (v2.length === 1 && ctx.cluster.storagePools.length === 1 ? v2[0] : {});
          return { ...pe, storagePoolUuid: p.id, capacity: pe.capacity ?? (p.capacityTb != null ? p.capacityTb * 1024 ** 4 : null) };
        })
        : v2;
      if (!pools.length) return null;
      return {
        columns: [
          { fr: 'Nom', en: 'Name' }, { fr: 'Identifiant', en: 'Storage Pool ID' },
          { fr: 'Capacité max', en: 'Max Capacity' }, { fr: 'Seuil ILM', en: 'ILM Threshold' },
        ],
        rows: pools.map(p => ctx.row([
          p.name, p.storagePoolUuid || p.uuid,
          p.capacity != null ? ctx.f.tb(p.capacity / 1024 ** 4) : null,
          p.ilmDownMigratePctThreshold ?? p.ilm_down_migrate_pct_threshold,
        ], 'api')),
      };
    },
  },
  {
    id: 'cfg.disks', chapter: 'cfg', kind: 'table',
    title: { fr: 'Disques', en: 'Disk Information' },
    keys: ['disks_v2', 'v4_disks'],
    build: (ctx) => {
      const disks = ctx.cluster.disks;
      if (!disks.length) return null;
      return {
        columns: [
          { fr: 'Nœud', en: 'Node Name' }, { fr: 'Palier', en: 'Storage Tier' },
          { fr: 'Numéro de série', en: 'Serial Number' }, { fr: 'Taille', en: 'Disk Size' },
          { fr: 'État', en: 'Disk Status' },
        ],
        rows: disks.map(d => ctx.row([
          d.node, d.tier, d.serial,
          d.sizeGb != null ? ctx.f.gb(d.sizeGb) : null, ctx.f.label(d.status),
        ], 'api')),
      };
    },
  },
  {
    id: 'cfg.diskcapacity', chapter: 'cfg', kind: 'table', defaultEnabled: false,
    title: { fr: 'Capacité par disque', en: 'Capacity per Disk' },
    keys: ['disks_v2', 'v4_disks'],
    build: (ctx) => {
      const disks = ctx.cluster.disks.filter(d => d.usageGb != null);
      if (!disks.length) return null;
      return {
        columns: [
          { fr: 'Numéro de série', en: 'Serial Number' }, { fr: 'Capacité', en: 'Storage Capacity' },
          { fr: 'Utilisé', en: 'Storage Usage' }, { fr: 'Libre', en: 'Storage Free' },
        ],
        rows: disks.map(d => ctx.row([
          d.serial, ctx.f.gb(d.sizeGb), ctx.f.gb(d.usageGb),
          d.sizeGb != null && d.usageGb != null ? ctx.f.gb(d.sizeGb - d.usageGb) : null,
        ], 'api')),
      };
    },
  },
  {
    id: 'cfg.cvm', chapter: 'cfg', kind: 'table',
    title: { fr: 'Configuration des CVMs', en: 'Controller VM Settings' },
    keys: ['v4_cvms', 'cvms_v1', 'v4_hosts', 'hosts_v2', 'vms_v2'],
    // La mémoire d'une CVM se lit dans clustermgmt v4 (`/clusters/{id}/cvms`). Son vCPU, non : le
    // `numVcpus` v4 n'est pas fiable (cf. normalize.js), il vient du Prism Element (v1) quand il est
    // fourni. Ce que l'API ne rend pas, la saisie du Build le complète, sans quoi la colonne
    // resterait vide sur la majorité des clusters.
    build: (ctx) => ({
      columns: [
        { fr: 'CVM', en: 'CVM' }, { fr: 'Mémoire', en: 'Memory' },
        { fr: 'vCPU', en: 'vCPU' }, { fr: 'Adresse IP', en: 'IP Address' },
      ],
      rows: ctx.cluster.cvms.map(c => ctx.row([
        c.name,
        c.memoryGb != null ? ctx.f.gb(c.memoryGb) : ctx.f.withUnit(ctx.plan('cvmRam'), 'gb'),
        c.vcpu ?? ctx.plan('cvmVcpu'),
        c.ip,
      ], c.fromApi ? 'api' : 'build')),
    }),
  },
  {
    id: 'cfg.snmp', chapter: 'cfg', kind: 'table', defaultEnabled: false,
    title: { fr: 'SNMP', en: 'SNMP' },
    keys: ['snmp_v1', 'v4_snmp'],
    build: (ctx) => {
      const snmp = ctx.cluster.one('snmp_v1') || {};
      const v4 = ctx.cluster.list('v4_snmp');
      const users = v4.length ? v4 : (snmp.snmpUsers || snmp.users || []);   // v1 : `snmpUsers`
      if (!users.length) return null;
      return {
        columns: [{ fr: 'Utilisateur', en: 'Username' }, { fr: 'Confidentialité', en: 'Privacy Type' }, { fr: 'Authentification', en: 'Auth Type' }],
        rows: users.map(u => ctx.row([u.username || u.name, u.privType || u.privacyType, u.authType], 'api')),
      };
    },
  },
  {
    id: 'cfg.snmptraps', chapter: 'cfg', kind: 'table', defaultEnabled: false,
    title: { fr: 'Traps SNMP', en: 'SNMP Traps' },
    keys: ['v4_snmp_traps'],
    build: (ctx) => {
      const all = ctx.cluster.list('v4_snmp_traps');
      if (!all.length) return null;
      const en = ctx.lang === 'en';
      return {
        columns: [
          { fr: 'Type', en: 'Type' }, { fr: 'Destination', en: 'Destination' }, { fr: 'Port', en: 'Port' },
          { fr: 'Protocole', en: 'Protocol' }, { fr: 'Version', en: 'Version' }, { fr: 'Utilisateur', en: 'Username' },
        ],
        rows: all.map(t => (t.kind === 'trap'
          ? ctx.row([t.inform ? 'Inform' : 'Trap', [t.receiver, addr(t.address)].filter(Boolean).join(' — '), t.port, t.protocol, t.version, t.username], 'api')
          : ctx.row([en ? 'Listener' : 'Écoute', '', t.port, t.protocol, '', ''], 'api'))),
      };
    },
  },
  {
    id: 'cfg.smtp', chapter: 'cfg', kind: 'kv',
    title: { fr: 'SMTP', en: 'SMTP' },
    keys: ['v4_clusters', 'cluster_v2'],
    build: (ctx) => {
      const v4 = ctx.cluster.list('v4_clusters')[0]?.network?.smtpServer;
      const v2 = ctx.cluster.one('cluster_v2')?.smtp_server;
      if (!v4?.server && !v2) return null;
      const smtp = v4?.server
        ? { address: addr(v4.server.ipAddress), port: v4.server.port, mode: v4.type, from: v4.emailAddress }
        : { address: v2.address, port: v2.port, mode: v2.secure_mode, from: v2.from_email_address };
      return {
        rows: [
          ctx.kv({ fr: 'Serveur', en: 'Host Name' }, smtp.address, null),
          ctx.kv({ fr: 'Port', en: 'Port' }, smtp.port, null),
          ctx.kv({ fr: 'Sécurité', en: 'Security Mode' }, ctx.f.label(smtp.mode), null),
          ctx.kv({ fr: 'Expéditeur', en: 'From Email Address' }, smtp.from, null),
        ],
      };
    },
  },
  {
    id: 'cfg.syslog', chapter: 'cfg', kind: 'table',
    title: { fr: 'Syslog', en: 'Remote Syslog' },
    keys: ['v4_rsyslog'],
    build: (ctx) => {
      const srv = ctx.cluster.list('v4_rsyslog');
      if (!srv.length) return null;
      return {
        columns: [
          { fr: 'Serveur', en: 'Server' }, { fr: 'Adresse', en: 'Address' }, { fr: 'Port', en: 'Port' },
          { fr: 'Protocole', en: 'Protocol' }, { fr: 'Modules', en: 'Modules' },
        ],
        rows: srv.map(r => ctx.row([
          r.serverName, addr(r.ipAddress), r.port, r.networkProtocol,
          (r.modules || []).map(m => `${m.name} (${m.logSeverityLevel})`).join(', '),
        ], 'api')),
      };
    },
  },
  {
    id: 'cfg.proxy', chapter: 'cfg', kind: 'table',
    title: { fr: 'Proxy HTTP', en: 'HTTP Proxy' },
    keys: ['v4_clusters', 'cluster_v2'],
    build: (ctx) => {
      const v4 = (ctx.cluster.list('v4_clusters')[0]?.network?.httpProxyList || [])
        .map(p => ({ name: p.name, address: addr(p.ipAddress), port: p.port, proxy_types: p.proxyTypes, username: p.username }));
      const proxies = v4.length ? v4 : (ctx.cluster.one('cluster_v2')?.http_proxies || []);
      if (!proxies.length) return null;
      return {
        columns: [
          { fr: 'Nom', en: 'Name' }, { fr: 'Adresse', en: 'Address' }, { fr: 'Port', en: 'Port' },
          { fr: 'Types', en: 'Proxy Types' }, { fr: 'Utilisateur', en: 'Username' },
        ],
        rows: proxies.map(p => ctx.row([p.name, p.address, p.port, (p.proxy_types || []).join(', '), p.username], 'api')),
      };
    },
  },
  {
    id: 'cfg.certificate', chapter: 'cfg', kind: 'kv',
    title: { fr: 'Certificat SSL', en: 'SSL Certificate' },
    keys: ['v4_ssl_certificates'],
    build: (ctx) => {
      const cert = ctx.cluster.list('v4_ssl_certificates')[0];
      if (!cert) return null;
      return {
        rows: [
          ctx.kv({ fr: 'Sujet', en: 'Subject' }, cert.subject, null),
          ctx.kv({ fr: 'Émetteur', en: 'Issuer' }, cert.issuer, null),
          ctx.kv({ fr: 'Valide du', en: 'Valid From' }, cert.validFrom, null),
          ctx.kv({ fr: "Valide jusqu'au", en: 'Valid To' }, cert.validTo, null),
          ctx.kv({ fr: 'Algorithme de clé', en: 'Key Algorithm' }, cert.keyAlgorithm, null),
        ],
      };
    },
  },
  {
    id: 'cfg.encryption', chapter: 'cfg', kind: 'kv',
    title: { fr: 'Chiffrement', en: 'Encryption' },
    keys: ['dare_v1', 'v4_clusters', 'v4_disks', 'v4_key_management_servers', 'cluster_v2'],
    build: (ctx) => {
      // v4 d'abord, quand le champ est présent ; sinon la v2 du PE ; sinon « non activé » (la v4 omet
      // ce qui n'est pas configuré, vu sur pc.7.6). Exception, le chiffrement au repos : dès que la v4
      // a répondu, elle seule fait foi — `cluster_v2.encrypted` vaut true sur un cluster sans aucun
      // chiffrement (AOS 7.6, confirmé sur le lab) ; il ne sert plus que sans v4.
      const cfg = ctx.cluster.list('v4_clusters')[0]?.config;
      const v2 = ctx.cluster.one('cluster_v2');
      const cl = v2 || {};
      if (!cfg && !v2) return null;
      const options = [].concat(cfg?.encryptionOption || []);
      // Exception à « v4 d'abord » (plan #19) : avec le PE, `/v1/data_at_rest_encryption` donne l'état
      // réel (portée logicielle, mot de passe des SED, conteneurs et disques chiffrés).
      const dare = ctx.cluster.one('dare_v1');
      const dareOn = dare && (dare.desiredPasswordProtection === true
        || (dare.softwareEncryptionScope && !/^(none|null)$/i.test(String(dare.softwareEncryptionScope)))
        || Object.values(dare.storageContainerEncryptionStatus || {}).some(Boolean)
        || Object.values(dare.diskEncryptionStatus || {}).some(Boolean));
      const atRest = dare
        ? (dareOn ? (dare.softwareEncryptionScope ? `${ctx.f.bool(true)} (${ctx.f.label(dare.softwareEncryptionScope)})` : ctx.f.bool(true)) : ctx.f.bool(false))
        : options.length ? options.map(o => ctx.f.label(o)).join(', ') : ctx.f.bool(!cfg && !!cl.encrypted);
      const disks = ctx.cluster.list('v4_disks');
      const sed = disks.some(d => d.diskAdvanceConfig?.isSelfEncryptingDrive != null)
        ? disks.some(d => d.diskAdvanceConfig?.isSelfEncryptingDrive === true) : !!cl.has_self_encrypting_drive;
      const inTransit = cfg?.encryptionInTransitStatus
        ? cfg.encryptionInTransitStatus === 'ENABLED' : !!cl.data_in_transit_encryption_dto?.enabled;
      const kms = ctx.pc.list('v4_key_management_servers').map(k => k.name).filter(Boolean);
      const encrypted = [
        ...ctx.cluster.list('v4_storage_containers').filter(c => c.isSoftwareEncryptionEnabled),
        ...ctx.cluster.list('storage_containers_v2').filter(c => c.enable_software_encryption),
      ].map(c => c.name);
      const none = ctx.lang === 'en' ? 'None' : 'Aucun';
      return {
        rows: [
          ctx.kv({ fr: 'Données au repos', en: 'Data-at-Rest Encryption' }, atRest, null),
          ...(cfg?.encryptionScope ? [ctx.kv({ fr: 'Portée', en: 'Scope' }, ctx.f.label(cfg.encryptionScope), null)] : []),
          ctx.kv({ fr: 'Disques auto-chiffrants', en: 'Self-Encrypting Drives' }, ctx.f.bool(sed), null),
          ctx.kv({ fr: 'Containers chiffrés (logiciel)', en: 'Software-Encrypted Containers' }, [...new Set(encrypted)].join(', ') || none, null),
          ctx.kv({ fr: 'Données en transit', en: 'Data-in-Transit Encryption' }, ctx.f.bool(inTransit), null),
          ...(kms.length ? [ctx.kv({ fr: 'Serveurs de clés (KMS)', en: 'Key Management Servers' }, kms.join(', '), null)] : []),
        ],
      };
    },
  },
  {
    id: 'cfg.auth', chapter: 'cfg', kind: 'table',
    title: { fr: 'Authentification', en: 'Authentication' },
    keys: ['auth_types_v1', 'auth_directories_v1', 'authconfig_v1'],
    build: (ctx) => {
      // Un snapshot d'audit peut ne porter que `authconfig_v1`, qui réunit les deux listes.
      const all = ctx.cluster.one('authconfig_v1') || {};
      const types = ctx.cluster.list('auth_types_v1').length ? ctx.cluster.list('auth_types_v1') : (all.authTypeList || []);
      const dirs  = ctx.cluster.list('auth_directories_v1').length ? ctx.cluster.list('auth_directories_v1') : (all.directoryList || []);
      if (!types.length && !dirs.length) return null;
      return {
        columns: [{ fr: 'Type', en: 'Type' }, { fr: 'Nom', en: 'Name' }, { fr: 'URL', en: 'Directory URL' }, { fr: 'Domaine', en: 'Domain' }],
        rows: [
          ...types.map(t => ctx.row([ctx.f.label(String(t)), '', '', ''], 'api')),
          ...dirs.map(d => ctx.row([ctx.f.label(d.directoryType || d.connectionType), d.name, d.directoryUrl, d.domain], 'api')),
        ],
      };
    },
  },
  {
    id: 'cfg.dataprotection', chapter: 'cfg', kind: 'table',
    title: { fr: 'Protection des données', en: 'Data Protection' },
    keys: ['protection_domains_v2', 'remote_sites_v2'],
    build: (ctx) => {
      const pds = ctx.cluster.list('protection_domains_v2');
      const rs  = ctx.cluster.list('remote_sites_v2');
      if (!pds.length && !rs.length) return null;
      return {
        columns: [{ fr: 'Type', en: 'Type' }, { fr: 'Nom', en: 'Name' }, { fr: 'État', en: 'State' }, { fr: 'Détail', en: 'Detail' }],
        rows: [
          ...pds.map(p => ctx.row([
            'Protection domain', p.name, ctx.f.bool(p.active),
            `${(p.vms || []).length} VM · ${(p.cron_schedules || []).length} schedule(s)`,
          ], 'api')),
          ...rs.map(r => ctx.row([
            'Remote site', r.name, ctx.f.bool(r.cluster_id != null),
            Object.keys(r.remote_ip_ports || {}).join(', '),
          ], 'api')),
        ],
      };
    },
  },
  {
    id: 'cfg.witness', chapter: 'cfg', kind: 'table',
    title: { fr: 'Witness', en: 'Witness' },
    keys: ['metro_witness_v1'],
    build: (ctx) => {
      const w = ctx.cluster.list('metro_witness_v1');
      if (!w.length) return null;
      return {
        columns: [{ fr: 'Witness', en: 'Witness' }, { fr: 'Cluster', en: 'Cluster' }, { fr: 'Adresses', en: 'Addresses' }, { fr: 'Version', en: 'Version' }],
        rows: w.map(x => ctx.row([x.witnessName, x.clusterName, (x.ipAddresses || []).join(', '), x.nosFullVersion], 'api')),
      };
    },
  },
  {
    id: 'cfg.remotesupport', chapter: 'cfg', kind: 'kv', defaultEnabled: false,
    title: { fr: 'Support à distance', en: 'Remote Support' },
    keys: ['remote_support_v1'],
    build: (ctx) => {
      const r = ctx.cluster.one('remote_support_v1');
      if (!r) return null;
      return {
        rows: [
          ctx.kv({ fr: 'Activé', en: 'Enabled' }, ctx.f.bool(r.enabled), null),
          ctx.kv({ fr: 'État du tunnel', en: 'Tunnel Status' }, ctx.f.label(r.connectionStatus), null),
        ],
      };
    },
  },
  {
    id: 'cfg.unprotected', chapter: 'cfg', kind: 'table', defaultEnabled: false,
    title: { fr: 'VM non protégées', en: 'Unprotected VMs' },
    keys: ['unprotected_vms_v1'],
    build: (ctx) => {
      const vms = ctx.cluster.list('unprotected_vms_v1');
      if (!vms.length) return null;
      return {
        columns: [{ fr: 'VM', en: 'VM' }, { fr: 'Hôte', en: 'Host' }, { fr: 'État', en: 'Power State' }],
        rows: vms.map(v => ctx.row([v.vmName, v.hostName, ctx.f.label(v.powerState)], 'api')),
      };
    },
  },
  {
    id: 'cfg.alerts', chapter: 'cfg', kind: 'kv',
    title: { fr: 'Alertes', en: 'Alert Configuration' },
    keys: ['v4_clusters', 'alerts_config_v1'],
    build: (ctx) => {
      // Pulse se lit en v4 ; l'alerting e-mail propre au cluster n'existe qu'en v1 (PE). Celui du
      // Prism Central est au chapitre Prism Central.
      const cfg = ctx.cluster.one('alerts_config_v1');
      const pulse = ctx.cluster.list('v4_clusters')[0]?.config?.pulseStatus;
      const pulseOn = pulse?.isEnabled ?? ctx.cluster.one('pulse_v1')?.enable;
      if (!cfg && pulseOn == null) return null;
      return {
        rows: [
          ...(cfg ? [
            ctx.kv({ fr: 'Alertes activées', en: 'Alerts Enabled' }, ctx.f.bool(cfg.enable), null),
            ctx.kv({ fr: 'Digest quotidien', en: 'Email Digest Enabled' }, ctx.f.bool(cfg.enableEmailDigest), null),
          ] : []),
          ctx.kv({ fr: 'Pulse activé', en: 'Pulse Enabled' }, ctx.f.bool(pulseOn), null),
          ...(pulse?.piiScrubbingLevel ? [ctx.kv({ fr: 'Anonymisation Pulse', en: 'Pulse PII Scrubbing' }, ctx.f.label(pulse.piiScrubbingLevel), null)] : []),
          ...(cfg ? [ctx.kv({ fr: 'Destinataires', en: 'Email Contact List' }, ctx.f.joinList(cfg.emailContactList), null)] : []),
        ],
      };
    },
  },
];

// ─── Annexes ──────────────────────────────────────────────────────────────────

const ANNEX_SECTIONS = [
  {
    id: 'annex.collection', chapter: 'annex', kind: 'table',
    title: { fr: 'Journal de collecte', en: 'Collection Log' },
    build: (ctx) => ({
      columns: [
        { fr: 'Cible', en: 'Target' }, { fr: 'Source', en: 'Source' },
        { fr: 'Collecté le', en: 'Collected at' }, { fr: 'Collecteurs', en: 'Collectors' },
        { fr: 'Erreurs', en: 'Errors' },
      ],
      rows: ctx.collection.map(c => ctx.row([c.target, c.source, c.collectedAt, c.collectors, c.errors], 'api')),
    }),
  },
  {
    id: 'annex.gaps', chapter: 'annex', kind: 'table',
    title: { fr: 'Écarts prévu / constaté', en: 'Planned vs Actual' },
    build: (ctx) => ctx.gaps.length ? ({
      columns: [
        { fr: 'Cluster', en: 'Cluster' }, { fr: 'Objet', en: 'Entity' }, { fr: 'Champ', en: 'Field' },
        { fr: 'Prévu (Build)', en: 'Planned (Build)' }, { fr: 'Constaté', en: 'Actual' },
      ],
      rows: ctx.gaps.map(g => ctx.row([g.cluster, g.entity, g.field, g.planned, g.actual], 'api')),
    }) : { rows: [], emptyText: { fr: 'Aucun écart constaté', en: 'No gap found' } },
  },
];

export const SECTIONS = [...INTRO_SECTIONS, ...PC_SECTIONS, ...SEC_SECTIONS, ...ENV_SECTIONS, ...HOST_SECTIONS, ...CFG_SECTIONS, ...ANNEX_SECTIONS];

export const DEFAULT_ENABLED = SECTIONS.filter(s => s.defaultEnabled !== false).map(s => s.id);
