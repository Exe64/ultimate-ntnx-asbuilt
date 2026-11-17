// Schémas du document. Ils remplacent ceux du moteur (engine/asbuilt/diagrams) : mêmes
// sections, données plus riches, dessin pensé pour sortir tel quel dans un dossier livré.
//
// Deux moitiés : `withDiagrams` branche sur le catalogue les sections qui PRÉPARENT les données,
// `renderDiagram` les DESSINE en SVG. Règles de dessin :
//   - largeur fixe (W) : tous les schémas occupent la largeur utile de la page, à la même échelle ;
//   - une valeur absente ne se dessine pas — ni « — », ni case vide à effacer à la main ;
//   - rien n'est inventé : ce qui est supposé (répartition des uplinks sans LLDP) est dit en légende.
import { speedLabel } from '../engine/asbuilt/normalize';

const W = 900, M = 24;
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const C = {
  ink: '#111827', sub: '#6b7280', line: '#cbd5e1', soft: '#f1f5f9', panel: '#f8fafc', white: '#ffffff',
  brand: '#4338ca', brandSoft: '#eef2ff', cvm: '#7c3aed', cvmSoft: '#f5f3ff', ahv: '#0f766e', ahvSoft: '#f0fdfa',
  data: '#16a34a', dataSoft: '#f0fdf4', mgmt: '#2563eb', mgmtSoft: '#eff6ff',
  storage: '#c2410c', storageSoft: '#fff7ed', off: '#9ca3af', chassis: '#e5e7eb', jack: '#1f2937',
};

const L = {
  fr: {
    pc: 'PRISM CENTRAL', nodes: 'nœuds', node: 'nœud', cores: 'cœurs', ram: 'RAM', storage: 'Stockage', cpu: 'CPU',
    site: 'SITE', cluster: 'CLUSTER', manages: 'administre', guests: 'VM invitées', hw: 'Matériel',
    dsf: 'Stockage distribué Nutanix (DSF)', containers: 'containers', more: 'autres nœuds non représentés',
    ipmi: 'IPMI', unused: 'Hors vSwitch', down: 'lien inactif', active: 'actif',
    inferred: 'Connectique déduite du débit du port.', unknown: 'débit non remonté',
    oob: "Réseau d'administration", assumed: 'Répartition des uplinks entre switches supposée : aucune information LLDP remontée par les hôtes.',
    moreSw: 'autres switches non représentés', subnets: 'RÉSEAUX', uplinks: 'UPLINKS PHYSIQUES', vswitch: 'Virtual switch',
    moreNets: 'autres réseaux (voir tableau)', identical: 'nœuds identiques',
  },
  en: {
    pc: 'PRISM CENTRAL', nodes: 'nodes', node: 'node', cores: 'cores', ram: 'Memory', storage: 'Storage', cpu: 'CPU',
    site: 'SITE', cluster: 'CLUSTER', manages: 'manages', guests: 'Guest VMs', hw: 'Hardware',
    dsf: 'Nutanix Distributed Storage Fabric', containers: 'containers', more: 'more nodes not shown',
    ipmi: 'IPMI', unused: 'No vSwitch', down: 'link down', active: 'active',
    inferred: 'Connector type inferred from port speed.', unknown: 'speed not reported',
    oob: 'Out-of-band management', assumed: 'Uplink-to-switch mapping is assumed: hosts reported no LLDP information.',
    moreSw: 'more switches not shown', subnets: 'SUBNETS', uplinks: 'PHYSICAL UPLINKS', vswitch: 'Virtual switch',
    moreNets: 'more subnets (see table)', identical: 'identical nodes',
  },
};

// ─── Primitives ───────────────────────────────────────────────────────────────

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// ponytail: largeur de texte estimée (0,56 em), pas mesurée — suffisant pour tronquer proprement.
const tw = (s, size, bold) => String(s).length * size * (bold ? 0.6 : 0.56);
const fit = (s, width, size, bold) => {
  const str = String(s ?? '');
  const max = Math.max(2, Math.floor(width / (size * (bold ? 0.6 : 0.56))));
  return str.length <= max ? str : `${str.slice(0, max - 1)}…`;
};
const T = (x, y, s, { size = 12, weight = 400, fill = C.ink, anchor = 'middle', spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${spacing ? ` letter-spacing="${spacing}"` : ''}>${esc(s)}</text>`;
const R = (x, y, w, h, { fill = C.white, stroke = C.line, rx = 8, dash = null, sw = 1 } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const P = (d, { stroke = C.line, sw = 1.5, dash = null } = {}) =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const doc = (h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}"><rect width="${W}" height="${h}" fill="${C.white}"/>${body}</svg>`;

const has = (v) => v != null && v !== '';
const join = (parts, sep = ' · ') => parts.filter(has).join(sep);
const gb = (n, lang) => has(n) ? `${Math.round(n)} ${lang === 'fr' ? 'Go' : 'GB'}` : null;
const tb = (n, lang) => has(n) ? `${Number(n).toFixed(2)} ${lang === 'fr' ? 'To' : 'TB'}` : null;
const ahvOf = (v) => has(v) ? String(v).replace(/^(Nutanix|AHV)\s+/i, '') : null;
const plural = (n, t) => `${n} ${n > 1 ? t.nodes : t.node}`;

/** Positions d'une grille centrée : la dernière ligne, incomplète, est centrée elle aussi. */
function grid(n, cols, itemW, gap, x0 = 0, width = W) {
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    return { row, x: x0 + (width - (inRow * itemW + (inRow - 1) * gap)) / 2 + (i % cols) * (itemW + gap) };
  });
}

