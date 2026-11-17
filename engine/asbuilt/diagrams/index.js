import { PALETTE, card, rect, text, line, elbow, svgDocument, fit, CARD_W, ROW_H, HEADER_H } from './svg';

// Les schémas du document (cf. docs/ASBUILT.md §7.4). Chacun prend les données produites
// par une section du catalogue (`block.data`, avec son `shape`) et rend une chaîne SVG.
//
// Rien n'est inventé : une valeur absente s'affiche « — ». Un schéma qui comblerait les trous
// mentirait plus fort qu'un tableau, parce qu'on le lit sans le relire.

const MARGIN = 16;
const GAP = 14;
const MAX_NODE_CARDS = 12;

const L = {
  fr: {
    site: 'Emplacement', aos: 'AOS', ahv: 'AHV', hyp: 'Hyperviseur', cores: 'Cœurs', ram: 'RAM',
    storage: 'Stockage', nodes: 'Nœuds', cluster: 'Cluster', nutanix: 'Nutanix',
    more: 'nœuds identiques', ipmi: 'Switch IPMI', tor: 'ToR', pc: 'Prism Central',
    registered: 'clusters enregistrés', mode: 'Mode', speed: 'Débit', managed: 'administre',
    ipmiPort: 'IPMI (administration matérielle)', dataPort: 'Standard (données)',
    portsHidden: 'autres raccordements non représentés', inactive: 'lien inactif',
  },
  en: {
    site: 'Location', aos: 'AOS', ahv: 'AHV', hyp: 'Hypervisor', cores: 'Cores', ram: 'Memory',
    storage: 'Storage', nodes: 'Nodes', cluster: 'Cluster', nutanix: 'Nutanix',
    more: 'identical nodes', ipmi: 'IPMI switch', tor: 'ToR', pc: 'Prism Central',
    registered: 'registered clusters', mode: 'Mode', speed: 'Speed', managed: 'manages',
    ipmiPort: 'IPMI (out-of-band management)', dataPort: 'Standard (data)',
    portsHidden: 'further port layouts not shown', inactive: 'link down',
  },
};

const dict = (lang) => L[lang] || L.fr;
const gb = (n, lang) => n == null ? null : `${Number(n).toFixed(0)} ${lang === 'fr' ? 'Go' : 'GB'}`;
const tb = (n, lang) => n == null ? null : `${Number(n).toFixed(2)} ${lang === 'fr' ? 'To' : 'TB'}`;

// ─── 1. Carte d'implantation + carte cluster ──────────────────────────────────

function clusterCard(data, lang) {
  const t = dict(lang);
  const c = data.cluster || {};
  const nodes = (data.nodes || []).slice(0, MAX_NODE_CARDS);

  const site = card(MARGIN, MARGIN, c.name || t.cluster, [
    [t.site, c.site, PALETTE.site],
    [t.aos, c.aos, PALETTE.accent],
    [t.hyp, c.hypervisorVersion || c.hypervisor, PALETTE.hypervisor],
    [t.cores, c.cores, PALETTE.cpu],
    [t.ram, gb(c.memoryGb, lang), PALETTE.ram],
    [t.storage, tb(c.storageTb, lang), PALETTE.disk],
  ]);

  const summary = card(MARGIN + site.width + GAP, MARGIN, c.name || t.cluster, [
    [t.nutanix, c.hypervisor || 'AHV', PALETTE.hypervisor],
    [t.nodes, nodes.length || null, PALETTE.ink],
    [t.cores, c.cores, PALETTE.cpu],
    [t.ram, gb(c.memoryGb, lang), PALETTE.ram],
    [t.storage, tb(c.storageTb, lang), PALETTE.disk],
  ]);

  const nodesBlock = nodeCardRow(nodes, data.nodes?.length || 0, MARGIN + site.width + GAP + summary.width + GAP, MARGIN, lang);
  const width = MARGIN * 2 + site.width + GAP + summary.width + (nodesBlock.width ? GAP + nodesBlock.width : 0);
  const height = MARGIN * 2 + Math.max(site.height, summary.height, nodesBlock.height);
  return svgDocument(width, height, site.svg + summary.svg + nodesBlock.svg, { title: c.name || t.cluster });
}

// ─── 2. Cartes de nœuds ───────────────────────────────────────────────────────

