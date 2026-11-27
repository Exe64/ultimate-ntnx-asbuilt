// Normalisation des données de collecte pour l'as-built.
//
// Une seule forme de sortie quelle que soit la génération d'API qui a répondu — même parti pris
// que backend/src/nutanixV4.js, pour la même raison : les sections du catalogue n'ont pas à
// savoir si la valeur vient de v4 (Prism Central), de v2 (Prism Element) ou de l'onglet Build.
//
// Priorité systématique : v4 (PC) → v2/v1 (PE) → Build. Le premier qui répond gagne, et la
// provenance suit la valeur jusqu'au document.

const GiB = 1024 ** 3;
const TiB = 1024 ** 4;

/** Les collecteurs renvoient tantôt {entities}, tantôt {data}, tantôt un tableau nu. */
export function asList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.entities)) return raw.entities;
  if (Array.isArray(raw.data)) return raw.data;
  return [];
}

/** v4 adresse les IP sous forme { ipv4: { value } } ; v2 les donne en chaîne. */
export function addr(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return entry || null;
  return entry.ipv4?.value || entry.ipv6?.value || entry.fqdn?.value || entry.value || null;
}

export const addrList = (list) => (Array.isArray(list) ? list : []).map(addr).filter(Boolean);

const gbOf = (bytes) => bytes == null ? null : +(bytes / GiB).toFixed(2);
const tbOf = (bytes) => bytes == null ? null : +(bytes / TiB).toFixed(2);

// ─── Nœuds ────────────────────────────────────────────────────────────────────

function nodeFromV4(h) {
  return {
    uuid: h.extId || null,
    name: h.hostName || h.name,
    // pc.7.6 rend ces adresses sous `externalAddress` ; `ip` reste lu pour les versions antérieures.
    cvmIp: addr(h.controllerVm?.externalAddress) || addr(h.controllerVm?.ip) || addr(h.controllerVm?.ipv4),
    hostIp: addr(h.hypervisor?.externalAddress) || addr(h.hypervisor?.ip) || addr(h.hostIp),
    ipmiIp: addr(h.ipmi?.ip),
    model: h.rackableUnitModel || h.blockModel || null,
    serial: h.blockSerial || h.serialNumber || null,
    cores: h.numberOfCpuCores ?? null,
    threads: h.numberOfCpuThreads ?? null,
    memoryGb: gbOf(h.memorySizeBytes),
    storageTb: null,
    hypervisorVersion: h.hypervisor?.fullName || h.hypervisor?.version || null,
    biosVersion: h.biosVersion || null,
    bmcVersion: h.bmcVersion || null,
    fromApi: true,
  };
}

function nodeFromV2(h) {
  return {
    uuid: h.uuid || null,
    name: h.name,
    cvmIp: h.service_vmexternal_ip || h.controller_vm_backplane_ip || null,
    hostIp: h.hypervisor_address || null,
    ipmiIp: h.ipmi_address || null,
    model: h.block_model_name || h.rackable_unit_model || null,
    serial: h.serial || h.block_serial || null,
    cores: h.num_cpu_cores ?? null,
    threads: h.num_cpu_threads ?? null,
    memoryGb: gbOf(h.memory_capacity_in_bytes),
    storageTb: tbOf(h.usage_stats?.['storage.capacity_bytes']),
    hypervisorVersion: h.hypervisor_full_name || null,
    biosVersion: h.bios_version || null,
    bmcVersion: h.bmc_version || null,
    fromApi: true,
  };
}

// Le Build ne connaît ni les cœurs ni la mémoire par nœud (ils sont saisis pour le cluster
// entier, en texte libre) : ces colonnes restent vides plutôt que d'être inventées.
// `ipmiPass` n'est jamais lu — un as-built circule.
function nodeFromPlan(n) {
  return {
    uuid: null,
    name: n.hypervisorHost || n.nodeId || null,
    cvmIp: n.cvmIp || null,
    hostIp: n.hypervisorIp || null,
    ipmiIp: n.ipmiIp || null,
    model: null,
    serial: n.serial || null,
    cores: null, threads: null, memoryGb: null, storageTb: null,
    hypervisorVersion: null, biosVersion: null, bmcVersion: null,
    fromApi: false,
  };
}

// ─── Containers, disques, réseaux, VMs ────────────────────────────────────────

