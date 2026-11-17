// Faux Prism en HTTPS auto-signé : PC (v4) et PE (v2) sur le même port, identifiants admin / secret.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// `hosts` nœuds dans le cluster ; `flowEnabled: false` simule Flow Network Security non activé ; `stats.maxInFlight` dit combien de lectures de ports ont été servies en même temps.
export function startFakePrism({ hosts = 1, flowEnabled = true } = {}) {
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
        { extId: 'c-1', name: 'Gondor', config: { clusterFunction: ['AOS'], buildInfo: { version: '7.0' } },
          network: { externalAddress: { ipv4: { value: self } } } },
      ] });
      if (/host[-_]nics$/.test(pathname)) {
        stats.maxInFlight = Math.max(stats.maxInFlight, ++stats.inFlight);
        await Bun.sleep(15);
        stats.inFlight--;
        const nic = { name: 'eth0', link_speed_in_kbps: 10000000 };
        return Response.json(pathname.includes('/v2.0/') ? [nic] : { data: [nic] });
      }
      if (pathname.endsWith('/config/hosts')) return Response.json({
        data: names.map(([extId, hostName]) => ({ extId, hostName, cluster: { extId: 'c-1' } })),
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
      if (pathname.endsWith('/config/clusters/c-1/snmp')) return Response.json({ data: { isEnabled: true, users: [{ username: 'snmpuser', authType: 'SHA', authKey: 'k-auth', privType: 'AES', privKey: 'k-priv' }] } });
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
      if (pathname.endsWith('/config/protection-policies')) return Response.json({ data: [{ name: 'Gold' }] });
      if (pathname.endsWith('/v1/storage_pools')) return Response.json({ entities: [{ name: 'default-storage-pool', storagePoolUuid: 'sp-1', capacity: 2 ** 41 }] });
      if (pathname.endsWith('/v1/snmp')) return Response.json({ enabled: true, snmpUsers: [{ username: 'peuser', authType: 'SHA', authKey: 'k-peauth', privType: 'AES', privKey: 'k-pepriv' }] });
      if (pathname.endsWith('/v2.0/cluster/')) return Response.json({ name: 'Gondor', version: '7.0', timezone: 'Europe/Paris',
        encrypted: false, has_self_encrypting_drive: false, data_in_transit_encryption_dto: { enabled: true },
        http_proxies: [{ name: 'proxy', address: '10.0.0.8', port: 3128, proxy_types: ['HTTP', 'HTTPS'], username: 'svc', password: 'k-proxy' }] });
      if (pathname.endsWith('/v2.0/hosts/')) return Response.json({
        entities: names.map(([uuid, name], i) => ({ uuid, name, serial: `SN-${42 + i}` })),
      });
      return new Response('{}', { status: 404 });
    },
  });
  return { host: `127.0.0.1:${prism.port}`, seen, stats, stop: () => prism.stop(true) };
}
