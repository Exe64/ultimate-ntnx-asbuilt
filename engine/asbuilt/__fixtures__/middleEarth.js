// Fixture de référence : les valeurs du document modèle
// « MiddleEarth-Nutanix_Cluster_As_Built_2024-07-17 », recopiées telles qu'elles y figurent.
//
// Elle sert d'oracle : le modèle doit reproduire les tableaux de ce document. Deux divergences
// sont plantées volontairement entre le prévu (Build) et le constaté (API) — la version AOS et
// la VIP — pour couvrir l'annexe des écarts, plus un cluster décrit mais absent du PC.

const GiB = 1024 ** 3;
const TiB = 1024 ** 4;

// 346.05 GB tel qu'affiché dans le document modèle.
const HOST_MEMORY_BYTES = Math.round(346.05 * GiB);

export const PC_HOST = '192.168.84.201';

const CLUSTER_UUID = '00061c09-6abd-7835-081e-a4bf0150cfca';
const HOST_UUID = 'e854cc31-0000-0000-0000-000000000001';

export const pcData = {
  v4_clusters: {
    data: [
      {
        extId: 'pc-0000-0000',
        name: 'NTNX-LAB-PC',
        config: { clusterFunction: ['PRISM_CENTRAL'], buildInfo: { version: 'pc.2023.1.0.1' } },
      },
      {
        extId: '00061c09-6abd-7835-081e-a4bf0150cfca',
        name: 'MiddleEarth',
        nodes: { numberOfNodes: 1 },
        config: {
          clusterFunction: ['AOS'], redundancyFactor: 2, timezone: 'UTC',
          buildInfo: { version: '6.5.2' },
        },
        network: {
          externalAddress: { ipv4: { value: '192.168.84.31' } },
          nameServerIpList: [{ ipv4: { value: '8.8.8.8' } }],
          ntpServerIpList: [{ fqdn: { value: '0.fr.pool.ntp.org' } }, { fqdn: { value: '1.fr.pool.ntp.org' } }],
        },
      },
    ],
  },
  v4_users: {
    data: [
      { username: 'admin', userType: 'LOCAL', status: 'ACTIVE' },
      { username: 'asbuilt', displayName: 'As-Built', userType: 'SERVICE_ACCOUNT', status: 'ACTIVE' },
      { username: 'frodo@shire.local', userType: 'LDAP', status: 'ACTIVE' },
    ],
  },
  // Les rôles livrés avec la plateforme sont mêlés à ceux créés pour le client.
  v4_roles: {
    data: [
      { displayName: 'Prism Admin', isSystemDefined: true, operations: ['op-1', 'op-2'] },
      {
        displayName: 'As-Built Reader', description: 'Rôle du compte de service',
        isSystemDefined: false, operations: ['op-1', 'op-2', 'op-3'],
        assignedUsersCount: 1, assignedUserGroupsCount: 0,
      },
    ],
  },
  v4_directory_services: { data: [] },
  v4_license_keys: { data: [] },
  v4_protection_policies: { data: [] },
  // Prism Central rend ses catégories prédéfinies (SYSTEM, INTERNAL) mêlées à celles du client :
  // le document ne doit lister que les secondes.
  v4_categories: {
    data: [
      { extId: 'cat-1', key: 'Environment', value: 'Production', description: 'Charge de production', type: 'USER' },
      { extId: 'cat-2', key: 'OSType', value: 'Windows', type: 'SYSTEM' },
      { extId: 'cat-3', key: 'AppFamily', value: 'Backup', type: 'INTERNAL' },
    ],
  },
};