function containerFromV4(c) {
  return {
    name: c.name,
    maxCapacityTb: tbOf(c.maxCapacityBytes ?? c.maxPhysicalCapacityBytes),
    rawCapacityTb: tbOf(c.maxPhysicalCapacityBytes ?? c.maxCapacityBytes),
    reservedTb: tbOf(c.explicitReservedCapacityBytes),
    rf: c.replicationFactor ?? null,
    compression: c.compressionEnabled ?? null,
    ssdDedup: c.cacheDeduplication ?? null,
    hddDedup: c.onDiskDedup ?? null,
    erasureCoding: c.erasureCode ?? null,
  };
}

function containerFromV2(c) {
  return {
    name: c.name,
    maxCapacityTb: tbOf(c.usage_stats?.['storage.user_capacity_bytes'] ?? c.max_capacity),
    rawCapacityTb: tbOf(c.max_capacity),
    reservedTb: tbOf(c.total_explicit_reserved_capacity),
    rf: c.replication_factor ?? null,
    compression: c.compression_enabled ?? null,
    ssdDedup: c.finger_print_on_write ?? null,
    hddDedup: c.on_disk_dedup ?? null,
    erasureCoding: c.erasure_code ?? null,
  };
}

// Containers créés par la plateforme pour ses propres services (Self-Service, partage de
// management, Objects) : ils ne décrivent aucune décision d'installation.
const INTERNAL_CONTAINER = /^(SelfServiceContainer|NutanixManagementShare|objects[a-z]?[0-9a-f]{20,})$/i;

// Les noms de champs des disques v2 varient selon les versions d'AOS : on lit les alias
// connus plutôt qu'un seul, et une valeur absente reste absente.
function diskFromV2(d) {
  const hw = d.disk_hardware_config || {};
  return {
    node: d.node_name || d.host_name || null,
    tier: d.storage_tier_name || d.tier_name || null,
    serial: hw.serial_number || d.disk_serial_id || null,
    sizeGb: gbOf(d.disk_size ?? d.disk_size_bytes),
    usageGb: gbOf(d.usage_stats?.['storage.usage_bytes']),
    status: d.disk_status || (d.online === false ? 'OFFLINE' : 'NORMAL'),
    location: hw.location ?? d.location ?? null,
  };
}

function diskFromV4(d) {
  return {
    node: d.hostName || d.nodeName || null,
    tier: d.storageTier || d.tierName || null,
    serial: d.serialNumber || d.diskSerialId || null,
    sizeGb: gbOf(d.sizeInBytes ?? d.diskSizeBytes),
    usageGb: gbOf(d.usageBytes),
    status: d.diskStatus || d.status || null,
    location: d.location ?? null,
  };
}

// ─── Ports physiques d'un nœud ────────────────────────────────────────────────

// La vitesse négociée d'un lien se lit en v4 (`v4_host_nics.linkSpeedInKbps`, mesuré sur pc.7.6 :
// 10 000 000 sur le port branché, 0 sur les autres), et en v2 en secours (`host_nics_v2`). Un port
// dont la vitesse n'est pas remontée reste sans vitesse — c'est un port qu'on ne connaît pas, pas un
// port lent. L'état v4 (`interfaceStatus`) vaut 1 ou 0.
const isLinkUp = (v) => v === true || v === 1 || /^(up|1)$/i.test(String(v ?? ''));

export function speedLabel(kbps) {
  const n = Number(kbps);
  if (!Number.isFinite(n) || n <= 0) return null;
  const g = n / 1_000_000;
  if (g >= 1) return Number.isInteger(g) ? `${g}G` : `${g.toFixed(1)}G`;
  return `${Math.round(n / 1000)}M`;
}

const portFromV2 = (n) => ({
  name: n.name || null,
  speed: speedLabel(n.link_speed_in_kbps),
  active: n.link_status == null ? null : isLinkUp(n.link_status),
});

const portFromV4 = (n) => ({
  name: n.name || null,
  speed: speedLabel(n.linkSpeedInKbps),
  active: n.interfaceStatus == null ? null : isLinkUp(n.interfaceStatus),
});

/**
 * Ports physiques par nœud, dans l'ordre des nœuds du cluster puis des hôtes inconnus d'eux.
 * Le port IPMI n'en fait pas partie : il appartient au BMC, qu'aucun inventaire d'hôte ne liste.
 */