/** Pastilles alignées à droite, de droite à gauche. */
function chipsRight(xRight, y, labels, color = C.brand, fill = C.white) {
  let x = xRight;
  return labels.filter(has).reverse().map((label) => {
    const w = tw(label, 11, true) + 18;
    x -= w;
    const svg = R(x, y, w, 22, { fill, stroke: color, rx: 11 }) + T(x + w / 2, y + 15, label, { size: 11, weight: 600, fill: color });
    x -= 8;
    return svg;
  }).join('');
}

/** Cadre à bandeau : le conteneur des schémas « cluster ». */
function frame(x, y, w, h, kicker, title, chips, color = C.brand, soft = C.brandSoft) {
  return R(x, y, w, h, { stroke: color, sw: 1.5, rx: 10 })
    + `<path d="M ${x + 1} ${y + 44} V ${y + 10} a 9 9 0 0 1 9 -9 H ${x + w - 10} a 9 9 0 0 1 9 9 V ${y + 44} Z" fill="${soft}"/>`
    + T(x + 16, y + 18, kicker, { size: 9, weight: 700, fill: color, anchor: 'start', spacing: 1 })
    + T(x + 16, y + 36, fit(title, w * 0.45, 15, true), { size: 15, weight: 700, anchor: 'start' })
    + chipsRight(x + w - 14, y + 12, chips, color);
}

function pcBox(pc, y, t, w = 340) {
  const x = (W - w) / 2;
  return R(x, y, w, 70, { fill: C.brand, stroke: C.brand, rx: 10 })
    + T(W / 2, y + 20, t.pc, { size: 9, weight: 700, fill: '#c7d2fe', spacing: 1.5 })
    + T(W / 2, y + 42, fit(pc.name || pc.host || 'Prism Central', w - 24, 16, true), { size: 16, weight: 700, fill: C.white })
    + T(W / 2, y + 60, fit(join([pc.name ? pc.host : null, pc.version]), w - 24, 11), { size: 11, fill: '#e0e7ff' });
}

// ─── 1. Plateforme : Prism Central et ses clusters ────────────────────────────

function platform(d, lang) {
  const t = L[lang];
  const clusters = d.clusters || [];
  const cardW = 264, gap = 30, headH = 38, rowH = 24;
  const facts = (c) => [
    ['AOS', c.aos], ['AHV', ahvOf(c.ahv)], [t.nodes[0].toUpperCase() + t.nodes.slice(1), c.nodes],
    ['RF', has(c.rf) ? `RF${c.rf}` : null], [t.cpu, has(c.cores) ? `${c.cores} ${t.cores}` : null],
    [t.ram, gb(c.ramGb, lang)], [t.storage, tb(c.storageTb, lang)],
  ].filter(([, v]) => has(v));
  const cardH = headH + Math.max(1, ...clusters.map(c => facts(c).length)) * rowH + 10;
  const cols = Math.min(3, clusters.length || 1);
  const pos = grid(clusters.length, cols, cardW, gap);
  const top = (row) => M + 70 + 54 + row * (cardH + 44);

  const parts = [pcBox(d.pc || {}, M, t)];
  const rows = clusters.length ? pos[pos.length - 1].row + 1 : 0;
  // Chaque rangée a son bus ; au-delà de la première, un tronc latéral les relie au Prism Central.
  const busY = (r) => top(r) - 22;
  for (let r = 0; r < rows; r++) {
    const xs = pos.filter(p => p.row === r).map(p => p.x + cardW / 2);
    const from = r === 0 ? Math.min(W / 2, xs[0]) : 12;
    const to = r === 0 ? Math.max(W / 2, xs[xs.length - 1]) : xs[xs.length - 1];
    parts.push(P(`M ${from} ${busY(r)} H ${to}`, { stroke: C.brand }));
    xs.forEach(x => parts.push(P(`M ${x} ${busY(r)} V ${top(r)}`, { stroke: C.brand })));
  }
  if (rows) parts.push(P(`M ${W / 2} ${M + 70} V ${busY(0)}`, { stroke: C.brand }));
  if (rows > 1) parts.push(P(`M ${Math.min(W / 2, pos[0].x + cardW / 2)} ${busY(0)} H 12 V ${busY(rows - 1)}`, { stroke: C.brand }));

  clusters.forEach((c, i) => {
    const { x, row } = pos[i];
    const y = top(row);
    parts.push(R(x, y, cardW, cardH, { rx: 10 }));
    parts.push(`<path d="M ${x} ${y + headH} V ${y + 10} a 10 10 0 0 1 10 -10 H ${x + cardW - 10} a 10 10 0 0 1 10 10 V ${y + headH} Z" fill="${C.brandSoft}" stroke="${C.line}"/>`);
    parts.push(T(x + 16, y + 25, fit(c.name || 'Cluster', cardW - 32, 14, true), { size: 14, weight: 700, anchor: 'start' }));
    facts(c).forEach(([label, value], k) => {
      const ly = y + headH + 20 + k * rowH;
      parts.push(T(x + 16, ly, label, { size: 11, fill: C.sub, anchor: 'start' }));
      parts.push(T(x + cardW - 16, ly, fit(value, cardW - 110, 12, true), { size: 12, weight: 600, anchor: 'end' }));
      if (k) parts.push(P(`M ${x + 16} ${ly - 16} H ${x + cardW - 16}`, { stroke: C.soft, sw: 1 }));
    });
  });
  return doc(clusters.length ? top(rows - 1) + cardH + M : M * 2 + 70, parts.join(''));
}

// ─── 2. Cluster : site ⊃ cluster ⊃ nœuds ──────────────────────────────────────

const MAX_NODES = 16;

