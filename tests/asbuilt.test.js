import { test, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import * as docx from 'docx';
import { collectPcBundle, collectPes } from '../server/bundle.js';
import { mapLimit, HOST_CONCURRENCY } from '../server/prism/collect.js';
import { buildAsBuiltModel } from '../engine/asbuilt/asBuiltModel';
import { normalizeCluster } from '../engine/asbuilt/normalize';
import { generateAsBuiltDocx } from '../engine/asbuilt/exportAsBuiltDocx';
import { cleanModel } from '../web/clean';
import { SECTIONS } from '../engine/asbuilt/sections';
import { withDiagrams, renderDiagram } from '../web/diagrams';
import * as lab from './fixtures/lab';
import { startFakePrism } from './fixtures/fakePrism';
import { bundle as fixtureBundle, project } from '../engine/asbuilt/__fixtures__/middleEarth';

const TEMPLATE = fs.readFileSync(path.resolve(import.meta.dir, '../assets/asbuilt-default.docx'));

const textOf = async (buf) =>
  (await (await JSZip.loadAsync(buf)).file('word/document.xml').async('string')).replace(/<[^>]+>/g, '');

test('fixture de référence → .docx rempli, sans marqueur résiduel', async () => {
  const model = buildAsBuiltModel({ bundle: fixtureBundle, project, lang: 'fr' });
  const buf = await generateAsBuiltDocx(docx, model, { template: TEMPLATE, outputType: 'nodebuffer', lang: 'fr' });
  const text = await textOf(buf);
  expect(text).toContain('MiddleEarth');
  expect(text).not.toContain('{{');
  expect(text).toContain('Non collecté');

  const clean = await textOf(await generateAsBuiltDocx(docx, cleanModel(model), { template: TEMPLATE, outputType: 'nodebuffer', lang: 'fr' }));
  expect(clean).toContain('MiddleEarth');
  // Le journal de collecte, lui, garde le droit de dire qu'une cible n'a pas répondu.
  expect(clean.split('Journal de collecte')[0]).not.toContain('Non collecté');
  // Lu mais vide : c'est un fait sur la plateforme, il reste dit.
  expect(clean).toContain('Non configuré');

  // Seuls les tableaux à colonnes ont une ligne d'en-tête ; un tableau clé/valeur n'en a pas.
  const xml = await (await JSZip.loadAsync(buf)).file('word/document.xml').async('string');
  const looks = xml.match(/<w:tblLook[^>]*>/g) || [];
  const headerless = looks.filter(l => /w:firstRow="(0|false)"/.test(l)).length;
  expect(headerless).toBe(model.sections.filter(x => x.kind === 'kv' && !x.empty).length);
  expect(looks.length - headerless).toBe(model.sections.filter(x => x.kind === 'table' && !x.empty).length);
  // En-têtes en blanc : par un style de paragraphe du template, que la couleur de « Normal » ne masque pas.
  expect((xml.match(/<w:tblHeader\/>[\s\S]*?<w:pStyle w:val="AsBuiltTableHeader"\/>/g) || []).length).toBe(looks.length - headerless);
  const styles = await (await JSZip.loadAsync(buf)).file('word/styles.xml').async('string');
  expect(styles).toMatch(/w:styleId="AsBuiltTableHeader">[\s\S]*?<w:color w:val="FFFFFF"\/>/);
});

test('sections vides qualifiées : « sans retouche » ne retire que le non collecté', () => {
  const model = buildAsBuiltModel({ bundle: fixtureBundle, project, lang: 'fr', integrator: 'Orbis Systèmes' });
  const kinds = (m) => Object.groupBy(m.sections.filter(s => s.empty), s => s.emptyKind);
  const before = kinds(model), after = kinds(cleanModel(model));
  expect(before.uncollected.length).toBeGreaterThan(0);
  expect(before.unconfigured.length).toBeGreaterThan(0);
  expect(after.uncollected).toBeUndefined();
  expect(after.unconfigured.map(s => s.id)).toEqual(before.unconfigured.map(s => s.id));
  // Une erreur de collecte se dit avec sa clé ; elle ne passe pas pour une absence de configuration.
  expect(model.sections.find(s => s.id === 'host.firmware').emptyText).toMatch(/Non collecté — v4_lcm_entities/);
  // La présentation nomme le client et l'intégrateur saisis.
  expect(model.sections.find(s => s.id === 'intro.presentation').text).toMatch(/pour ACME par les équipes d'Orbis Systèmes/);
});

// Faux Prism en HTTPS auto-signé : PC (v4) et PE (v2) sur le même port.
test('collecte sur un Prism auto-signé → bundle → .docx', async () => {
  const prism = startFakePrism();
  const { seen } = prism;

  try {
    const creds = { pcHost: prism.host, pcUser: 'admin', ignoreSSL: true };
    // Un mot de passe faux coûte un seul échec de connexion, pas un par collecteur : le compte ne se verrouille pas.
    let before = seen.length;
    await expect(collectPcBundle({ ...creds, pcPass: 'faux' })).rejects.toThrow(/401/);
    expect(seen.length - before).toBe(1);

    // Étape 1 : le PC seul déclare ses clusters, sans toucher aux Prism Element.
    const bundle = await collectPcBundle({ ...creds, pcPass: 'secret' });
    expect(bundle.clusters.map(c => [c.name, c.address, c.source.kind])).toEqual([['Gondor', creds.pcHost, 'absent']]);
    expect(seen.some(p => p.includes('/PrismGateway/'))).toBe(false);

    // Étape 2 : un PE refusé le dit et se retente ; avec ses identifiants, il complète le bundle.
    before = seen.length;
    expect((await collectPes(bundle, [{ extId: 'c-1', user: 'admin', pass: 'faux' }]))['c-1']).toMatch(/401/);
    expect(seen.length - before).toBe(1);
    expect(bundle.clusters[0].source.kind).toBe('absent');
    expect(await collectPes(bundle, [{ extId: 'c-1', user: 'admin', pass: 'secret' }])).toEqual({ 'c-1': null });
    expect(bundle.clusters[0].source.kind).toBe('live');
    expect(bundle.clusters[0].data.hosts_v2.entities[0].serial).toBe('SN-42');
    // Chemins vérifiés sur le lab : SNMP par cluster, politiques dans `datapolicies`, pools en v1.
    expect(bundle.clusters[0].data.v4_snmp.data[0].username).toBe('snmpuser');
    expect(JSON.stringify(bundle)).not.toMatch(/k-auth|k-priv|k-pcpass|k-peauth|k-pepriv/);
    expect(bundle.pc.data.v4_protection_policies.data[0].name).toBe('Gold');
    expect(bundle.clusters[0].data.storage_pools_v2.entities[0].storagePoolUuid).toBe('sp-1');
    expect(seen.some(p => p.startsWith('/api/datapolicies/'))).toBe(true);

    // Fiche du Prism Central (plan #10) : domain-manager, VM du PC par son IP, composants LCM du PC.
    const sheet = buildAsBuiltModel({ bundle, lang: 'fr' }).sections;
    const kv = (id) => Object.fromEntries(sheet.find(x => x.id === id).rows.map(r => [r.label, r.value]));
    const cells = (id) => sheet.find(x => x.id === id).rows.map(r => r.cells);
    expect(kv('pc.info')).toMatchObject({ Nom: 'PC', FQDN: 'pc.gondor.local', Version: 'pc.7.5', Taille: 'Small', 'Déploiement': 'Une VM', 'Cluster hôte': 'Gondor' });
    expect(kv('pc.addressing')).toMatchObject({ 'Adresse virtuelle': '10.0.0.40', 'IP des VM': '10.0.0.50', DNS: '10.0.0.2', NTP: 'pool.ntp.org' });
    expect(cells('pc.resources')).toEqual([['PCVM-1', '10.0.0.50', 6, '26.00 Go', '500.00 Go']]);
    // SNMP : la v4 l'emporte ; sans elle, le PE est lu sous `snmpUsers` (forme réelle de /v1/snmp, vue sur le lab).
    const snmpOf = (b) => buildAsBuiltModel({ bundle: b, lang: 'fr', enabled: null }).sections.find(x => x.id === 'cfg.snmp').rows.map(r => r.cells);
    expect(snmpOf(bundle)[0][0]).toBe('snmpuser');
    const peOnly = structuredClone(bundle);
    for (const c of peOnly.clusters) delete c.data.v4_snmp;
    expect(snmpOf(peOnly)).toEqual([['peuser', 'AES', 'SHA']]);
    expect(cells('pc.versions')).toEqual([['Prism Central', 'pc.7.5'], ['NCC', '5.1']]);
    const order = sheet.filter(x => x.chapter === 'pc').map(x => x.id);
    expect(order.slice(0, 5)).toEqual(['pc.overview', 'pc.info', 'pc.addressing', 'pc.resources', 'pc.versions']);
    expect(seen.some(p => p.includes('/PrismGateway/'))).toBe(true);

    // Plan #6 : nouvelles sections, et aucun secret (clé du certificat, secret CHAP, mot de passe du proxy).
    expect(JSON.stringify(bundle)).not.toMatch(/k-sslkey|k-sslpass|k-chap|k-proxy/);
    expect(cells('cfg.syslog')).toEqual([['siem', '10.0.0.9', 514, 'UDP', 'AUDIT (INFO)']]);
    expect(cells('cfg.proxy')).toEqual([['proxy', '10.0.0.8', 3128, 'HTTP, HTTPS', 'svc']]);
    expect(kv('cfg.certificate')).toMatchObject({ Sujet: 'CN=localhost', 'Émetteur': 'CN=localhost', 'Algorithme de clé': 'RSA_2048' });
    expect(kv('cfg.certificate')["Valide jusqu'au"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // En transit : champ absent en v4, la v2 du PE fait foi. KMS lus sur le PC (plan #17).
    expect(kv('cfg.encryption')).toEqual({ 'Données au repos': 'Non', 'Disques auto-chiffrants': 'Non', 'Containers chiffrés (logiciel)': 'Aucun', 'Données en transit': 'Oui', 'Serveurs de clés (KMS)': 'kms-gondor' });
    // Ports : la v4 (25G) l'emporte sur la v2 (10G) ; le pool garde le nom que lui donne le PE.
    expect(normalizeCluster(bundle.clusters[0]).nodePorts[0].ports).toEqual([{ name: 'eth0', speed: '25G', active: true }]);
    expect(cells('cfg.pools')).toEqual([['default-storage-pool', 'sp-1', '2.00 To', null]]);
    expect(cells('pc.images')).toEqual([['ubuntu-24.04', 'DISK_IMAGE', '4.00 Go', 'Gondor']]);
    expect(cells('pc.flow')).toEqual([['web-app', 'APPLICATION', 'ENFORCE', null]]);
    expect(cells('pc.files')).toEqual([['files01', null, null]]);
    expect(cells('pc.volumes')).toEqual([['vg-sql', 'Gondor', 'USER', 'SHARED', 'iqn-vg-sql']]);
    for (const id of ['pc.vpcs', 'pc.objects']) expect(sheet.find(x => x.id === id).emptyText).toBe('Non configuré');
    expect(bundle.pc.source.errors.map(e => e.key).filter(k => /rsyslog|ssl|images|policies|vpcs|file|object|volume/.test(k))).toEqual([]);

    const model = buildAsBuiltModel({
      bundle, lang: 'fr',
      project: { name: 'Test', build: { clusters: [{ clusterName: 'Gondor', siteId: 'Minas Tirith' }] } },
    });
    const text = await textOf(await generateAsBuiltDocx(docx, model, { template: TEMPLATE, outputType: 'nodebuffer', lang: 'fr' }));
    for (const s of ['Gondor', 'gondor-1', 'SN-42', 'Minas Tirith', 'Informations du Prism Central', 'pc.gondor.local', 'Syslog', 'Nutanix Volumes', 'vg-sql']) expect(text).toContain(s);
    expect(text).not.toContain('secret');
  } finally { prism.stop(); }
});

// Plan #17 : avec les seuls identifiants du PC, le document ne perd que ce que seul le PE expose.
test('PC seul : le document se passe du Prism Element', async () => {
  const prism = startFakePrism();
  try {
    const bundle = await collectPcBundle({ pcHost: prism.host, pcUser: 'admin', pcPass: 'secret', ignoreSSL: true });
    expect(prism.seen.some(p => p.includes('/PrismGateway/'))).toBe(false);
    expect(bundle.pc.source.errors.map(e => e.key).filter(k => /cvms|host_nics|license_(entitlements|compliances)|recovery_plans|key_management|saml|alert_email|disks/.test(k))).toEqual([]);
    expect(JSON.stringify(bundle)).not.toMatch(/k-smtp|k-proxy|k-kms/);

    const sheet = buildAsBuiltModel({ bundle, lang: 'fr' }).sections;
    const get = (id) => sheet.find(x => x.id === id);
    const kv = (id) => Object.fromEntries(get(id).rows.map(r => [r.label, r.value]));
    const cells = (id) => get(id).rows.map(r => r.cells);

    expect(kv('cfg.smtp')).toEqual({ Serveur: '10.0.0.7', Port: 25, 'Sécurité': 'STARTTLS', 'Expéditeur': 'asbuilt@gondor.local' });
    expect(cells('cfg.proxy')).toEqual([['proxy', '10.0.0.8', 3128, 'HTTP, HTTPS', 'svc']]);
    expect(kv('cfg.encryption')).toMatchObject({ 'Données au repos': 'Non', 'Disques auto-chiffrants': 'Non', 'Données en transit': 'Non' });
    expect(kv('cfg.licensing')).toMatchObject({ Licence: 'NCI Pro, échéance 2030-01-01', 'Enregistré': 'Oui', 'Conformité': 'AOS : PRO, conforme' });
    expect(Object.keys(kv('cfg.licensing'))).not.toContain('Numéro de série du bloc');
    expect(kv('cfg.alerts')).toEqual({ 'Pulse activé': 'Oui' });
    // Pool : identifiant et capacité tirés des disques v4 ; le nom n'existe qu'au PE.
    expect(cells('cfg.pools')).toEqual([[null, 'sp-1', '1.00 To', null]]);
    // CVM : mémoire v4, vCPU non repris (numVcpus v4 non fiable).
    expect(cells('cfg.cvm')[0][0]).toBe('gondor-1-CVM');
    expect(cells('cfg.cvm')[0][1]).toBe('32.00 Go');
    expect(cells('cfg.cvm')[0][3]).toBe('10.0.0.21');
    expect(kv('pc.alerts')).toMatchObject({ 'Alertes par e-mail': 'Oui', Destinataires: 'ops@gondor.local', 'Copie au support Nutanix': 'nos-alerts@nutanix.com' });
    expect(cells('pc.recoveryplans')).toEqual([['RP-Gondor', 'Gondor', 'Prism Central distant', null]]);
    expect(cells('sec.directories')).toContainEqual(['adfs', 'SAML', null, 'https://adfs.gondor.local/metadata', null]);

    const view = normalizeCluster(bundle.clusters[0]);
    expect(view.nccVersion).toBe('5.1.0');
    expect(view.nodePorts[0].ports).toEqual([{ name: 'eth0', speed: '25G', active: true }]);
    expect(view.nodes[0].storageTb).toBe(1);

    // Ce que seul le PE expose dit pourquoi il manque, au lieu de passer pour « Non configuré ».
    for (const id of ['cfg.ha', 'cfg.auth', 'cfg.dataprotection']) {
      expect(get(id).emptyText).toBe('Non collecté — disponible avec les identifiants Prism Element');
    }
    expect(buildAsBuiltModel({ bundle, lang: 'en' }).sections.find(x => x.id === 'cfg.ha').emptyText)
      .toBe('Not collected — available with Prism Element credentials');
  } finally { prism.stop(); }
});

test('Flow non activé : le 403 de microseg vaut « Non configuré », pas une erreur', async () => {
  const prism = startFakePrism({ flowEnabled: false });
  try {
    const bundle = await collectPcBundle({ pcHost: prism.host, pcUser: 'admin', pcPass: 'secret', ignoreSSL: true });
    expect(bundle.pc.source.errors.map(e => e.key)).not.toContain('v4_network_security_policies');
    expect(buildAsBuiltModel({ bundle, lang: 'fr' }).sections.find(x => x.id === 'pc.flow').emptyText).toBe('Non configuré');
  } finally { prism.stop(); }
});

test('fiche du Prism Central : scale-out, dotation du domain-manager, PC trop ancien', () => {
  const pc = (bundle, lang = 'fr') => {
    const sections = buildAsBuiltModel({ bundle, project: lab.project, lang }).sections.filter(s => s.chapter === 'pc');
    const kv = (id) => Object.fromEntries((sections.find(x => x.id === id).rows || []).map(r => [r.label, r.value]));
    return { sections, kv, get: (id) => sections.find(x => x.id === id) };
  };
  const lab3 = pc(lab.bundle);
  expect(lab3.kv('pc.info')).toMatchObject({ Taille: 'Large', 'Déploiement': 'Scale-out (3 VM)', 'Cluster hôte': 'PAR-PROD-01' });
  expect(lab3.kv('pc.addressing')).toMatchObject({ 'IP des VM': '10.10.1.41 – 10.10.1.43', Masque: '255.255.255.0', Passerelle: '10.10.1.1' });
  // Aucune VM du PC dans l'inventaire : une seule ligne, la dotation déclarée par le domain-manager.
  expect(lab3.get('pc.resources').rows.map(r => r.cells)).toEqual([['PC-PROD', '10.10.1.41 – 10.10.1.43', 14, '44.00 Go', '2500.00 Go']]);
  expect(pc(lab.bundle, 'en').get('pc.info').title).toBe('Prism Central Information');

  // PC antérieur à pc.2024.3 : domain-managers en erreur. Nom et version restent dits ; les
  // ressources sont « Non collecté », avec la clé en cause.
  const { v4_domain_managers, ...older } = lab.bundle.pc.data;
  const old = pc({ ...lab.bundle, pc: { ...lab.bundle.pc, data: older,
    source: { ...lab.bundle.pc.source, errors: [{ key: 'v4_domain_managers', status: 404, message: 'Not Found' }] } } });
  expect(old.kv('pc.info')).toMatchObject({ Nom: 'PC-PROD', Version: 'pc.7.3' });
  expect(old.get('pc.resources').emptyText).toMatch(/Non collecté — v4_domain_managers/);
});

test('schémas : chaque section se dessine, sans valeur fantôme', () => {
  const drawn = {};
  for (const f of [lab, { bundle: fixtureBundle, project }]) {
    for (const lang of ['fr', 'en']) {
      const model = buildAsBuiltModel({ bundle: f.bundle, project: f.project, catalog: withDiagrams(SECTIONS), enabled: null, lang });
      for (const s of model.sections.filter(x => x.kind === 'diagram')) {
        expect(s.failure).toBeNull();
        const svg = s.empty ? null : renderDiagram(s.data, lang);
        if (!svg) continue;
        drawn[s.id] = (drawn[s.id] || 0) + 1;
        expect(svg).not.toMatch(/undefined|NaN|>null<|\[object/);
        expect(svg.endsWith('</svg>')).toBe(true);
      }
    }
  }
  expect(Object.keys(drawn).sort()).toEqual(['cfg.vnet', 'env.cabling', 'env.nodeports', 'env.overview', 'host.logical', 'pc.overview']);
  // Le câblage réel (LLDP) nomme les switches vus par les hôtes et leurs ports.
  const paris = buildAsBuiltModel({ bundle: lab.bundle, project: lab.project, catalog: withDiagrams(SECTIONS), lang: 'fr' })
    .sections.find(s => s.id === 'env.cabling' && s.clusterName === 'PAR-PROD-01');
  // Ports : la connectique vient de la description du contrôleur, sinon du débit.
  const ports = buildAsBuiltModel({ bundle: lab.bundle, project: lab.project, catalog: withDiagrams(SECTIONS), lang: 'fr' })
    .sections.find(s => s.id === 'env.nodeports' && s.clusterName === 'PAR-PROD-01').data.panels;
  expect(ports.length).toBe(1);   // quatre nœuds identiques, une seule façade
  expect(ports[0].nodes.length).toBe(4);
  const port = (name) => { const p = ports[0].ports.find(x => x.name === name); return [p.speed, p.media, p.active]; };
  expect(port('eth1')).toEqual(['1G', 'rj45', false]);
  expect(port('eth2')).toEqual(['25G', 'sfp', true]);
  expect(port('eth4')).toEqual(['10G', 'rj45', true]);   // 10GBASE-T, lu dans la description du contrôleur
  expect(paris.data.assumed).toBeUndefined();
  // Le tableau « Réseau détaillé » lit les mêmes virtual switches que le schéma.
  const vsw = buildAsBuiltModel({ bundle: lab.bundle, project: lab.project, catalog: withDiagrams(SECTIONS), lang: 'fr' })
    .sections.find(s => s.id === 'cfg.vswitches' && s.clusterName === 'PAR-PROD-01');
  expect(vsw.empty).toBe(false);
  expect(JSON.stringify(vsw.rows)).toContain('Balance-TCP (LACP)');
  expect(renderDiagram(paris.data, 'fr')).toContain('eth2 ↔ Ethernet1/1');
});

test('gros parc : les ports se lisent hôte par hôte, jamais plus de huit à la fois', async () => {
  // L'outil lui-même : ordre conservé, plafond tenu, liste vide sans attente.
  let flying = 0, peak = 0;
  const doubled = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    peak = Math.max(peak, ++flying);
    await Bun.sleep(5);
    flying--;
    return n * 2;
  });
  expect(doubled).toEqual([2, 4, 6, 8, 10, 12, 14]);
  expect(peak).toBe(3);
  expect(await mapLimit([], 3, async () => 1)).toEqual([]);

  const prism = startFakePrism({ hosts: 30 });
  try {
    const bundle = await collectPcBundle({ pcHost: prism.host, pcUser: 'admin', pcPass: 'secret' });
    expect(bundle.pc.data.v4_host_nics.data.length).toBe(30);
    expect(prism.stats.maxInFlight).toBe(HOST_CONCURRENCY);

    prism.stats.maxInFlight = 0;
    expect(await collectPes(bundle, [{ extId: 'c-1', user: 'admin', pass: 'secret' }])).toEqual({ 'c-1': null });
    expect(bundle.clusters[0].data.host_nics_v2.entities.length).toBe(30);
    expect(prism.stats.maxInFlight).toBe(HOST_CONCURRENCY);
  } finally { prism.stop(); }
});

test('le délai par appel se règle par ASBUILT_TIMEOUT_S, 60 s sinon', () => {
  const timeout = (value) => {
    const env = { ...process.env };
    if (value == null) delete env.ASBUILT_TIMEOUT_S; else env.ASBUILT_TIMEOUT_S = value;
    const out = Bun.spawnSync([process.execPath, '-e', "import('./server/bundle.js').then(m => console.log(m.TIMEOUT_MS))"],
      { cwd: path.resolve(import.meta.dir, '..'), env });
    return Number(out.stdout.toString().trim());
  };
  expect(timeout(null)).toBe(60000);
  expect(timeout('180')).toBe(180000);
  expect(timeout('abc')).toBe(60000);
  expect(timeout('0')).toBe(60000);
});