function nodePortsFrom(nicsV4, nicsV2, nodes) {
  // v4 d'abord ; la v2 ne complète que ce que la v4 n'a pas dit (port absent, champ vide).
  const byHost = new Map();
  const add = (n, toPort) => {
    const host = n._host_name || n.host_name || null;
    if (!host) return;
    if (!byHost.has(host)) byHost.set(host, []);
    const port = toPort(n);
    const prev = byHost.get(host).find(p => p.name === port.name);
    if (prev) { for (const k of Object.keys(port)) if (prev[k] == null) prev[k] = port[k]; }
    else byHost.get(host).push(port);
  };
  for (const n of nicsV4) add(n, portFromV4);
  for (const n of nicsV2) add(n, portFromV2);
  if (!byHost.size) return [];

  const ordered = nodes.map(n => n.name).filter(name => byHost.has(name));
  const extra = [...byHost.keys()].filter(name => !ordered.includes(name));
  return [...ordered, ...extra].map(node => ({
    node,
    // Tri par nom : deux collectes du même hôte doivent rendre le même schéma.
    ports: byHost.get(node).sort((a, b) => String(a.name).localeCompare(String(b.name))),
  }));
}

// ─── Inventaire LCM et virtual switches ───────────────────────────────────────

const isClass = (e, re) => re.test(String(e.entityClass ?? '')) || re.test(String(e.entityModel ?? ''));

/**
 * Inventaire LCM ramené à une ligne par (nœud, composant, modèle, version) : douze disques
 * identiques sur un nœud font une ligne et un compte, pas douze lignes. Une entité sans nœud
 * (AOS, NCC, Foundation) appartient au cluster : `node` reste nul.
 */
function firmwareFrom(entities, nodes) {
  const nodeName = new Map(nodes.filter(n => n.uuid).map(n => [n.uuid, n.name]));
  const groups = new Map();
  for (const e of entities) {
    const version = e.entityVersion || e.version;
    if (!version) continue;
    const item = {
      node: nodeName.get(e.locationInfo?.uuid) || null,
      component: e.entityClass || null,
      model: e.entityModel || null,
      type: e.entityType || null,
      version: String(version),
      count: 0,
    };
    const key = [item.node, item.component, item.model, item.version].join('|');
    if (!groups.has(key)) groups.set(key, item);
    groups.get(key).count += 1;
  }
  const rank = (i) => [i.node ?? '', i.component ?? '', i.model ?? ''].join('|');
  return [...groups.values()].sort((a, b) => rank(a).localeCompare(rank(b)));
}

/** Une ligne par (virtual switch, hôte) : c'est à cette maille que se lisent le bond et ses uplinks. */
function vswitchesFrom(list, clusterUuid, nodes, nodePorts) {
  const nodeName = new Map(nodes.filter(n => n.uuid).map(n => [n.uuid, n.name]));
  const speeds = new Map(nodePorts.map(n => [n.node, new Map(n.ports.map(p => [p.name, p.speed]))]));
  return list.flatMap(vs => {
    const base = { name: vs.name || null, bondMode: vs.bondMode || null, mtu: vs.mtu ?? null };
    const clusters = Array.isArray(vs.clusters) ? vs.clusters : [];
    const own = clusters.filter(c => c.extId === clusterUuid);
    const hosts = (own.length ? own : clusters).flatMap(c => c.hosts || []);
    if (!hosts.length) return [{ ...base, node: null, bridge: null, uplinks: [] }];
    return hosts.map(h => {
      const node = nodeName.get(h.extId) || h.extId || null;
      return {
        ...base, node, bridge: h.internalBridgeName || null,
        uplinks: (h.hostNics || []).map(nic => {
          const speed = speeds.get(node)?.get(nic);
          return speed ? `${nic} (${speed})` : String(nic);
        }),
      };
    });
  });
}

const networkFromV2 = (n) => ({
  name: n.name,
  vlan: n.vlan_id ?? null,
  subnet: n.ip_config?.network_address || null,
  prefix: n.ip_config?.prefix_length ?? null,
});

const networkFromV4 = (n) => ({
  name: n.name,
  vlan: n.networkId ?? null,
  subnet: addr(n.ipConfig?.[0]?.ipv4?.ipSubnet?.ip) || null,
  prefix: n.ipConfig?.[0]?.ipv4?.ipSubnet?.prefixLength ?? null,
});