function clusterOverview(d, lang) {
  const t = L[lang];
  const c = d.cluster || {};
  const shown = (d.nodes || []).slice(0, MAX_NODES);
  const hidden = (d.nodes || []).length - shown.length;
  const site = has(d.site);
  const fx = M + (site ? 16 : 0), fw = W - 2 * fx;
  const fy = M + (site ? 34 : 0);
  const cols = Math.min(4, shown.length || 1);
  const tileW = Math.min(250, (fw - 32 - (cols - 1) * 14) / cols), tileH = 96;
  const pos = grid(shown.length, cols, tileW, 14, fx, fw);
  const rows = shown.length ? pos[pos.length - 1].row + 1 : 0;
  const tilesY = fy + 44 + 18;
  const statsY = tilesY + rows * (tileH + 14) + (hidden > 0 ? 18 : 0) + 4;
  const stats = [
    [(d.nodes || []).length || c.nodeCount, t.nodes, C.ink], [c.cores, t.cores, C.mgmt],
    [gb(c.memoryGb, lang), t.ram, C.ahv], [tb(c.storageTb, lang), t.storage.toLowerCase(), C.storage],
  ].filter(([v]) => has(v));
  const fh = statsY + (stats.length ? 58 : 0) - fy + 8;

  const parts = [];
  if (site) {
    parts.push(R(M, M, W - 2 * M, fh + 34 + 16, { fill: C.panel, dash: '6 4', rx: 12 }));
    parts.push(T(M + 16, M + 22, `${t.site} · ${d.site}`, { size: 11, weight: 700, fill: C.sub, anchor: 'start', spacing: 1 }));
  }
  parts.push(frame(fx, fy, fw, fh, t.cluster, c.name || 'Cluster', [
    has(c.aos) ? `AOS ${c.aos}` : null, c.hypervisor, has(c.rf) ? `RF${c.rf}` : null, has(c.vip) ? `VIP ${c.vip}` : null,
  ]));

  shown.forEach((n, i) => {
    const x = pos[i].x, y = tilesY + pos[i].row * (tileH + 14);
    parts.push(R(x, y, tileW, tileH, { rx: 8 }));
    // Façade de serveur stylisée : une unité de rack, ses voyants, ses baies.
    parts.push(R(x + 12, y + 12, tileW - 24, 18, { fill: C.soft, rx: 3 }));
    parts.push(`<circle cx="${x + 22}" cy="${y + 21}" r="2.5" fill="${C.data}"/><circle cx="${x + 31}" cy="${y + 21}" r="2.5" fill="${C.off}"/>`);
    for (let k = 0; k < 6; k++) parts.push(R(x + tileW - 22 - k * 13, y + 16, 9, 10, { fill: C.white, rx: 1.5 }));
    parts.push(T(x + tileW / 2, y + 50, fit(n.name || '—', tileW - 16, 13, true), { size: 13, weight: 700 }));
    parts.push(T(x + tileW / 2, y + 67, fit(join([n.model, n.serial]), tileW - 16, 10.5), { size: 10.5, fill: C.sub }));
    parts.push(T(x + tileW / 2, y + 84, fit(join([has(n.cores) ? `${n.cores} ${t.cores}` : null, gb(n.memoryGb, lang)]), tileW - 16, 11), { size: 11 }));
  });
  if (hidden > 0) parts.push(T(W / 2, statsY - 10, `+ ${hidden} ${t.more}`, { size: 11, fill: C.sub }));

  const sw = (fw - 32) / (stats.length || 1);
  stats.forEach(([value, label, color], i) => {
    const x = fx + 16 + i * sw;
    if (!i) parts.push(P(`M ${fx + 16} ${statsY} H ${fx + fw - 16}`, { sw: 1 }));
    parts.push(T(x + sw / 2, statsY + 30, value, { size: 19, weight: 700, fill: color }));
    parts.push(T(x + sw / 2, statsY + 47, label, { size: 10.5, fill: C.sub }));
  });
  return doc(fy + fh + (site ? 16 : 0) + M, parts.join(''));
}

// ─── 3. Conception logique : PC → cluster → (VM | CVM) / AHV / matériel → DSF ──

function logical(d, lang) {
  const t = L[lang];
  const c = d.cluster || {};
  const shown = (d.nodes || []).slice(0, MAX_NODES);
  const hidden = (d.nodes || []).length - shown.length;
  const hasPc = has(d.pc?.host) || has(d.pc?.name);
  const fx = M, fw = W - 2 * M;
  const fy = M + (hasPc ? 70 + 40 : 0);
  const cols = Math.min(4, shown.length || 1);
  const colW = Math.min(230, (fw - 32 - (cols - 1) * 16) / cols), blockH = 24 + 52 + 6 + 38 + 6 + 38;
  const pos = grid(shown.length, cols, colW, 16, fx, fw);
  const rows = shown.length ? pos[pos.length - 1].row + 1 : 0;
  const blocksY = fy + 44 + 14;
  const dsfY = blocksY + rows * (blockH + 18) + (hidden > 0 ? 16 : 0);
  const fh = dsfY + 50 + 16 - fy;

  const parts = [];
  if (hasPc) {
    parts.push(pcBox(d.pc, M, t));
    parts.push(P(`M ${W / 2} ${M + 70} V ${fy}`, { stroke: C.brand }));
    parts.push(T(W / 2 + 8, M + 70 + 24, t.manages, { size: 10.5, fill: C.sub, anchor: 'start' }));
  }
  parts.push(frame(fx, fy, fw, fh, t.cluster, c.name || 'Cluster', [
    c.hypervisor, has(c.rf) ? `RF${c.rf}` : null, has(c.vip) ? `VIP ${c.vip}` : null, has(c.dsip) ? `DSIP ${c.dsip}` : null,
  ]));

  const layer = (x, y, w, h, title, sub, color, soft) =>
    R(x, y, w, h, { fill: soft, stroke: color, rx: 6 })
    + T(x + w / 2, y + (has(sub) ? h / 2 - 2 : h / 2 + 4), fit(title, w - 10, 12, true), { size: 12, weight: 700, fill: color })
    + (has(sub) ? T(x + w / 2, y + h / 2 + 13, fit(sub, w - 10, 10.5), { size: 10.5, fill: C.ink }) : '');

  shown.forEach((n, i) => {
    const x = pos[i].x, y = blocksY + pos[i].row * (blockH + 18);
    const half = (colW - 8) / 2;
    parts.push(T(x + colW / 2, y + 14, fit(n.name || '—', colW, 12, true), { size: 12, weight: 700 }));
    parts.push(layer(x, y + 24, half, 52, 'VM', t.guests, C.mgmt, C.mgmtSoft));
    parts.push(layer(x + half + 8, y + 24, half, 52, 'CVM', n.cvmIp, C.cvm, C.cvmSoft));
    parts.push(layer(x, y + 82, colW, 38, join([c.hypervisor || 'AHV', ahvOf(n.hypervisorVersion)], ' '), n.hostIp, C.ahv, C.ahvSoft));
    parts.push(layer(x, y + 126, colW, 38, n.model || t.hw, has(n.ipmiIp) ? `${t.ipmi} ${n.ipmiIp}` : null, C.sub, C.soft));
  });
  if (hidden > 0) parts.push(T(W / 2, dsfY - 12, `+ ${hidden} ${t.more}`, { size: 11, fill: C.sub }));

  parts.push(layer(fx + 16, dsfY, fw - 32, 50, t.dsf, join([
    has(c.containers) ? `${c.containers} ${t.containers}` : null, tb(c.storageTb, lang), has(c.rf) ? `RF${c.rf}` : null,
  ]), C.storage, C.storageSoft));
  return doc(fy + fh + M, parts.join(''));
}

