// Parc fictif pour les schémas : un cluster de 4 nœuds dont les hôtes voient leurs switches
// (LLDP), un cluster de 3 nœuds qui ne les voit pas, et un troisième réduit à son inventaire.
const GiB = 1024 ** 3, TiB = 1024 ** 4;

const host = (cluster, i, model) => ({
  extId: `${cluster}-h${i}`, hostName: `${cluster}-ahv-${i}`, cluster: { extId: cluster },
  controllerVm: { ip: { ipv4: { value: `10.10.${cluster === 'paris' ? 1 : 2}.${20 + i}` } } },
  hypervisor: { ip: { ipv4: { value: `10.10.${cluster === 'paris' ? 1 : 2}.${10 + i}` } }, fullName: 'Nutanix 20230302.103003' },
  ipmi: { ip: { ipv4: { value: `10.10.9.${(cluster === 'paris' ? 10 : 20) + i}` } } },
  rackableUnitModel: model, blockSerial: `SN${cluster.toUpperCase().slice(0, 3)}00${i}`,
  numberOfCpuCores: 48, numberOfCpuThreads: 96, memorySizeBytes: 768 * GiB,
});

const cluster = (extId, name, vip, n) => ({
  extId, name, nodes: { numberOfNodes: n },
  config: { clusterFunction: ['AOS'], redundancyFactor: 2, timezone: 'Europe/Paris', buildInfo: { version: '7.0.1' } },
  network: { externalAddress: { ipv4: { value: vip } }, externalDataServiceIp: { ipv4: { value: vip.replace(/\d+$/, '51') } } },
});

const nic = (hostName, name, kbps, up, lldp = {}) => ({ _host_name: hostName, name, link_speed_in_kbps: kbps, link_status: up ? 'Up' : 'Down', ...lldp });

const parisHosts = [1, 2, 3, 4].map(i => host('paris', i, 'NX-8155-G9'));
const lyonHosts = [1, 2, 3].map(i => host('lyon', i, 'HPE DX380 Gen11'));
const containers = (tb) => ({ entities: [{ name: 'default-container', max_capacity: tb * TiB, replication_factor: 2 }, { name: 'SelfServiceContainer', max_capacity: tb * TiB, replication_factor: 2 }] });

const clusters = [cluster('paris', 'PAR-PROD-01', '10.10.1.50', 4), cluster('lyon', 'LYO-DR-01', '10.10.2.50', 3), cluster('lab', 'LAB-EDGE', '10.10.3.50', 1)];
const vswitches = [
  { extId: 'vs0', name: 'vs0', bondMode: 'ACTIVE_BACKUP', mtu: 1500, clusters: [
    { extId: 'paris', hosts: parisHosts.map(h => ({ extId: h.extId, internalBridgeName: 'br0', hostNics: ['eth2', 'eth3'] })) },
    { extId: 'lyon', hosts: lyonHosts.map(h => ({ extId: h.extId, internalBridgeName: 'br0', hostNics: ['eth0', 'eth1'] })) },
  ] },
  { extId: 'vs1', name: 'vs1-backup', bondMode: 'BALANCE_TCP', mtu: 9000, clusters: [
    { extId: 'paris', hosts: parisHosts.map(h => ({ extId: h.extId, internalBridgeName: 'br1', hostNics: ['eth4', 'eth5'] })) },
  ] },
];
const subnet = (c, name, vlan, vs, net) => ({
  name, networkId: vlan, clusterReference: c, virtualSwitchReference: vs,
  ...(net ? { ipConfig: [{ ipv4: { ipSubnet: { ip: { value: net }, prefixLength: 24 } } }] } : {}),
});
const parisSubnets = [
  subnet('paris', 'MGMT', 10, 'vs0', '10.10.1.0'), subnet('paris', 'PROD-WEB', 110, 'vs0', '10.20.110.0'),
  subnet('paris', 'PROD-APP', 120, 'vs0'), subnet('paris', 'PROD-DB', 130, 'vs0'), subnet('paris', 'DMZ', 200, 'vs0'),
  subnet('paris', 'VDI', 300, 'vs0'), subnet('paris', 'BACKUP', 900, 'vs1'),
];