// En v2, une carte de VM ne porte que l'UUID de son réseau : le nom est ailleurs, dans
// /networks. Sans cette résolution, la colonne « Réseaux » du document reste vide alors que
// l'information est là — c'est ce qui manquait jusqu'à la 4.14.2.
const vmFromV2 = (v, netNames = {}) => {
  const nics = v.vm_nics || [];
  const nameOf = (n) => netNames[n.network_uuid] || n.network_name || n.network_name_hint
    || (n.vlan_id != null ? `VLAN ${n.vlan_id}` : null);
  return {
    name: v.name,
    isCvm: !!v.controller_vm,
    memoryGb: v.memory_mb != null ? +(v.memory_mb / 1024).toFixed(2) : null,
    // En v2, `num_vcpus` compte les SOCKETS et `num_cores_per_vcpu` les cœurs de chacun : le
    // nombre de processeurs affectés est leur produit. Sans la multiplication, une CVM à 2 sockets
    // de 6 cœurs sortait à « 2 » — et le chemin v4 (numSockets × numCoresPerSocket) annonçait 12
    // pour la même machine, selon l'API qui avait répondu.
    vcpu: v.num_vcpus != null ? v.num_vcpus * (v.num_cores_per_vcpu || 1) : null,
    networks: nics.map(nameOf).filter(Boolean),
    // `model` vaut kNormalNic / kDirectNic selon la version ; on rend la forme du document
    // modèle (NORMAL_NIC) et on retombe sur la valeur brute si elle est inconnue.
    nicType: nicTypeOf(nics[0]),
    ips: nics.map(n => n.ip_address).filter(Boolean),
  };
};

function nicTypeOf(nic) {
  if (!nic) return null;
  const raw = nic.nic_type || nic.model || nic.type;
  if (!raw) return 'NORMAL_NIC';
  const s = String(raw).replace(/^k/, '');
  return s.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
}

const vmFromV4 = (v) => ({
  name: v.name,
  isCvm: false, // les CVM ne sont pas exposées par vmm v4
  memoryGb: v.memorySizeBytes != null ? gbOf(v.memorySizeBytes) : null,
  vcpu: (v.numSockets || 0) * (v.numCoresPerSocket || 0) || null,
  networks: (v.nics || []).map(n => n.networkInfo?.subnet?.name).filter(Boolean),
  nicType: (v.nics || [])[0]?.networkInfo?.nicType || null,
  ips: (v.nics || []).flatMap(n => (n.networkInfo?.ipv4Config?.ipAddress ? [addr(n.networkInfo.ipv4Config.ipAddress)] : [])).filter(Boolean),
});

// ─── Cluster ──────────────────────────────────────────────────────────────────

/**
 * Vue normalisée d'un cluster documenté.
 *
 * @param entry  élément de bundle.clusters : { extId, name, data, source, planRef }
 * @param plan   entrée correspondante de projects.build.clusters, ou {}
 */