// ─── 4. Ports physiques : façade arrière par groupe de nœuds identiques ───────

// Le débit se lit à la couleur, la connectique à la forme : ce sont les deux questions qu'on pose
// à une façade arrière avant de commander des câbles et des optiques.
const SPEED_COLORS = [[100, '#dc2626'], [40, '#d97706'], [25, '#16a34a'], [10, '#2563eb'], [0, '#64748b']];
const speedG = (label) => {
  const m = /^([\d.]+)\s*([GM])/i.exec(String(label ?? ''));
  return m ? Number(m[1]) / (m[2].toUpperCase() === 'M' ? 1000 : 1) : null;
};
const speedColor = (label) => {
  const g = speedG(label);
  return g == null ? C.off : SPEED_COLORS.find(([min]) => g >= min)[1];
};
const mediaLabel = (media, label) => {
  if (media !== 'sfp') return media === 'rj45' ? 'RJ45' : null;
  const g = speedG(label);
  return g >= 100 ? 'QSFP28' : g >= 40 ? 'QSFP+' : g >= 25 ? 'SFP28' : g >= 10 ? 'SFP+' : 'SFP';
};

/** Embase vue de face : RJ45 (carrée, avec son ergot) ou cage SFP (large et plate). */
function jack(cx, y, media, color, { led = null, faded = false } = {}) {
  const body = media === 'sfp'
    ? R(cx - 25, y + 6, 50, 18, { fill: C.jack, stroke: color, sw: 3, rx: 2 })
      + R(cx - 19, y + 11, 38, 8, { fill: '#4b5563', stroke: '#4b5563', rx: 1 })
    : R(cx - 17, y, 34, 28, { fill: C.jack, stroke: color, sw: 3, rx: 4 })
      + (media === 'rj45' ? `<path d="M ${cx - 10} ${y + 7} h 20 v 10 h -6 v 5 h -8 v -5 h -6 z" fill="#4b5563"/>` : '');
  const dot = led == null ? '' : `<circle cx="${cx + (media === 'sfp' ? 32 : 24)}" cy="${y + 6}" r="3" fill="${led ? '#22c55e' : C.off}"/>`;
  return `<g${faded ? ' opacity="0.5"' : ''}>${body}</g>${dot}`;
}

