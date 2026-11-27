// Faux Prism en HTTPS auto-signé : PC (v4) et PE (v2) sur le même port, identifiants admin / secret.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// `hosts` nœuds dans le cluster ; `flowEnabled: false` simule Flow Network Security non activé ; `vpcs: true` déclare un VPC (Flow Virtual Networking) ; `stats.maxInFlight` dit combien de lectures de ports ont été servies en même temps.
export function startFakePrism({ hosts = 1, flowEnabled = true, vpcs = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asbuilt-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost',
    '-keyout', `${dir}/k.pem`, '-out', `${dir}/c.pem`], { stdio: 'ignore' });

  const seen = [];
  const stats = { inFlight: 0, maxInFlight: 0 };
  const names = Array.from({ length: hosts }, (_, i) => [`h-${i + 1}`, `gondor-${i + 1}`]);
  const prism = Bun.serve({
    port: 0, hostname: '127.0.0.1',
    tls: { key: Bun.file(`${dir}/k.pem`), cert: Bun.file(`${dir}/c.pem`) },
    async fetch(req) {
      const { pathname } = new URL(req.url);
      seen.push(pathname);
      if (req.headers.get('authorization') !== `Basic ${btoa('admin:secret')}`) return new Response('no', { status: 401 });
      const self = `127.0.0.1:${prism.port}`;
      if (pathname.endsWith('/config/clusters')) return Response.json({ data: [
        { extId: 'pc-1', name: 'PC', config: { clusterFunction: ['PRISM_CENTRAL'], buildInfo: { version: 'pc.7.5' } },
          nodes: { nodeList: [{ controllerVmIp: { ipv4: { value: '10.0.0.50' } } }] } },
        // Plan #17 : SMTP, proxy, NCC et Pulse lus en v4 (formes de la spec clustermgmt, vues sur pc.7.6).
        { extId: 'c-1', name: 'Gondor', config: { clusterFunction: ['AOS'], buildInfo: { version: '7.0' },
          clusterSoftwareMap: [{ softwareType: 'NCC', version: 'ncc-5.1.0' }], pulseStatus: { isEnabled: true } },
          network: { externalAddress: { ipv4: { value: self } },
            smtpServer: { emailAddress: 'asbuilt@gondor.local', type: 'STARTTLS', server: { ipAddress: { ipv4: { value: '10.0.0.7' } }, port: 25, password: 'k-smtp' } },
            httpProxyList: [{ name: 'proxy', ipAddress: { ipv4: { value: '10.0.0.8' } }, port: 3128, proxyTypes: ['HTTP', 'HTTPS'], username: 'svc', password: 'k-proxy' }] } },
      ] });
      if (/host[-_]nics$/.test(pathname)) {
        stats.maxInFlight = Math.max(stats.maxInFlight, ++stats.inFlight);
        await Bun.sleep(15);
        stats.inFlight--;
        // Vitesses différentes selon l'API, pour vérifier que la v4 l'emporte.
        return Response.json(pathname.includes('/v2.0/')
          ? [{ name: 'eth0', link_speed_in_kbps: 10000000 }]
          : { data: [{ extId: 'nic-1', name: 'eth0', linkSpeedInKbps: 25000000, linkCapacityInMbps: 25000, interfaceStatus: 1 }] });
      }
      if (pathname.endsWith('/config/hosts')) return Response.json({
        // Un hôte v4 désigne son cluster par `cluster.uuid` sur pc.7.6 (et non `cluster.extId`).
        // Adresses sous `externalAddress` (forme pc.7.6).
        data: names.map(([extId, hostName], i) => ({ extId, hostName, cluster: { uuid: 'c-1' },
          controllerVm: { externalAddress: { ipv4: { value: `10.0.0.${21 + i}` } } }, hypervisor: { externalAddress: { ipv4: { value: `10.0.0.${11 + i}` } } } })),
      });
      if (pathname.endsWith('/config/domain-managers')) return Response.json({ data: [{ extId: 'dm-1', hostingClusterExtId: 'c-1',
        config: { credentials: [{ username: 'admin', password: 'k-pcpass' }], name: 'PC', size: 'SMALL', buildInfo: { version: 'pc.7.5' }, resourceConfig: { numVcpus: 6, memorySizeBytes: 26 * 2 ** 30, dataDiskSizeBytes: 500 * 2 ** 30 } },
        network: { externalAddress: { ipv4: { value: '10.0.0.40' } }, fqdn: 'pc.gondor.local', nameServers: [{ ipv4: { value: '10.0.0.2' } }], ntpServers: [{ fqdn: { value: 'pool.ntp.org' } }] } }] });
      if (pathname.endsWith('/resources/entities')) return Response.json({ data: [
        { clusterExtId: 'pc-1', entityModel: 'NCC', entityVersion: '5.1' },
        { clusterExtId: 'c-1', entityModel: 'BIOS', entityVersion: 'G1' },
      ] });
      if (pathname.endsWith('/ahv/config/vms')) return Response.json({ data: [
        { name: 'PCVM-1', cluster: { extId: 'c-1' }, numSockets: 6, numCoresPerSocket: 1, memorySizeBytes: 26 * 2 ** 30,
          nics: [{ networkInfo: { ipv4Config: { ipAddress: { value: '10.0.0.50' } } } }] },
      ] });
      if (pathname.endsWith('/config/clusters/c-1/snmp')) return Response.json({ data: { isEnabled: true, users: [{ username: 'snmpuser', authType: 'SHA', authKey: 'k-auth', privType: 'AES', privKey: 'k-priv' }],
        traps: [{ address: { ipv4: { value: '10.0.0.30' } }, port: 162, protocol: 'UDP', version: 'V3', username: 'snmpuser', recieverName: 'nms', communityString: 'k-community', engineId: 'k-engine' }],
        transports: [{ protocol: 'UDP', port: 161 }] } });
      // Plan #6 : syslog et certificat par cluster, images et services au niveau du PC. VPC et Objects
      // absents (404) : un service non déployé se dit « Non configuré ».
      if (pathname.endsWith('/config/clusters/c-1/rsyslog-servers')) return Response.json({ data: [
        { serverName: 'siem', ipAddress: { ipv4: { value: '10.0.0.9' } }, port: 514, networkProtocol: 'UDP', modules: [{ name: 'AUDIT', logSeverityLevel: 'INFO' }] },
      ] });
      if (pathname.endsWith('/config/clusters/c-1/ssl-certificate')) return Response.json({ data: {
        publicCertificate: fs.readFileSync(`${dir}/c.pem`, 'utf8'), privateKey: 'k-sslkey', passphrase: 'k-sslpass', privateKeyAlgorithm: 'RSA_2048',
      } });
      if (pathname.endsWith('/content/images')) return Response.json({ data: [{ name: 'ubuntu-24.04', type: 'DISK_IMAGE', sizeBytes: 4 * 2 ** 30, clusterLocationExtIds: ['c-1'] }] });
      // Flow non activé : microseg répond 403, même à un admin (vu sur le lab).
      if (pathname.endsWith('/config/policies')) return flowEnabled ? Response.json({ data: [
        { name: 'web-app', type: 'APPLICATION', state: 'ENFORCE', isSystemDefined: false },
        { name: 'built-in', type: 'QUARANTINE', state: 'ENFORCE', isSystemDefined: true },
      ] }) : new Response('{}', { status: 403 });
      if (pathname.endsWith('/config/file-servers')) return Response.json({ data: [{ name: 'files01' }] });
      if (pathname.endsWith('/config/object-stores')) return new Response('{"message":"Http request to endpoint 0:127.0.0.1:7301 failed"}', { status: 503 });
      if (pathname.endsWith('/config/volume-groups')) return Response.json({ data: [
        { name: 'vg-sql', clusterReference: 'c-1', usageType: 'USER', sharingStatus: 'SHARED', targetName: 'iqn-vg-sql', iscsiFeatures: { targetSecret: 'k-chap' } },
        { name: 'vg-nke', clusterReference: 'c-1', isHidden: true },
      ] });
      // Plan #17 : ce que demandait le Prism Element, lu sur le PC.
      if (pathname.endsWith('/config/clusters/c-1/cvms')) return Response.json({ data: [
        { name: 'gondor-1-CVM', clusterExtId: 'c-1', numVcpus: 1, memorySizeBytes: 32 * 2 ** 30, ipAddress: { ipv4: { value: '10.0.0.21' } } },
      ] });
      if (pathname.endsWith('/config/disks')) return Response.json({ data: [
        { nodeExtId: 'h-1', hostName: 'gondor-1', clusterExtId: 'c-1', storagePoolExtId: 'sp-1', diskSizeBytes: 2 ** 40, serialNumber: 'D-1',
          storageTier: 'SSD', status: 'NORMAL', diskAdvanceConfig: { isSelfEncryptingDrive: false } },
      ] });
      if (pathname.endsWith('/config/entitlements')) return Response.json({ data: [
        { extId: 'c-1', name: 'Gondor', isRegistered: true, details: [{ name: 'NCI Pro', category: 'PRO', earliestExpiryDate: '2030-01-01' }] },
        { extId: 'pc-1', name: 'PC', isRegistered: false, isMulticluster: true },
      ] });
      if (pathname.endsWith('/config/compliances')) return Response.json({ data: [
        { extId: 'c-1', services: [{ name: 'AOS', licenseType: 'PRO', isCompliant: true }] },
      ] });
      if (pathname.endsWith('/config/recovery-plans')) return Response.json({ data: [
        { name: 'RP-Gondor', primaryLocation: { clusters: [{ extId: 'c-1' }] }, recoveryLocation: { domainManagerExtId: 'pc-remote' } },
      ] });
      if (pathname.endsWith('/serviceability/alerts/email-config')) return Response.json({ data: {
        isEnabled: true, isEmailDigestEnabled: false, emailContactList: ['ops@gondor.local'], hasDefaultNutanixEmail: true, defaultNutanixEmail: 'nos-alerts@nutanix.com',
      } });
      if (pathname.endsWith('/config/key-management-servers')) return Response.json({ data: [{ name: 'kms-gondor', clientSecret: 'k-kms' }] });
      if (pathname.endsWith('/authn/saml-identity-providers')) return Response.json({ data: [{ name: 'adfs', idpMetadataUrl: 'https://adfs.gondor.local/metadata' }] });
      // Plan #18 : formes de la spec (networking, vmm, iam, lifecycle, clustermgmt, prism).
      if (pathname.endsWith('/config/uplink-bonds')) return Response.json({ data: [
        { name: 'br0-up', type: 'BALANCE_TCP', lacpStatus: 'NEGOTIATED', clusterReference: 'c-1', hostReference: 'h-1', hostNicReferences: [{ extId: 'nic-1' }], virtualSwitchInfo: { name: 'vs0' } },
      ] });
      if (pathname.endsWith('/config/categories')) return Response.json({ data: [
        { extId: 'cat-sql', key: 'App', value: 'SQL' }, { extId: 'cat-dc', key: 'App', value: 'AD' }, { extId: 'cat-h', key: 'Hosts', value: 'Fast' },
      ] });
      if (pathname.endsWith('/ahv/policies/vm-host-affinity-policies')) return Response.json({ data: [
        { name: 'sql-on-fast', vmCategories: [{ extId: 'cat-sql' }], hostCategories: [{ extId: 'cat-h' }], numVms: 2, numHosts: 1, numCompliantVms: 2, numNonCompliantVms: 0 },
      ] });
      if (pathname.endsWith('/ahv/policies/vm-anti-affinity-policies')) return Response.json({ data: [
        { name: 'ad-split', categories: [{ extId: 'cat-dc' }], numCompliantVms: 2, numNonCompliantVms: 0 },
      ] });
      if (pathname.endsWith('/ahv/policies/legacy-vm-anti-affinity-policies')) return Response.json({ data: [
        { name: 'legacy-ad', cluster: { extId: 'c-1' }, vms: [{ extId: 'vm-1' }, { extId: 'vm-2' }] },
      ] });
      if (pathname.endsWith('/ahv/policies/vm-startup-policies')) return Response.json({ data: [
        { name: 'boot-order', groups: [{ categories: [{ extId: 'cat-dc' }] }, { categories: [{ extId: 'cat-sql' }] }], startConditions: [{ powerStateCriteria: 'ON', delayDurationSecs: 60 }] },
      ] });
      if (pathname.endsWith('/authz/authorization-policies')) return Response.json({ data: [
        { displayName: 'ops-admins', role: 'role-ops', identities: [{}], entities: [{}], isSystemDefined: false, assignedUsersCount: 0, assignedUserGroupsCount: 1, authorizationPolicyType: 'USER_DEFINED', clientName: 'k-client' },
        { displayName: 'Super Admin', isSystemDefined: true },
      ] });
      if (pathname.endsWith('/authn/user-groups')) return Response.json({ data: [{ name: 'ops', groupType: 'LDAP', distinguishedName: 'CN=ops,DC=gondor,DC=local' }] });
      if (pathname.endsWith('/lifecycle/v4.0/resources/config')) return Response.json({ data: {
        url: 'https://download.nutanix.com/lcm/2.0', isAutoInventoryEnabled: true, autoInventorySchedule: '03:00', version: '3.1', connectivityType: 'CONNECTED_SITE', isHttpsEnabled: true,
      } });
      if (pathname.endsWith('/config/clusters/c-1/rackable-units')) return Response.json({ data: [
        { id: 1, serial: 'BLK-1', model: 'NX', modelName: 'NX-8155-G9', nodes: [{ uuid: 'h-1', position: 1 }], rack: { id: 1 } },
      ] });
      if (pathname.endsWith('/config/clusters/c-1/network-segments')) return Response.json({ data: [
        { name: 'backplane', serviceName: 'BACKPLANE', vlanId: 3000, mtu: 9000, cvmNetworkSegmentInterfaceName: 'eth2' },
      ] });
      if (pathname.endsWith('/config/clusters/c-1/storage-config')) return Response.json({ data: {
        resilientCapacityWarningThresholdPercentage: 75, isRebuildReservationEnabled: true, isRf1Enabled: false, storageOverProvisioningCautionThreshold: 150, isDelayedMaintenanceResiliencyEnabled: false,
      } });
      if (pathname.endsWith('/domain-managers/dm-1/backup-targets')) return Response.json({ data: [
        { location: { config: { $objectType: 'prism.v4.management.ClusterReference', extId: 'c-9', name: 'Rohan' } }, lastSyncTime: '2026-11-27T02:00:00Z', isBackupPaused: false },
      ] });
      // Plan #19 : sections de contexte (PC) et compléments v1 du PE. Secrets en `k-…` : ils ne doivent
      // jamais atteindre le bundle.
      if (pathname.endsWith('/config/storage-policies')) return Response.json({ data: [
        { name: 'gold-storage', categoryExtIds: ['cat-sql'], compressionSpec: { compressionState: 'POSTPROCESS' }, encryptionSpec: { encryptionState: 'ENABLED' }, qosSpec: { throttledIops: 5000 }, faultToleranceSpec: { replicationFactor: 'THREE' } },
      ] });
      if (pathname.endsWith('/alerts/user-defined-policies')) return Response.json({ data: [
        { title: 'CPU VM > 90 %', isEnabled: true, entityType: 'vm', impactTypes: ['PERFORMANCE'], triggerConditions: [{ big: 'x' }] },
      ] });
      if (pathname.endsWith('/report/stigs')) return Response.json({ data: [
        { title: 'SSH root login', ruleId: 'V-1', severity: 'HIGH', status: 'FAILED', fixText: 'k-longtext' },
        { title: 'Banner', ruleId: 'V-2', severity: 'LOW', status: 'PASSED' },
      ] });
      if (pathname.endsWith('/report/security-summaries')) return Response.json({ data: [
        { clusterExtId: 'c-1', stigSummary: { passedCount: 120, failedCount: 3, notApplicableCount: 10 }, lastRefreshTime: '2026-11-27T00:00:00Z' },
      ] });
      if (pathname.endsWith('/config/security-profiles')) return Response.json({ data: [{ clusterExtId: 'c-1', type: 'STIG' }] });
      if (pathname.endsWith('/content/templates')) return Response.json({ data: [{ templateName: 'tpl-win2022', templateDescription: 'Windows Server 2022' }] });
      if (pathname.endsWith('/vm-guest-customization-profiles')) return Response.json({ data: [{ name: 'sysprep-fr', description: 'Domaine gondor' }] });
      if (pathname.endsWith('/images/config/placement-policies')) return Response.json({ data: [{ name: 'iso-paris', placementType: 'SOFT', enforcementState: 'ACTIVE' }] });
      if (pathname.endsWith('/config/iscsi-clients')) return Response.json({ data: [
        { iscsiInitiatorName: 'iqn.1991-05.com.microsoft:sql01', clientSecret: 'k-iscsi', enabledAuthentications: 'CHAP', numVirtualTargets: 2, clusterReference: 'c-1' },
      ] });
      if (pathname.endsWith('/config/vpcs')) return vpcs ? Response.json({ data: [{ extId: 'vpc-1', name: 'vpc-prod' }] }) : new Response('{}', { status: 404 });
      if (pathname.endsWith('/config/gateways')) return Response.json({ data: [{ name: 'gw-vpn', vpcReference: 'vpc-1', isActive: true, status: { state: 'UP' }, installedSoftwareVersion: '4.2' }] });
      if (pathname.endsWith('/config/vpn-connections')) return Response.json({ data: [
        { name: 'vpn-siege', localGatewayReference: 'gw-vpn', remoteGatewayReference: 'gw-remote', ipsecConfig: { preSharedKey: 'k-psk' }, ipsecTunnelStatus: 'UP' },
      ] });
      if (pathname.endsWith('/config/bgp-sessions')) return Response.json({ data: [{ name: 'bgp-1', localGatewayReference: 'gw-vpn', remoteGatewayReference: 'gw-remote', password: 'k-bgp', status: 'UP' }] });
      if (pathname.endsWith('/config/floating-ips')) return Response.json({ data: [{ name: 'fip-web', floatingIp: { ipv4: { value: '203.0.113.10' } }, privateIp: { ipv4: { value: '10.1.0.10' } }, vpcReference: 'vpc-1', associationStatus: 'ASSOCIATED' }] });
      if (pathname.endsWith('/config/layer2-stretches')) return Response.json({ data: [] });
      if (pathname.endsWith('/v1/data_at_rest_encryption')) return Response.json({ softwareEncryptionScope: null, desiredPasswordProtection: false, storageContainerEncryptionStatus: {}, diskEncryptionStatus: {} });
      if (pathname.endsWith('/v1/cluster/metro_witness')) return Response.json([
        { witnessName: 'witness-1', clusterName: 'Gondor', ipAddresses: ['10.0.0.60'], nosFullVersion: '7.6', username: 'admin', password: 'k-witness' },
      ]);
      if (pathname.endsWith('/v1/cluster/remote_support')) return Response.json({ enable: { enabled: false }, tunnelDetails: { connectionStatus: { status: 'DISCONNECTED' }, httpProxy: { password: 'k-rsproxy' } } });
      if (pathname.endsWith('/v1/protection_domains/unprotected_vms')) return Response.json({ entities: [{ vmName: 'app-01', hostName: 'gondor-1', powerState: 'on', vdiskNames: ['k-vdisk'] }] });
      if (pathname.endsWith('/config/protection-policies')) return Response.json({ data: [{ name: 'Gold' }] });
      if (pathname.endsWith('/v1/storage_pools')) return Response.json({ entities: [{ name: 'default-storage-pool', storagePoolUuid: 'sp-1', capacity: 2 ** 41 }] });
      if (pathname.endsWith('/v1/vms')) return Response.json({ entities: [{ vmName: 'gondor-1-CVM', controllerVm: true, numVCpus: 8 }] });
      if (pathname.endsWith('/v1/snmp')) return Response.json({ enabled: true, snmpUsers: [{ username: 'peuser', authType: 'SHA', authKey: 'k-peauth', privType: 'AES', privKey: 'k-pepriv' }] });
      if (pathname.endsWith('/v2.0/cluster/')) return Response.json({ name: 'Gondor', version: '7.0', timezone: 'Europe/Paris',
        // `encrypted: true` sans aucun chiffrement configuré : la forme vue sur AOS 7.6 (lab).
        encrypted: true, has_self_encrypting_drive: false, data_in_transit_encryption_dto: { enabled: true },
        http_proxies: [{ name: 'proxy', address: '10.0.0.8', port: 3128, proxy_types: ['HTTP', 'HTTPS'], username: 'svc', password: 'k-proxy' }] });
      if (pathname.endsWith('/v2.0/hosts/')) return Response.json({
        entities: names.map(([uuid, name], i) => ({ uuid, name, serial: `SN-${42 + i}` })),
      });
      return new Response('{}', { status: 404 });
    },
  });
  return { host: `127.0.0.1:${prism.port}`, seen, stats, stop: () => prism.stop(true) };
}