export function normalizeCluster(entry, plan = {}) {
  const data = entry.data || {};
  const get = (key) => data[key];
  const list = (key) => asList(data[key]);
  const p = (key) => plan.cluster?.[key] ?? plan[key];

  const v4 = (list('v4_clusters')[0]) || null;
  const v2 = get('cluster_v2') || null;
  const cfg = v4?.config || {};
  const net = v4?.network || {};

  const hostsV4 = list('v4_hosts');
  const hostsV2 = list('hosts_v2');
  const planNodes = Array.isArray(plan.nodes) ? plan.nodes : [];

  // Un hôte lu en v2 porte des champs que v4 n'expose pas (threads, BIOS/BMC) : quand les
  // deux sources sont là, on fusionne au lieu de choisir, sur la clé du nom d'hôte.
  const byName = new Map();
  hostsV4.map(nodeFromV4).forEach(n => n.name && byName.set(n.name, n));
  hostsV2.map(nodeFromV2).forEach(n => {
    if (!n.name) return;
    const prev = byName.get(n.name);
    byName.set(n.name, prev ? mergeNode(prev, n) : n);
  });
  let nodes = [...byName.values()];
  if (!nodes.length) nodes = planNodes.map(nodeFromPlan).filter(n => n.name || n.cvmIp);

  const allContainers = list('v4_storage_containers').length
    ? list('v4_storage_containers').map(containerFromV4)
    : list('storage_containers_v2').map(containerFromV2);
  const containers = allContainers.filter(c => !INTERNAL_CONTAINER.test(c.name || ''));

  // BIOS et BMC : l'hôte les donne rarement, l'inventaire LCM presque toujours.
  const lcm = list('v4_lcm_entities');
  const firmware = firmwareFrom(lcm, nodes);
  const lcmVersion = (uuid, re) => lcm.find(e => e.locationInfo?.uuid === uuid && isClass(e, re))?.entityVersion || null;
  nodes = nodes.map(n => (!n.uuid || (n.biosVersion && n.bmcVersion)) ? n : {
    ...n,
    biosVersion: n.biosVersion || lcmVersion(n.uuid, /^bios/i),
    bmcVersion: n.bmcVersion || lcmVersion(n.uuid, /^bmc/i),
  });

  // Disques : v4 d'abord, la v2 complète par numéro de série (l'usage n'existe qu'en v2).
  const disksV2 = list('disks_v2').map(diskFromV2);
  const disks = list('v4_disks').length
    ? list('v4_disks').map(diskFromV4).map(d => mergeNode(d, disksV2.find(x => x.serial && x.serial === d.serial) || {}))
    : disksV2;

  // Capacité par nœud : somme des disques v4 du nœud ; la v2 (usage_stats de l'hôte) en secours.
  const diskBytesByNode = new Map();
  for (const d of list('v4_disks')) {
    if (d.nodeExtId && d.diskSizeBytes != null) diskBytesByNode.set(d.nodeExtId, (diskBytesByNode.get(d.nodeExtId) || 0) + d.diskSizeBytes);
  }
  nodes = nodes.map(n => (diskBytesByNode.has(n.uuid) ? { ...n, storageTb: tbOf(diskBytesByNode.get(n.uuid)) } : n));

  // Pools de stockage : la v4 n'a pas d'objet pool, seulement sa référence sur chaque disque. On en
  // tire l'identifiant, le nombre de disques et la capacité ; le nom et le seuil ILM viennent du PE.
  const poolsV4 = new Map();
  for (const d of list('v4_disks')) {
    if (!d.storagePoolExtId) continue;
    const pool = poolsV4.get(d.storagePoolExtId) || { id: d.storagePoolExtId, diskCount: 0, bytes: 0 };
    pool.diskCount += 1; pool.bytes += d.diskSizeBytes || 0;
    poolsV4.set(d.storagePoolExtId, pool);
  }
  const storagePools = [...poolsV4.values()].map(p => ({ id: p.id, diskCount: p.diskCount, capacityTb: tbOf(p.bytes) }));

  const networks = list('v4_subnets').length
    ? list('v4_subnets').map(networkFromV4)
    : list('networks_v2').map(networkFromV2);

  // Nom de réseau par UUID, alimenté par les deux générations d'API.
  const netNames = {};
  for (const n of list('networks_v2')) if (n.uuid) netNames[n.uuid] = n.name;
  for (const n of list('v4_subnets')) if (n.extId) netNames[n.extId] = n.name;

  const vmsV2 = list('vms_v2').map(v => vmFromV2(v, netNames));
  const vms = vmsV2.length ? vmsV2 : list('v4_vms').map(vmFromV4);

  // CVM : d'abord clustermgmt v4 (`/cvms`), complété par le PE, sinon ce que les hôtes déclarent.
  // Le `numVcpus` v4 n'est pas repris : sur pc.7.6 il vaut 1 pour une CVM que la v1 du PE (et Prism)
  // donne à 4 vCPU. Le vCPU vient donc du PE (v1 `/vms` filtré sur les CVM, ou v2 quand elle les rend).
  const cvmsFromVms = vmsV2.filter(v => v.isCvm).map(v => ({
    name: v.name, memoryGb: v.memoryGb, vcpu: v.vcpu, ip: v.ips[0] || null, fromApi: true,
  }));
  const cvmsV1 = list('cvms_v1');
  const cvmsV4 = list('v4_cvms').map(c => {
    const v2cvm = cvmsFromVms.find(x => x.name === c.name);
    const v1cvm = cvmsV1.find(x => x.vmName === c.name);
    return {
      name: c.name || null, memoryGb: gbOf(c.memorySizeBytes) ?? v2cvm?.memoryGb ?? null,
      vcpu: v1cvm?.numVCpus ?? v2cvm?.vcpu ?? null, ip: addr(c.ipAddress) || v2cvm?.ip || null, fromApi: true,
    };
  });
  const cvms = cvmsV4.length ? cvmsV4 : cvmsFromVms.length ? cvmsFromVms : nodes
    .filter(n => n.cvmIp)
    .map(n => ({ name: `${n.name}-CVM`, memoryGb: null, vcpu: null, ip: n.cvmIp, fromApi: n.fromApi }));

  const cpuCores = sum(nodes.map(n => n.cores));
  const memoryGb = sum(nodes.map(n => n.memoryGb));
  const storageTb = allContainers.length
    ? +Math.max(...allContainers.map(c => c.rawCapacityTb || 0)).toFixed(2) || null
    : null;
  const nodePorts = nodePortsFrom(list('v4_host_nics'), list('host_nics_v2'), nodes);

  const rfV4 = cfg.redundancyFactor
    ?? (cfg.faultToleranceState?.currentMaxFaultTolerance != null
      ? cfg.faultToleranceState.currentMaxFaultTolerance + 1 : null);

  return {
    uuid: entry.extId || v4?.extId || v2?.uuid || v2?.id || null,
    name: entry.name || v4?.name || v2?.name || p('clusterName') || null,
    hasApi: !!(v4 || v2 || hostsV4.length || hostsV2.length),
    vip: addr(net.externalAddress) || v2?.cluster_external_ipaddress || null,
    dsip: addr(net.externalDataServiceIp) || v2?.cluster_external_data_services_ipaddress || null,
    rf: rfV4 ?? v2?.cluster_redundancy_state?.current_redundancy_factor ?? null,
    timezone: cfg.timezone || v2?.timezone || null,
    aosVersion: cfg.buildInfo?.version || v2?.version || null,
    nccVersion: (cfg.clusterSoftwareMap || []).find(x => x.softwareType === 'NCC')?.version?.replace(/^ncc-/i, '')
      || v2?.ncc_version || null,
    ntp: addrList(net.ntpServerIpList).length ? addrList(net.ntpServerIpList) : (v2?.ntp_servers || []),
    dns: addrList(net.nameServerIpList).length ? addrList(net.nameServerIpList) : (v2?.name_servers || []),
    hypervisor: hypervisorLabel(v2, nodes),
    hypervisorVersion: nodes.find(n => n.hypervisorVersion)?.hypervisorVersion || null,
    blockModel: nodes.find(n => n.model)?.model || null,
    nodeCount: nodes.length || v4?.nodes?.numberOfNodes || v2?.num_nodes || null,
    cpuCores, memoryGb, storageTb,
    nodes, cvms, containers, disks, networks, vms, firmware, storagePools,
    vswitches: vswitchesFrom(list('v4_virtual_switches'), entry.extId || v4?.extId || v2?.uuid || null, nodes, nodePorts),
    nodePorts,
    managementServers: managementServers(net.managementServer, v2),
    one: get, list,
  };
}

function mergeNode(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b)) if (out[k] == null && b[k] != null) out[k] = b[k];
  return out;
}

function sum(values) {
  const known = values.filter(v => v != null);
  return known.length ? +known.reduce((s, v) => s + v, 0).toFixed(2) : null;
}

function hypervisorLabel(v2, nodes) {
  const types = v2?.hypervisor_types || [];
  if (types.includes('kKvm')) return 'AHV';
  if (types.length) return String(types[0]).replace(/^k/, '');
  return nodes.some(n => /nutanix|ahv/i.test(n.hypervisorVersion || '')) ? 'AHV' : null;
}

function managementServers(v4, v2) {
  // v4 : un seul serveur (le vCenter d'un cluster ESXi), `isRegistered` ; v2 en secours.
  if (v4?.ip) return [{ type: v4.type || null, ip: addr(v4.ip), registered: v4.isRegistered === true }];
  return (v2?.management_servers || []).map(m => ({
    type: m.type || null,
    ip: m.ip_address || null,
    registered: m.status === 'kConnected' || m.registered === true,
  }));
}