function nodePorts(d, lang) {
  const t = L[lang];
  const panels = (d.panels || []).filter(p => p.ports?.length);
  if (!panels.length) return null;
  const pw = W - 2 * M, cellW = 92, perRow = Math.floor((pw - 24) / cellW), cellH = 96;
  const all = panels.flatMap(p => p.ports);
  const parts = [];
  let y = M;

  panels.forEach((p) => {
    const rows = Math.ceil(p.ports.length / perRow);
    const h = 40 + rows * cellH + 6;
    const title = p.nodes.length > 1 ? `${p.nodes.length} ${t.identical} — ${p.nodes.join(', ')}` : (p.nodes[0] || '');
    parts.push(R(M, y, pw, h, { rx: 10 }));
    parts.push(T(M + 16, y + 25, fit(title, pw - 220, 13, true), { size: 13, weight: 700, anchor: 'start' }));
    if (has(d.nodeModel)) parts.push(T(M + pw - 16, y + 25, fit(d.nodeModel, 180, 11), { size: 11, fill: C.sub, anchor: 'end' }));
    for (let r = 0; r < rows; r++) parts.push(R(M + 12, y + 40 + r * cellH, pw - 24, 44, { fill: C.chassis, stroke: C.chassis, rx: 4 }));

    p.ports.forEach((port, i) => {
      const inRow = Math.min(perRow, p.ports.length - Math.floor(i / perRow) * perRow);
      const cx = M + 12 + (pw - 24 - inRow * cellW) / 2 + (i % perRow) * cellW + cellW / 2;
      const py = y + 40 + Math.floor(i / perRow) * cellH;
      const down = port.active === false;
      parts.push(jack(cx, py + 8, port.media, speedColor(port.speed), { led: port.active, faded: down }));
      parts.push(T(cx, py + 60, fit(port.name || '', cellW - 6, 12, true), { size: 12, weight: 700 }));
      parts.push(T(cx, py + 74, fit(join([port.speed, mediaLabel(port.media, port.speed)]) || (down ? t.down : t.unknown), cellW - 2, 10), { size: 10, fill: C.sub }));
      const role = port.role === 'ipmi' ? null : (port.group ? join([port.group, port.activeUplink ? t.active : null]) : t.unused);
      if (role) parts.push(T(cx, py + 88, fit(role, cellW - 2, 10), { size: 10, weight: 600, fill: port.group ? C.brand : C.off }));
    });
    y += h + 14;
  });

  // Légende : seulement ce que le schéma contient réellement.
  let lx = M;
  const item = (glyph, label, w) => {
    parts.push(glyph(lx));
    parts.push(T(lx + w + 8, y + 12, label, { size: 10.5, fill: C.sub, anchor: 'start' }));
    lx += w + 8 + tw(label, 10.5) + 22;
  };
  const speeds = [...new Set(all.map(p => p.speed).filter(has))].sort((a, b) => speedG(a) - speedG(b));
  speeds.forEach(sp => item(x => R(x, y + 3, 16, 10, { fill: speedColor(sp), stroke: speedColor(sp), rx: 2 }), sp, 16));
  if (all.some(p => p.media === 'rj45')) item(x => `<g transform="scale(0.6) translate(${(x + 10) / 0.6 - 0} ${(y - 1) / 0.6})">${jack(0, 0, 'rj45', C.sub)}</g>`, 'RJ45', 22);
  if (all.some(p => p.media === 'sfp')) item(x => `<g transform="scale(0.6) translate(${(x + 15) / 0.6} ${(y - 1) / 0.6})">${jack(0, 0, 'sfp', C.sub)}</g>`, 'SFP / SFP+ / SFP28', 32);
  if (all.some(p => p.active === false)) item(x => `<g transform="scale(0.6) translate(${(x + 10) / 0.6} ${(y - 1) / 0.6})">${jack(0, 0, null, C.sub, { faded: true })}</g>`, t.down, 22);
  if (d.inferred) parts.push(T(M, y + 34, t.inferred, { size: 10, fill: C.sub, anchor: 'start' }));
  return doc(y + (d.inferred ? 42 : 22) + M, parts.join(''));
}

// ─── 5. Câblage : nœuds en lignes, switches en colonnes, un lien par croisement ─

const MAX_SWITCHES = 4;

function cabling(d, lang) {
  const t = L[lang];
  const nodes = (d.nodes || []).slice(0, MAX_NODES);
  const hiddenNodes = (d.nodes || []).length - nodes.length;
  const switches = (d.switches || []).slice(0, MAX_SWITCHES);
  const hiddenSw = (d.switches || []).length - switches.length;
  const oob = nodes.some(n => has(n.ipmiIp));
  const colCount = switches.length + (oob ? 1 : 0);
  if (!nodes.length || !colCount) return null;

  const leftW = 190, headH = 62, x0 = M + leftW + 16;
  const colW = (W - M - x0) / colCount;
  const linksOf = (n, sw) => (d.links || []).filter(l => l.node === n.name && l.sw === sw.id);
  const rowH = (n) => Math.max(52, Math.max(1, ...switches.map(sw => linksOf(n, sw).length)) * 28 + 20);
  const rowsY = [];
  let y = M + headH + 22;
  nodes.forEach((n) => { rowsY.push(y); y += rowH(n) + 12; });
  const bottom = y - 12;

  const parts = [];
  const colX = (j) => x0 + j * colW;
  const head = (j, title, sub, color, soft, dash) => {
    const x = colX(j) + 8, w = colW - 16;
    parts.push(P(`M ${x + w / 2} ${M + headH} V ${bottom}`, { stroke: color, sw: 2, dash }));
    parts.push(R(x, M, w, headH, { fill: soft, stroke: color, sw: 1.5, dash }));
    const lines = sub.filter(has).slice(0, 2);
    parts.push(T(x + w / 2, M + (lines.length === 2 ? 20 : lines.length ? 26 : 36), fit(title, w - 12, 13, true), { size: 13, weight: 700, fill: color }));
    lines.forEach((s, k) => parts.push(T(x + w / 2, M + (lines.length === 2 ? 36 : 44) + k * 15, fit(s, w - 12, 10.5), { size: 10.5, fill: C.ink })));
  };
  switches.forEach((sw, j) => head(j, sw.name, [sw.model, sw.ip, sw.mode], C.data, C.dataSoft, null));
  if (oob) head(switches.length, t.oob, [t.ipmi], C.mgmt, C.mgmtSoft, '5 4');

  const pill = (j, cy, label, color) => {
    const x = colX(j) + 14, w = colW - 28;
    return R(x, cy - 12, w, 24, { stroke: color, sw: 1.5, rx: 12 }) + T(x + w / 2, cy + 4, fit(label, w - 14, 11), { size: 11, weight: 600 });
  };
  nodes.forEach((n, i) => {
    const top = rowsY[i], h = rowH(n), cy = top + h / 2;
    parts.push(P(`M ${M + leftW} ${cy} H ${W - M - 8}`, { sw: 1 }));
    parts.push(R(M, top, leftW, h, { fill: C.soft }));
    parts.push(T(M + leftW / 2, cy + (has(n.model) ? -2 : 4), fit(n.name || '—', leftW - 14, 12.5, true), { size: 12.5, weight: 700 }));
    if (has(n.model)) parts.push(T(M + leftW / 2, cy + 14, fit(n.model, leftW - 14, 10.5), { size: 10.5, fill: C.sub }));
    switches.forEach((sw, j) => {
      const links = linksOf(n, sw);
      links.forEach((l, k) => parts.push(pill(j, cy + (k - (links.length - 1) / 2) * 28,
        join([join([l.nic, l.port], ' ↔ '), l.speed]), C.data)));
    });
    if (has(n.ipmiIp)) parts.push(pill(switches.length, cy, n.ipmiIp, C.mgmt));
  });

  const notes = [
    d.assumed ? t.assumed : null,
    hiddenNodes > 0 ? `+ ${hiddenNodes} ${t.more}` : null,
    hiddenSw > 0 ? `+ ${hiddenSw} ${t.moreSw}` : null,
  ].filter(Boolean);
  notes.forEach((s, k) => parts.push(T(M, bottom + 26 + k * 16, s, { size: 10.5, fill: C.sub, anchor: 'start' })));
  return doc(bottom + notes.length * 16 + (notes.length ? 18 : 0) + M, parts.join(''));
}