function nodeCardRow(nodes, total, x0, y0, lang) {
  const t = dict(lang);
  if (!nodes.length) return { svg: '', width: 0, height: 0 };
  const parts = [];
  let x = x0, height = 0;
  nodes.forEach((n) => {
    const c = card(x, y0, n.name || '—', [
      [t.cores, n.cores, PALETTE.cpu],
      [t.ram, gb(n.memoryGb, lang), PALETTE.ram],
      [t.storage, tb(n.storageTb, lang), PALETTE.disk],
    ]);
    parts.push(c.svg);
    height = Math.max(height, c.height);
    x += c.width + GAP;
  });
  const hidden = total - nodes.length;
  if (hidden > 0) {
    // Au-delà du plafond, une carte de repli annonce le reste : rien n'est masqué en silence.
    parts.push(rect(x, y0, CARD_W, height, { dash: '4 3' }));
    parts.push(text(x + CARD_W / 2, y0 + height / 2 - 4, `+${hidden}`, { size: 20, weight: 800, color: PALETTE.muted }));
    parts.push(text(x + CARD_W / 2, y0 + height / 2 + 14, fit(t.more, CARD_W - 10, 9), { size: 9, color: PALETTE.label }));
    x += CARD_W + GAP;
  }
  return { svg: parts.join(''), width: x - x0 - GAP, height };
}

function nodeCards(data, lang) {
  const nodes = (data.nodes || []).slice(0, MAX_NODE_CARDS);
  const row = nodeCardRow(nodes, (data.nodes || []).length, MARGIN, MARGIN, lang);
  if (!row.width) return null;
  return svgDocument(MARGIN * 2 + row.width, MARGIN * 2 + row.height, row.svg);
}

// ─── 3. Schéma de câblage ─────────────────────────────────────────────────────

function cabling(data, lang) {
  const t = dict(lang);
  const torCount = Math.max(0, Number(data.tor?.count) || 0);
  const nodeCount = Math.max(1, Number(data.nodes) || 1);
  const speed = data.tor?.speed || '—';

  const switchW = 150, switchH = 42, nodeW = 118, nodeH = 46;
  const switches = [
    { label: `${t.ipmi} (${data.ipmi?.speed || '1G'})`, color: PALETTE.linkAlt, kind: 'ipmi' },
    ...Array.from({ length: torCount }, (_, i) => ({ label: `${t.tor}${i + 1} (${speed})`, color: PALETTE.link, kind: 'tor' })),
  ];

  const width = Math.max(
    MARGIN * 2 + switches.length * (switchW + GAP) - GAP,
    MARGIN * 2 + nodeCount * (nodeW + GAP) - GAP,
    460,
  );
  // Chaque switch descend dans SON couloir horizontal, et rejoint chaque nœud sur SON point
  // d'attache : deux liaisons ne partagent donc jamais un segment. Un tracé fusionné laisserait
  // croire à un câblage mutualisé, ce qui est exactement le contraire de ce qu'on documente.
  const laneGap = 16;
  const lane0 = MARGIN + switchH + 24;
  const nodesY = lane0 + switches.length * laneGap + 34;
  const height = nodesY + nodeH + 30;

  const parts = [];
  const switchX = (j) => MARGIN + j * (switchW + GAP);
  const nodeX = (i) => MARGIN + i * (nodeW + GAP);
  // Points d'attache répartis sur la largeur du nœud, un par switch.
  const portX = (i, j) => nodeX(i) + (nodeW * (j + 1)) / (switches.length + 1);

  switches.forEach((sw, j) => {
    const x = switchX(j);
    parts.push(rect(x, MARGIN, switchW, switchH, { fill: PALETTE.headerBg }));
    parts.push(text(x + switchW / 2, MARGIN + 26, fit(sw.label, switchW - 10, 11), { size: 11, weight: 700 }));

    const lane = lane0 + j * laneGap;
    const cx = x + switchW / 2;
    parts.push(line(cx, MARGIN + switchH, cx, lane, { color: sw.color, width: 2 }));
    for (let i = 0; i < nodeCount; i++) {
      const px = portX(i, j);
      parts.push(line(Math.min(cx, px), lane, Math.max(cx, px), lane, { color: sw.color, width: 2 }));
      parts.push(line(px, lane, px, nodesY, { color: sw.color, width: 2 }));
      parts.push(`<circle cx="${px}" cy="${nodesY}" r="2.5" fill="${sw.color}"/>`);
    }
  });

  for (let i = 0; i < nodeCount; i++) {
    parts.push(rect(nodeX(i), nodesY, nodeW, nodeH, { fill: PALETTE.headerBg }));
    parts.push(text(nodeX(i) + nodeW / 2, nodesY + 22, fit(data.nodeModel || `${t.nodes} ${i + 1}`, nodeW - 8, 10), { size: 10, weight: 700 }));
    parts.push(text(nodeX(i) + nodeW / 2, nodesY + 37, `#${i + 1}`, { size: 9, color: PALETTE.label }));
  }

  const legend = [data.tor?.model, data.tor?.mode && `${t.mode} ${data.tor.mode}`, speed !== '—' && `${t.speed} ${speed}`]
    .filter(Boolean).join(' · ');
  if (legend) parts.push(text(MARGIN, height - 8, legend, { size: 10, color: PALETTE.label, anchor: 'start' }));

  return svgDocument(width, height, parts.join(''));
}