export const clusterData = {
  cluster_v2: {
    name: 'MiddleEarth',
    uuid: '00061c09-6abd-7835-081e-a4bf0150cfca',
    cluster_external_ipaddress: '192.168.84.31',
    cluster_external_data_services_ipaddress: '192.168.84.32',
    cluster_redundancy_state: { current_redundancy_factor: 2, desired_redundancy_factor: 2 },
    timezone: 'UTC',
    ncc_version: 'ncc-4.6.6.3',
    version: '6.5.2',
    ntp_servers: ['0.fr.pool.ntp.org', '1.fr.pool.ntp.org'],
    name_servers: ['8.8.8.8'],
    hypervisor_types: ['kKvm'],
    num_nodes: 1,
    smtp_server: null,
    management_servers: [{ type: 'Prism Central', ip_address: '192.168.84.201', status: 'kConnected' }],
  },
  hosts_v2: {
    entities: [{
      uuid: HOST_UUID,
      name: 'NTNX-e854cc31-A',
      service_vmexternal_ip: '192.168.84.21',
      hypervisor_address: '192.168.84.11',
      ipmi_address: '192.168.84.1',
      block_model_name: 'CommunityEdition',
      serial: 'BQWL80251503',
      num_cpu_cores: 20,
      num_cpu_threads: 40,
      memory_capacity_in_bytes: HOST_MEMORY_BYTES,
      hypervisor_full_name: 'Nutanix 20220304.342',
      bios_version: null,
      bmc_version: null,
    }],
  },
  // Ports physiques du nœud : deux uplinks 10 GbE actifs, deux ports 1 GbE laissés libres.
  host_nics_v2: {
    entities: [
      nic('eth0', 10_000_000, 'Up'),
      nic('eth1', 10_000_000, 'Up'),
      nic('eth2', 1_000_000, 'Down'),
      nic('eth3', 1_000_000, 'Down'),
    ],
  },
  // Entité du Prism Central, telle que la projection la rattache au cluster.
  v4_virtual_switches: {
    data: [{
      name: 'vs0', bondMode: 'ACTIVE_BACKUP', mtu: 1500,
      clusters: [{
        extId: CLUSTER_UUID,
        hosts: [{ extId: HOST_UUID, internalBridgeName: 'br0', hostNics: ['eth0', 'eth1'] }],
      }],
    }],
  },
  // Les trois derniers sont créés par la plateforme pour ses propres services.
  storage_containers_v2: {
    entities: [
      cont('Nutanix_NTNX-Files_ctr', 3600),
      cont('NTNX-LAB-DEFAULT-CONTAINER', 0),
      cont('SelfServiceContainer', 0),
      cont('NutanixManagementShare', 0),
      cont('objectsl556705a3f09744fa62e6851c30d3f20e', 0),
    ],
  },
  storage_pools_v2: {
    entities: [{
      name: 'default-storage-pool-36429524023937',
      storagePoolUuid: '81e78ff3-6971-4f8e-bb7d-e59ed8641ddf',
      capacity: Math.round(12.19 * TiB),
      ilmDownMigratePctThreshold: 75,
    }],
  },
  disks_v2: {
    entities: [
      disk('S4CNNX0N803693N', 279.57, 20.00, 'SSD', '11'),
      disk('V6V2PDUA', 689.63, 20.56, 'SSD', '4'),
      disk('V6V2PDUB', 689.63, 20.11, 'SSD', '5'),
    ],
  },
  vms_v2: {
    entities: [
      {
        // 2 sockets de 4 cœurs : Prism annonce 8 vCPU, la somme des deux champs v2.
        name: 'NTNX-e854cc31-A-CVM', controller_vm: true, memory_mb: 20 * 1024,
        num_vcpus: 2, num_cores_per_vcpu: 4,
        vm_nics: [{ ip_address: '192.168.84.21', network_uuid: 'net-default', model: 'kNormalNic' }],
      },
      {
        name: 'NTNX-LAB-PC', controller_vm: false, memory_mb: 26 * 1024, num_vcpus: 6,
        vm_nics: [{ ip_address: '192.168.84.201', network_uuid: 'net-default', model: 'kNormalNic' }],
      },
      {
        name: 'VM-HYCU', controller_vm: false, memory_mb: 8 * 1024, num_vcpus: 4,
        vm_nics: [{ ip_address: '192.168.84.210', network_uuid: 'net-default', model: 'kNormalNic' }],
      },
    ],
  },
  networks_v2: {
    entities: [{ name: 'DEFAULT', uuid: 'net-default', vlan_id: 0, ip_config: {} }],
  },
  ha_v2: {
    ha_state: 'BestEffort', failover_enabled: true,
    num_host_failures_to_tolerate: 0, reservation_type: 'NoReservations',
  },
  license_v1: {
    licenseName: 'Community', licenseType: 'appliance',
    blockSerial: 'e854cc31', expiryDate: 'Never',
  },
  auth_types_v1: ['LOCAL'],
  auth_directories_v1: [],
  snmp_v1: { users: [] },
  alerts_config_v1: {
    enable: true, enableEmailDigest: true, emailContactList: ['nos-alerts@nutanix.com'],
  },
  pulse_v1: { enable: true },
  protection_domains_v2: { entities: [] },
  remote_sites_v2: { entities: [] },
};

function nic(name, kbps, status) {
  return {
    name,
    mac_address: `0c:c4:7a:00:0${name.slice(-1)}:01`,
    link_speed_in_kbps: kbps,
    link_status: status,
    _host_name: 'NTNX-e854cc31-A',
    _host_uuid: HOST_UUID,
  };
}

function cont(name, compressionDelay) {
  return {
    name,
    max_capacity: Math.round(12.19 * TiB),
    usage_stats: { 'storage.user_capacity_bytes': Math.round(6.09 * TiB) },
    total_explicit_reserved_capacity: 0,
    replication_factor: 2,
    compression_enabled: true,
    compression_delay_in_secs: compressionDelay,
    finger_print_on_write: 'off',
    on_disk_dedup: 'off',
    erasure_code: 'off',
  };
}