// ─── 6. Réseau virtuel : réseaux ↔ virtual switch ↔ uplinks des hôtes ─────────

const MAX_SUBNETS = 20;

function vnet(d, lang) {
  const t = L[lang];
  const list = (d.switches || []).filter(v => v.subnets.length || v.hosts.length);
  if (!list.length) return null;
  const itemW = 158, itemH = 44, gap = 12, cols = 5, bw = W - 2 * M;
  const parts = [];
  let y = M;

  // Une bande d'éléments (réseaux ou hôtes) dans son cadre, relié à la barre du virtual switch
  // par un seul trait : un trait par élément traverserait les autres dès la deuxième rangée.
  const band = (items, kicker, color, soft, towards) => {
    if (!items.length) return 0;
    const pos = grid(items.length, cols, itemW, gap, M, bw);
    const rows = pos[pos.length - 1].row + 1;
    const h = 30 + rows * (itemH + gap) + 2, link = 14;
    const top = towards === 'down' ? y : y + link;
    parts.push(P(towards === 'down' ? `M ${W / 2} ${top + h} v ${link}` : `M ${W / 2} ${y} v ${link}`, { stroke: C.brand, sw: 2 }));
    parts.push(R(M, top, bw, h, { fill: C.panel, dash: '5 4', rx: 8 }));
    parts.push(T(M + 14, top + 19, kicker, { size: 9.5, weight: 700, fill: C.sub, anchor: 'start', spacing: 1 }));
    items.forEach((it, i) => {
      const x = pos[i].x, iy = top + 30 + pos[i].row * (itemH + gap);
      parts.push(R(x, iy, itemW, itemH, { fill: soft, stroke: color, rx: 6 }));
      parts.push(T(x + itemW / 2, iy + (has(it.sub) ? 18 : 27), fit(it.title, itemW - 10, 12, true), { size: 12, weight: 700 }));
      if (has(it.sub)) parts.push(T(x + itemW / 2, iy + 34, fit(it.sub, itemW - 10, 10.5), { size: 10.5, fill: C.sub }));
    });
    return h + link;
  };

  list.forEach((v) => {
    const nets = v.subnets.slice(0, MAX_SUBNETS);
    const more = v.subnets.length - nets.length;
    const netsTop = y;
    y += band(nets.map(s => ({ title: s.name, sub: join([has(s.vlan) ? `VLAN ${s.vlan}` : null, s.cidr]) })), t.subnets, C.mgmt, C.mgmtSoft, 'down');
    if (more > 0) parts.push(T(W - M - 14, netsTop + 19, `+ ${more} ${t.moreNets}`, { size: 10.5, fill: C.sub, anchor: 'end' }));
    parts.push(R(M, y, bw, 46, { fill: C.brand, stroke: C.brand, rx: 8 }));
    parts.push(T(M + 18, y + 28, fit(v.name || t.vswitch, 300, 15, true), { size: 15, weight: 700, fill: C.white, anchor: 'start' }));
    parts.push(chipsRight(M + bw - 14, y + 12, [
      v.bridge, has(v.bond) ? `Bond ${String(v.bond).replace(/_/g, '-').toLowerCase()}` : null, has(v.mtu) ? `MTU ${v.mtu}` : null,
    ], C.white, C.brand));
    y += 46;
    y += band(v.hosts.map(h => ({
      title: h.name || '—',
      // Au-delà de trois, la liste ne tient plus : le nombre, et l'uplink actif quand il est connu.
      sub: h.nics.length <= 3 ? h.nics.join(' + ') : join([`${h.nics.length} ports`, h.active ? `${t.active} ${h.active}` : null]),
    })), t.uplinks, C.data, C.dataSoft, 'up');
    y += 26;
  });
  return doc(y - 26 + M, parts.join(''));
}

const BUILDERS = { platform, cluster: clusterOverview, logical, 'node-ports': nodePorts, cabling, vnet };

export function renderDiagram(data, lang = 'fr') {
  const build = data && BUILDERS[data.shape];
  return build ? build(data, L[lang] ? lang : 'fr') || null : null;
}

// ─── Données des schémas ──────────────────────────────────────────────────────

/** Virtual switches du cluster, avec les uplinks de chaque hôte nommé. */
function virtualSwitches(ctx) {
  const hostName = new Map(ctx.cluster.list('v4_hosts').map(h => [h.extId, h.hostName || h.name]));
  return ctx.pc.list('v4_virtual_switches').map((vs) => {
    const mine = (vs.clusters || []).find(c => c.extId === ctx.cluster.uuid)
      || (ctx.allClusters.length === 1 ? (vs.clusters || [])[0] : null);
    if (!mine) return null;
    const hosts = (mine.hosts || []).map(h => ({
      name: hostName.get(h.extId) || null, bridge: h.internalBridgeName || null, nics: h.hostNics || [], active: h.activeUplink || null,
    }));
    return { extId: vs.extId, name: vs.name, bond: vs.bondMode || null, mtu: vs.mtu ?? null, bridge: hosts.find(h => h.bridge)?.bridge || null, hosts };
  }).filter(Boolean);
}