// ─── 3 bis. Ports physiques d'un nœud ─────────────────────────────────────────

const PORT_W = 74, PORT_H = 46, PORT_GAP = 8, PORTS_PER_ROW = 8;
const PANEL_PAD = 12, PANEL_HEAD = 26;

// La couleur d'un port est celle du switch qui le reçoit dans le schéma de câblage : IPMI en
// bleu, uplink de données en vert. Les deux schémas se lisent alors l'un avec l'autre, ce qui est
// tout l'intérêt de les mettre côte à côte.
const portColor = (p) => {
  if (p.role === 'ipmi') return PALETTE.linkAlt;
  return p.active === false ? PALETTE.muted : PALETTE.link;
};

function nodePorts(data, lang) {
  const t = dict(lang);
  const panels = (data.panels || []).filter(p => (p.ports || []).length);
  if (!panels.length) return null;

  const cols = Math.min(PORTS_PER_ROW, Math.max(...panels.map(p => p.ports.length)));
  // Plancher de largeur : l'en-tête porte le nom des nœuds et le modèle, un panneau à deux ports
  // les tronquerait tous les deux.
  const panelW = Math.max(PANEL_PAD * 2 + cols * (PORT_W + PORT_GAP) - PORT_GAP, 320);
  const titleW = Math.max(70, panelW - (data.nodeModel ? 140 : 20));
  const rowsOf = (p) => Math.ceil(p.ports.length / PORTS_PER_ROW);
  const heightOf = (p) => PANEL_HEAD + PANEL_PAD * 2 + rowsOf(p) * (PORT_H + PORT_GAP) - PORT_GAP;

  const legend = [[PALETTE.linkAlt, t.ipmiPort], [PALETTE.link, t.dataPort]];
  if (panels.some(p => p.ports.some(port => port.active === false))) legend.push([PALETTE.muted, t.inactive]);
  const legendW = legend.reduce((w, [, label]) => w + 38 + Math.round(label.length * 5.4), 0);
  const legendH = 22 + (data.hidden ? 16 : 0);

  const width = Math.max(MARGIN * 2 + panelW, MARGIN * 2 + legendW, 460);
  const height = MARGIN * 2 + panels.reduce((s, p) => s + heightOf(p) + GAP, 0) - GAP + legendH;

  const parts = [];
  let y = MARGIN;
  panels.forEach((p) => {
    const h = heightOf(p);
    parts.push(rect(MARGIN, y, panelW, h));
    parts.push(rect(MARGIN, y, panelW, PANEL_HEAD, { fill: PALETTE.headerBg }));
    // Un panneau vaut pour tous les nœuds qui partagent ce raccordement : il les nomme, ou les
    // compte quand le relevé n'est pas nominatif (façade décrite depuis la saisie du Build).
    const title = p.nodes?.length ? p.nodes.join(', ') : `${p.count || ''} ${t.nodes.toLowerCase()}`.trim();
    parts.push(text(MARGIN + 10, y + 17, fit(title, titleW, 11), { size: 11, weight: 700, anchor: 'start' }));
    if (data.nodeModel) {
      parts.push(text(MARGIN + panelW - 10, y + 17, fit(data.nodeModel, 116, 9), { size: 9, color: PALETTE.label, anchor: 'end' }));
    }

    p.ports.forEach((port, i) => {
      const px = MARGIN + PANEL_PAD + (i % PORTS_PER_ROW) * (PORT_W + PORT_GAP);
      const py = y + PANEL_HEAD + PANEL_PAD + Math.floor(i / PORTS_PER_ROW) * (PORT_H + PORT_GAP);
      const color = portColor(port);
      parts.push(rect(px, py, PORT_W, PORT_H));
      parts.push(rect(px, py, PORT_W, 5, { fill: color, stroke: color, rx: 2 }));
      parts.push(text(px + PORT_W / 2, py + 22, fit(port.name || '—', PORT_W - 8, 10), { size: 10, color: PALETTE.label }));
      // Le débit se lit d'abord : il reste en encre, la fonction se disant par le bandeau. Un lien
      // éteint, lui, s'écrit en gris — c'est un port présent mais qui ne transporte rien.
      const speedColor = port.role === 'data' && port.active !== false ? PALETTE.ink : color;
      parts.push(text(px + PORT_W / 2, py + 38, fit(port.speed || '—', PORT_W - 8, 12), { size: 12, weight: 700, color: speedColor }));
    });
    y += h + GAP;
  });

  let lx = MARGIN;
  const legendY = height - legendH + 6;
  legend.forEach(([color, label]) => {
    parts.push(rect(lx, legendY, 14, 8, { fill: color, stroke: color, rx: 2 }));
    parts.push(text(lx + 20, legendY + 8, label, { size: 9, color: PALETTE.label, anchor: 'start' }));
    lx += 38 + Math.round(label.length * 5.4);
  });
  if (data.hidden) {
    parts.push(text(MARGIN, legendY + 24, `+${data.hidden} ${t.portsHidden}`, { size: 9, color: PALETTE.label, anchor: 'start' }));
  }

  return svgDocument(width, height, parts.join(''));
}