function disk(serial, sizeGb, usedGb, tier, location) {
  return {
    node_name: 'NTNX-e854cc31-A',
    storage_tier_name: tier,
    disk_hardware_config: { serial_number: serial, location },
    disk_size: Math.round(sizeGb * GiB),
    usage_stats: { 'storage.usage_bytes': Math.round(usedGb * GiB) },
    online: true,
    disk_status: 'NORMAL',
  };
}

// Inventaire LCM (lifecycle v4), tel que la projection le rattache au cluster. Le bundle de
// référence porte une collecte LCM en erreur : cet inventaire sert aux tests qui la réussissent.
const lcm = (entityClass, entityModel, entityType, entityVersion, uuid = HOST_UUID) => ({
  entityClass, entityModel, entityType, entityVersion, locationInfo: { uuid },
});
export const lcmEntities = [
  lcm('Core Cluster', 'AOS', 'SOFTWARE', '6.5.2', CLUSTER_UUID),
  lcm('BIOS', 'BIOS', 'FIRMWARE', '42.600'),
  lcm('BMC', 'BMC', 'FIRMWARE', '7.13'),
  lcm('Disks', 'SAMSUNG MZ7', 'FIRMWARE', 'GXT5104Q'),
  lcm('Disks', 'SAMSUNG MZ7', 'FIRMWARE', 'GXT5104Q'),
];

/** Bundle complet, tel que le backend le livrera au lot 4. */
export const bundle = {
  meta: { generatedAt: '2026-08-16T09:00:00.000Z' },
  pc: {
    host: PC_HOST,
    source: {
      kind: 'snapshot-pc', collectedAt: '2026-08-16T08:40:00.000Z', target: 'PC-LAB',
      collectors: { ok: 28, total: 30 }, errors: [{ key: 'v4_lcm_entities', error: '404' }],
    },
    data: pcData,
  },
  clusters: [{
    extId: '00061c09-6abd-7835-081e-a4bf0150cfca',
    name: 'MiddleEarth',
    planRef: 0,
    source: {
      kind: 'snapshot-pe', collectedAt: '2026-08-16T08:41:00.000Z', target: 'MiddleEarth',
      collectors: { ok: 33, total: 35 }, errors: [],
    },
    data: clusterData,
  }],
};

/** projects.build tel que l'onglet Build le persiste (multi-cluster). */
export const project = {
  name: 'Lab MiddleEarth',
  scoping: { engagement: { customer: 'ACME', documentTitle: 'Nutanix Migration' } },
  build: {
    clusters: [
      {
        cluster: {
          siteId: 'Gravelines', clusterName: 'MiddleEarth',
          // Écart planté n° 1 : le Build annonce 6.5.1, le cluster tourne en 6.5.2.
          aosVersion: '6.5.1',
          hypervisor: 'AHV', hypervisorVersion: 'AHV 20220304.342', cvmRam: '20 GB',
        },
        numberOfNodes: 1,
        nodeModel: 'CommunityEdition',
        cpuPerNode: '20 cœurs', ramPerNode: '384 Go', storagePerNode: '12 To',
        // Écart planté n° 2 : VIP saisie à côté de la réalité.
        clusterVip: '192.168.84.30',
        // Saisie avec son masque : même adresse que celle du cluster, ce n'est pas un écart.
        dsip: '192.168.84.32/24',
        replicationFactor: 'RF2 (FT1)',
        timeZone: 'UTC',
        dnsServers: '8.8.8.8',
        // Même contenu que l'API, dans l'autre ordre : ce n'est pas un écart.
        ntpServers: '1.fr.pool.ntp.org, 0.fr.pool.ntp.org',
        torSwitches: 2, switchModel: 'Arista DCS-7050SX-64', switchMode: 'LACP', portSpeed: '10G',
        nciLicense: 'Starter', ncmLicense: 'Starter',
        nodes: [{
          rackUnit: '1', serial: 'BQWL80251503', nodeId: 'A',
          ipmiMac: '0c:c4:7a:00:00:01',
          // Un secret n'a rien à faire dans un document qui circule : le modèle ne doit
          // jamais le lire. Valeur reconnaissable pour que le test le prouve.
          ipmiPass: 'SECRET-NE-DOIT-PAS-SORTIR',
          hypervisorHost: 'NTNX-e854cc31-A',
          ipmiIp: '192.168.84.1', hypervisorIp: '192.168.84.11', cvmIp: '192.168.84.21',
        }],
        pc: { mode: 'attached', attachedTo: '', ip1: '192.168.84.201' },
      },
      {
        // Cluster prévu, jamais déployé : documenté depuis le Build seul.
        cluster: { siteId: 'Roubaix', clusterName: 'Rivendell', aosVersion: '6.10.1' },
        numberOfNodes: 3, nodeModel: 'NX-3060-G8', portSpeed: '25G', torSwitches: 2,
        nodes: [],
        pc: { mode: 'attached' },
      },
    ],
  },
};