const pick = (o, ...keys) => keys.map(k => o?.[k]).find(v => has(v) && !/^(none|null|unknown)$/i.test(String(v))) ?? null;

/**
 * Ports physiques de chaque hôte, tels que la plateforme les décrit — v2 du Prism Element et v4
 * du Prism Central fusionnés, parce qu'aucune des deux API ne dit tout.
 *
 * Ce qui n'est PAS remonté se déduit, dans cet ordre, et le schéma le dit :
 *   débit        vitesse du lien, sinon capacité du port, sinon ce qu'en dit la description du contrôleur ;
 *   connectique  description du contrôleur (« SFP28 », « 10GBASE-T »…), sinon le débit — au-delà de
 *                10G c'est une cage SFP, en dessous du RJ45, et à 10G le choix saisi pour le cluster ;
 *   lien         état déclaré, sinon : un port sans vitesse sur un hôte qui en remonte ailleurs est éteint.
 */
function hostPorts(ctx) {
  const v2 = ctx.cluster.list('host_nics_v2');
  const v4 = ctx.pc.list('v4_host_nics');
  const vss = virtualSwitches(ctx);
  const ten = ctx.plan('tenGigMedia') === 'rj45' ? 'rj45' : 'sfp';

  return ctx.cluster.nodes.map((node) => {
    const of = (list) => list.filter(n => (n._host_name || n.host_name) === node.name);
    const a = of(v2), b = of(v4);
    const names = [...new Set([...a, ...b].map(n => n.name).filter(Boolean))]
      .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
    const anySpeed = [...a, ...b].some(n => n.link_speed_in_kbps || n.linkSpeedInKbps);

    const ports = names.map((name) => {
      const n2 = a.find(n => n.name === name), n4 = b.find(n => n.name === name);
      const desc = String(pick(n4, 'hostDescription', 'description') || pick(n2, 'description') || '');
      const linkKbps = pick(n2, 'link_speed_in_kbps') || pick(n4, 'linkSpeedInKbps');
      const capMbps = pick(n4, 'linkCapacityInMbps') || pick(n2, 'link_capacity_in_mbps');
      const fromDesc = /(\d+)\s*G(?:b|BASE|igabit)/i.exec(desc)?.[1] || (/gigabit/i.test(desc) ? 1 : null);
      const speed = speedLabel(linkKbps) || speedLabel(capMbps && capMbps * 1000) || (fromDesc ? `${fromDesc}G` : null);

      const status = pick(n4, 'interfaceStatus') ?? pick(n2, 'status', 'link_status');
      const active = status != null ? /^(up|true|1|connected)$/i.test(String(status)) : (linkKbps ? true : (anySpeed ? false : null));

      const g = speedG(speed);
      let media = /q?sfp|fib(er|re)|\bdac\b/i.test(desc) ? 'sfp' : /base-?t\b|rj-?45|copper/i.test(desc) ? 'rj45' : null;
      const mediaFrom = media ? 'api' : (g != null ? 'speed' : null);
      if (!media && g != null) media = g > 10 ? 'sfp' : g === 10 ? ten : 'rj45';

      const vs = vss.find(v => v.hosts.some(h => h.name === node.name && h.nics.includes(name)));
      const activeUplink = !!vs && vs.hosts.some(h => h.name === node.name && h.active === name);
      return {
        name, speed, media, mediaFrom, active, group: vs?.name || null, activeUplink,
        // Sans virtual switch lisible, un port dont le lien est monté est tenu pour un uplink.
        role: vs || (!vss.length && active) ? 'uplink' : 'unused',
        sw: pick(n2, 'switch_device_id', 'switch_dev_id') || pick(n4, 'switchDeviceId'),
        swPort: pick(n2, 'switch_port_id') || pick(n4, 'switchPortId'),
        swIp: pick(n2, 'switch_management_ip', 'switch_mgmt_ip_address') || pick(n4, 'switchManagementIp'),
        swModel: pick(n2, 'switch_hardware_platform', 'switch_vendor_info') || pick(n4, 'switchVendorInfo'),
      };
    });
    return { node: node.name, ports };
  }).filter(n => n.ports.length);
}