// ─── 3 ter. Conception logique : Prism Central → cluster → nœuds ──────────────

function logicalDesign(data, lang) {
  const t = dict(lang);
  const pc = data.pc || {};
  const cl = data.cluster || {};
  const nodes = (data.nodes || []).slice(0, MAX_NODE_CARDS);

  const pcW = 230, pcH = 66, clusterW = 230, clusterH = 62;
  const row = nodeCardRow(nodes, (data.nodes || []).length, 0, 0, lang);
  const width = Math.max(MARGIN * 2 + row.width, MARGIN * 2 + pcW, 460);
  const pcY = MARGIN;
  const clusterY = pcY + pcH + 34;
  const nodesY = clusterY + clusterH + 34;
  const height = nodesY + (row.height || 0) + MARGIN;

  const cx = width / 2;
  const parts = [];

  // Prism Central : ce qui administre. Le mode (dédié, PCBR, attaché) vient du Build.
  parts.push(rect(cx - pcW / 2, pcY, pcW, pcH, { fill: PALETTE.headerBg }));
  parts.push(text(cx, pcY + 22, fit(pc.name || t.pc, pcW - 12, 12), { size: 12, weight: 700 }));
  parts.push(text(cx, pcY + 38, fit(pc.host || '—', pcW - 12, 10), { size: 10, color: PALETTE.label }));
  parts.push(text(cx, pcY + 54, fit([pc.version, pc.mode && `${t.mode} ${pc.mode}`].filter(Boolean).join(' · ') || t.pc, pcW - 12, 10),
    { size: 10, color: PALETTE.accent }));

  parts.push(line(cx, pcY + pcH, cx, clusterY, { color: PALETTE.muted, width: 2 }));
  parts.push(text(cx + 6, pcY + pcH + 20, t.managed, { size: 9, color: PALETTE.label, anchor: 'start' }));

  parts.push(rect(cx - clusterW / 2, clusterY, clusterW, clusterH, { fill: PALETTE.cardBg }));
  parts.push(text(cx, clusterY + 22, fit(cl.name || t.cluster, clusterW - 12, 12), { size: 12, weight: 700 }));
  parts.push(text(cx, clusterY + 40, fit([
    cl.hypervisor, cl.vip, cl.rf != null ? `RF${cl.rf}` : null, cl.nodeCount ? `${cl.nodeCount} ${t.nodes.toLowerCase()}` : null,
  ].filter(Boolean).join(' · ') || '—', clusterW - 12, 10), { size: 10, color: PALETTE.label }));

  if (nodes.length) {
    const startX = (width - row.width) / 2;
    nodes.forEach((n, i) => {
      const cardX = startX + i * (CARD_W + GAP);
      parts.push(line(cx, clusterY + clusterH, cardX + CARD_W / 2, nodesY, { color: PALETTE.muted }));
    });
    parts.push(nodeCardRow(nodes, (data.nodes || []).length, startX, nodesY, lang).svg);
  }
  return svgDocument(width, height, parts.join(''));
}