export const bundle = {
  meta: { generatedAt: '2026-10-11T09:00:00.000Z' },
  pc: {
    host: 'pc.lab.example', source: { kind: 'live', collectors: { ok: 14, total: 14 }, errors: [] },
    data: {
      v4_clusters: { data: [{ extId: 'pc', name: 'PC-PROD', config: { clusterFunction: ['PRISM_CENTRAL'], buildInfo: { version: 'pc.7.3' } } }, ...clusters] },
      // PC en scale-out : trois VM, sans entrée de nœuds dans v4_clusters ; seules les plages d'IP le disent.
      v4_domain_managers: { data: [{ extId: 'dm', hostingClusterExtId: 'paris', nodeExtIds: ['n1', 'n2', 'n3'],
        config: { name: 'PC-PROD', size: 'LARGE', buildInfo: { version: 'pc.7.3' },
          resourceConfig: { numVcpus: 14, memorySizeBytes: 44 * 2 ** 30, dataDiskSizeBytes: 2500 * 2 ** 30 } },
        network: { externalAddress: { ipv4: { value: '10.10.1.40' } }, nameServers: [{ ipv4: { value: '10.10.1.2' } }],
          externalNetworks: [{ subnetMask: { ipv4: { value: '255.255.255.0' } }, defaultGateway: { ipv4: { value: '10.10.1.1' } },
            ipRanges: [{ begin: { ipv4: { value: '10.10.1.41' } }, end: { ipv4: { value: '10.10.1.43' } } }] }] } }] },
      v4_virtual_switches: { data: vswitches },
      // v4 décrit le contrôleur : c'est ce qui distingue un 10G cuivre d'un 10G en cage SFP+.
      v4_host_nics: { data: parisHosts.flatMap(h => ['eth4', 'eth5'].map(name => ({
        _host_name: h.hostName, name, hostDescription: 'Intel(R) Ethernet Controller X550 10GBASE-T', linkCapacityInMbps: 10000,
      }))) },
    },
  },
  clusters: [
    { extId: 'paris', name: 'PAR-PROD-01', planRef: 0, source: { kind: 'live', collectors: { ok: 17, total: 17 }, errors: [] }, data: {
      v4_clusters: { data: [clusters[0]] }, v4_hosts: { data: parisHosts }, v4_subnets: { data: parisSubnets },
      // Comme le fait la projection : chaque cluster reçoit les virtual switches qui le couvrent.
      v4_virtual_switches: { data: vswitches },
      cluster_v2: { hypervisor_types: ['kKvm'] }, storage_containers_v2: containers(87.3),
      host_nics_v2: { entities: parisHosts.flatMap((h, i) => [
        nic(h.hostName, 'eth0', 1_000_000, false), nic(h.hostName, 'eth1', 1_000_000, false),
        nic(h.hostName, 'eth2', 25_000_000, true, { switch_dev_id: 'par-tor-a', switch_port_id: `Ethernet1/${i + 1}`, switch_mgmt_ip_address: '10.10.9.1', switch_hardware_platform: 'Arista DCS-7050SX3' }),
        nic(h.hostName, 'eth3', 25_000_000, true, { switch_dev_id: 'par-tor-b', switch_port_id: `Ethernet1/${i + 1}`, switch_mgmt_ip_address: '10.10.9.2', switch_hardware_platform: 'Arista DCS-7050SX3' }),
        nic(h.hostName, 'eth4', 10_000_000, true, { switch_dev_id: 'par-tor-a', switch_port_id: `Ethernet1/${i + 21}` }),
        nic(h.hostName, 'eth5', 10_000_000, true, { switch_dev_id: 'par-tor-b', switch_port_id: `Ethernet1/${i + 21}` }),
      ]) },
    } },
    { extId: 'lyon', name: 'LYO-DR-01', planRef: 1, source: { kind: 'live', collectors: { ok: 17, total: 17 }, errors: [] }, data: {
      v4_clusters: { data: [clusters[1]] }, v4_hosts: { data: lyonHosts },
      v4_virtual_switches: { data: [vswitches[0]] },
      v4_subnets: { data: [subnet('lyon', 'MGMT', 10, 'vs0'), subnet('lyon', 'DR-APP', 520, 'vs0')] },
      cluster_v2: { hypervisor_types: ['kKvm'] }, storage_containers_v2: containers(41.9),
      host_nics_v2: { entities: lyonHosts.flatMap(h => [nic(h.hostName, 'eth0', 10_000_000, true), nic(h.hostName, 'eth1', 10_000_000, true)]) },
    } },
    { extId: 'lab', name: 'LAB-EDGE', planRef: 2, source: { kind: 'live', collectors: { ok: 3, total: 17 }, errors: [] }, data: { v4_clusters: { data: [clusters[2]] } } },
  ],
};

export const project = {
  name: 'Lab',
  build: { clusters: [
    { clusterName: 'PAR-PROD-01', siteId: 'Paris — DC Équinoxe PA3' },
    { clusterName: 'LYO-DR-01', siteId: 'Lyon — DC Rhône', torSwitches: 2, switchModel: 'Dell S5248F', switchMode: 'VLT' },
    { clusterName: 'LAB-EDGE' },
  ] },
};