const OVERRIDES = {
  'pc.overview': (ctx) => ({
    data: {
      shape: 'platform',
      pc: { host: ctx.pc.host, name: ctx.pc.name, version: ctx.pc.version },
      clusters: ctx.allClusters.map(c => ({
        name: c.name, aos: c.aosVersion, ahv: c.hypervisorVersion, nodes: c.nodeCount, rf: c.rf,
        cores: c.cpuCores, ramGb: c.memoryGb, storageTb: c.storageTb,
      })),
    },
  }),

  'env.overview': (ctx) => {
    const c = ctx.cluster;
    return {
      data: {
        shape: 'cluster', site: ctx.plan('siteId'),
        cluster: { name: c.name, aos: c.aosVersion, hypervisor: c.hypervisor, rf: c.rf, vip: c.vip, nodeCount: c.nodeCount, cores: c.cpuCores, memoryGb: c.memoryGb, storageTb: c.storageTb },
        nodes: c.nodes.map(n => ({ name: n.name, model: n.model, serial: n.serial, cores: n.cores, memoryGb: n.memoryGb })),
      },
    };
  },

  'host.logical': (ctx) => {
    const c = ctx.cluster;
    if (!c.nodes.length) return null;
    return {
      data: {
        shape: 'logical',
        pc: { host: ctx.pc.host, name: ctx.pc.name, version: ctx.pc.version },
        cluster: { name: c.name, hypervisor: c.hypervisor, rf: c.rf, vip: c.vip, dsip: c.dsip, storageTb: c.storageTb, containers: c.containers.length || null },
        nodes: c.nodes.map(n => ({ name: n.name, model: n.model, cvmIp: n.cvmIp, hostIp: n.hostIp, ipmiIp: n.ipmiIp, hypervisorVersion: n.hypervisorVersion })),
      },
    };
  },

  'env.nodeports': (ctx) => {
    // Deux nœuds au même jeu de ports sont dessinés une fois, et nommés tous les deux.
    const panels = new Map();
    let inferred = false;
    for (const n of hostPorts(ctx)) {
      // Le switch d'en face n'entre pas dans la signature : deux nœuds câblés sur des ports de
      // switch différents ont quand même la même façade.
      const ports = [
        { name: 'IPMI', speed: '1G', media: 'rj45', role: 'ipmi', active: null },
        ...n.ports.map(({ name, speed, media, active, group, activeUplink, role }) => ({ name, speed, media, active, group, activeUplink, role })),
      ];
      inferred ||= n.ports.some(p => p.mediaFrom === 'speed');
      const key = JSON.stringify(ports);
      if (!panels.has(key)) panels.set(key, { nodes: [], ports });
      panels.get(key).nodes.push(n.node);
    }
    return panels.size ? { data: { shape: 'node-ports', nodeModel: ctx.cluster.blockModel, inferred, panels: [...panels.values()] } } : null;
  },

  'env.cabling': (ctx) => {
    const nodes = ctx.cluster.nodes.map(n => ({ name: n.name, model: n.model, ipmiIp: n.ipmiIp }));
    if (!nodes.length) return null;
    const ports = hostPorts(ctx);
    // 1. Ce que les hôtes ont appris de leurs voisins (LLDP/CDP) : le câblage réel.
    const seen = ports.flatMap(n => n.ports.filter(p => p.sw).map(p => ({ node: n.node, nic: p.name, speed: p.speed, sw: p.sw, port: p.swPort, ip: p.swIp, model: p.swModel })));
    if (seen.length) {
      const ids = [...new Set(seen.map(l => l.sw))].sort();
      const first = (id, key) => seen.find(l => l.sw === id && l[key])?.[key] || null;
      return {
        data: {
          shape: 'cabling', nodes, links: seen,
          switches: ids.map(id => ({ id, name: id, model: first(id, 'model') || ctx.plan('switchModel'), ip: first(id, 'ip'), mode: ctx.plan('switchMode') })),
        },
      };
    }
    // 2. À défaut, les switches saisis : les uplinks dont le lien est monté y sont répartis à tour
    //    de rôle, et le schéma dit que cette répartition est supposée.
    const tor = Number(ctx.plan('torSwitches')) || 0;
    if (!tor) return nodes.some(n => has(n.ipmiIp)) ? { data: { shape: 'cabling', nodes, switches: [], links: [] } } : null;
    const switches = Array.from({ length: tor }, (_, i) => ({
      id: `tor${i}`, name: `ToR-${String.fromCharCode(65 + i)}`, model: ctx.plan('switchModel'), mode: ctx.plan('switchMode'),
    }));
    const links = nodes.flatMap((n) => {
      const up = (ports.find(p => p.node === n.name)?.ports || []).filter(p => p.role === 'uplink' && p.active !== false);
      const uplinks = up.length ? up : switches.map(() => ({ name: null, speed: ctx.plan('portSpeed') }));
      return uplinks.map((p, i) => ({ node: n.name, sw: switches[i % tor].id, nic: p.name, port: null, speed: p.speed || ctx.plan('portSpeed') }));
    });
    return { data: { shape: 'cabling', nodes, switches, links, assumed: true } };
  },
};

const VNET_SECTION = {
  id: 'cfg.vnet', chapter: 'cfg', kind: 'diagram',
  title: { fr: 'Schéma du réseau virtuel', en: 'Virtual Network Diagram' },
  build: (ctx) => {
    const vss = virtualSwitches(ctx).map(v => ({ ...v, subnets: [] }));
    // v4 rattache un réseau à ses clusters par une liste (`clusterReferenceList`) : on la lit au
    // niveau du Prism Central plutôt que de se fier à la répartition par cluster.
    const mine = ctx.pc.list('v4_subnets').filter(s => (s.clusterReferenceList || [s.clusterReference]).includes(ctx.cluster.uuid));
    const raw = mine.length ? mine : ctx.cluster.list('v4_subnets');
    const subnets = raw.length
      ? raw.map((s) => {
        const ip = s.ipConfig?.[0]?.ipv4?.ipSubnet;
        return { name: s.name, vlan: s.networkId ?? null, cidr: ip?.ip?.value ? `${ip.ip.value}/${ip.prefixLength}` : null, vs: s.virtualSwitchReference || s.virtualSwitch?.extId || null };
      })
      : ctx.cluster.networks.map(n => ({ name: n.name, vlan: n.vlan, cidr: has(n.subnet) ? `${n.subnet}/${n.prefix}` : null, vs: null }));
    if (!vss.length && !subnets.length) return null;
    if (!vss.length) vss.push({ name: null, bond: null, mtu: null, bridge: null, hosts: [], subnets: [] });
    subnets.sort((a, b) => (a.vlan ?? 0) - (b.vlan ?? 0) || String(a.name).localeCompare(String(b.name)));
    for (const s of subnets) (vss.find(v => v.extId && v.extId === s.vs) || vss[0]).subnets.push(s);
    return { data: { shape: 'vnet', switches: vss } };
  },
};

/** Le catalogue du moteur, avec les schémas de web/ à la place des siens. */
export function withDiagrams(catalog) {
  return catalog.flatMap((s) => {
    const section = OVERRIDES[s.id] ? { ...s, build: OVERRIDES[s.id] } : s;
    return s.id === 'cfg.networks' ? [section, VNET_SECTION] : [section];
  });
}