// ─── 4. Vue d'ensemble Prism Central ──────────────────────────────────────────

function pcOverview(data, lang) {
  const t = dict(lang);
  const clusters = data.clusters || [];
  const pcW = 220, pcH = 62;
  const cols = Math.max(1, Math.min(4, clusters.length || 1));
  const cardW = CARD_W;
  const rowsCount = Math.ceil((clusters.length || 1) / cols);

  const width = Math.max(MARGIN * 2 + cols * (cardW + GAP) - GAP, MARGIN * 2 + pcW, 420);
  const cardsTop = MARGIN + pcH + 46;
  // Hauteur réservée à une carte, sous-titre compris : la déduire des primitives évite qu'ajouter
  // une ligne à la carte fasse déborder la grille sans que rien ne le dise.
  const cardRows = 6;
  const cardH = HEADER_H + (clusters.some(c => c.pcMode) ? 12 : 0) + cardRows * ROW_H;
  const height = cardsTop + rowsCount * (cardH + GAP) - GAP + MARGIN;

  const pcX = (width - pcW) / 2;
  const parts = [
    rect(pcX, MARGIN, pcW, pcH, { fill: PALETTE.headerBg }),
    text(width / 2, MARGIN + 24, fit(data.pc?.name || t.pc, pcW - 12, 12), { size: 12, weight: 700 }),
    text(width / 2, MARGIN + 41, fit(data.pc?.host || '—', pcW - 12, 10), { size: 10, color: PALETTE.label }),
    text(width / 2, MARGIN + 55, fit(data.pc?.version || '—', pcW - 12, 10), { size: 10, color: PALETTE.accent }),
  ];

  clusters.forEach((c, i) => {
    const col = i % cols, rowIdx = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + GAP);
    const y = cardsTop + rowIdx * (cardH + GAP);
    parts.push(elbow(width / 2, MARGIN + pcH, x + cardW / 2, y, { color: PALETTE.muted, width: 1 }));
    parts.push(card(x, y, c.name || '—', [
      [t.aos, c.aos, PALETTE.accent],
      // La version d'hyperviseur suit celle d'AOS : ce sont les deux versions qu'on compare d'un
      // cluster à l'autre avant une montée de version, et elles se lisent l'une sous l'autre.
      [t.ahv, c.ahv, PALETTE.hypervisor],
      [t.nodes, c.nodes, PALETTE.ink],
      [t.cores, c.cores, PALETTE.cpu],
      [t.ram, gb(c.ramGb, lang), PALETTE.ram],
      [t.storage, tb(c.storageTb, lang), PALETTE.disk],
    ], { subtitle: c.pcMode ? `${t.pc} : ${c.pcMode}` : null }).svg);
  });

  if (!clusters.length) {
    parts.push(text(width / 2, cardsTop + 20, `0 ${t.registered}`, { size: 11, color: PALETTE.label }));
  }
  return svgDocument(width, height, parts.join(''));
}

// ─── Aiguillage ───────────────────────────────────────────────────────────────

const BUILDERS = {
  'cluster-card': clusterCard,
  'node-cards': nodeCards,
  'logical-design': logicalDesign,
  'node-ports': nodePorts,
  cabling,
  'pc-overview': pcOverview,
};

/** Rend le schéma décrit par `data.shape`. Renvoie null si la forme est inconnue ou vide. */
export function renderDiagram(data, lang = 'fr') {
  if (!data || !BUILDERS[data.shape]) return null;
  return BUILDERS[data.shape](data, lang) || null;
}

export { PALETTE };
