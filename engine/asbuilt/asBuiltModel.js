import { SECTIONS, CHAPTERS, DEFAULT_ENABLED } from './sections';
import { normalizeCluster, asList } from './normalize';

// Moteur de l'as-built (cf. docs/ASBUILT.md §5). Fonction pure : pas d'appel réseau, pas de DOM,
// pas d'horloge implicite — la date de génération arrive dans le bundle. Deux entrées, une sortie :
//
//   bundle  ce que la collecte a rapporté (snapshot d'audit projeté, ou collecte à la volée)
//   project le projet, pour `build` (le prévu) et `scoping` (le cadrage)
//        → un arbre de blocs typés, chaque valeur portant sa provenance.
//
// Contrat du bundle — même forme que les clés du snapshot d'audit, que la source soit un
// artefact stocké ou un appel direct. Une seule forme à connaître pour les deux chemins :
//
//   { meta: { generatedAt },
//     pc:  { host, source, data: { v4_clusters: […], v4_users: […], … } },
//     clusters: [ { extId, name, planRef, source, data: { cluster_v2: {…}, hosts_v2: […], … } } ] }
//
//   source = { kind: 'snapshot-pc' | 'snapshot-pe' | 'live' | 'absent', collectedAt, target,
//              collectors: { ok, total }, errors: [ { key, error } ], reason, unattributed }
//
// `integrator` nomme la société qui a installé la plateforme (chapitre « Présentation ») ; sans
// lui, le texte reste neutre.

const UNITS = {
  fr: { gb: 'Go', tb: 'To', yes: 'Oui', no: 'Non', day: 'j' },
  en: { gb: 'GB', tb: 'TB', yes: 'Yes', no: 'No', day: 'd' },
};

const SOURCE_LABEL = {
  'snapshot-pc': { fr: 'Snapshot Prism Central', en: 'Prism Central snapshot' },
  'snapshot-pe': { fr: 'Snapshot Prism Element', en: 'Prism Element snapshot' },
  live:          { fr: 'Collecte directe', en: 'Live collection' },
  absent:        { fr: 'Non collecté', en: 'Not collected' },
};

// Une section vide dit pourquoi elle l'est : rien sur le cluster, ou rien de lu. Les confondre
// faisait passer un cluster sans SNMP pour une collecte ratée.
const EMPTY_LABEL = {
  unconfigured: { fr: 'Non configuré', en: 'Not configured' },
  uncollected:  { fr: 'Non collecté', en: 'Not collected' },
};

const REASONS = {
  missing:          { fr: 'donnée absente de la collecte', en: 'not part of the collection' },
  unattributed:     { fr: 'donnée non rattachable à un cluster', en: 'data could not be tied to a cluster' },
  'not-registered': { fr: 'cluster non enregistré sur ce Prism Central', en: 'cluster not registered on this Prism Central' },
  // Raisons posées par la collecte (server/bundle.js) quand le Prism Element n'est pas interrogé.
  'identifiants Prism Element non fournis': { fr: 'disponible avec les identifiants Prism Element', en: 'available with Prism Element credentials' },
  'adresse du Prism Element inconnue': { fr: 'adresse du Prism Element inconnue', en: 'Prism Element address unknown' },
};

// Valeurs brutes de l'API, telles qu'un lecteur n'a pas à les décoder. Une valeur absente de la
// table sort telle quelle : mieux vaut un identifiant brut qu'un libellé inventé.
const VALUE_LABELS = {
  NORMAL_NIC:           { fr: 'Standard', en: 'Standard' },
  DIRECT_NIC:           { fr: 'Directe (passthrough)', en: 'Direct (passthrough)' },
  NETWORK_FUNCTION_NIC: { fr: 'Fonction réseau', en: 'Network function' },
  LOCAL:                { fr: 'Local', en: 'Local' },
  SERVICE_ACCOUNT:      { fr: 'Compte de service', en: 'Service account' },
  ACTIVE:               { fr: 'Actif', en: 'Active' },
  INACTIVE:             { fr: 'Inactif', en: 'Inactive' },
  ACTIVE_DIRECTORY:     { fr: 'Active Directory', en: 'Active Directory' },
  OPEN_LDAP:            { fr: 'OpenLDAP', en: 'OpenLDAP' },
  BestEffort:           { fr: 'Au mieux (sans réservation)', en: 'Best effort' },
  HighlyAvailable:      { fr: 'Hautement disponible', en: 'Highly available' },
  NoReservations:       { fr: 'Aucune réservation', en: 'No reservation' },
  ReserveSegments:      { fr: 'Segments réservés', en: 'Reserved segments' },
  ReserveHosts:         { fr: 'Hôtes réservés', en: 'Reserved hosts' },
  NORMAL:               { fr: 'Normal', en: 'Normal' },
  OFFLINE:              { fr: 'Hors ligne', en: 'Offline' },
  NONE:                 { fr: 'Aucun', en: 'None' },
  ACTIVE_BACKUP:        { fr: 'Active-backup', en: 'Active-backup' },
  BALANCE_SLB:          { fr: 'Balance-SLB', en: 'Balance-SLB' },
  BALANCE_TCP:          { fr: 'Balance-TCP (LACP)', en: 'Balance-TCP (LACP)' },
  SOFTWARE:             { fr: 'Logiciel', en: 'Software' },
  HARDWARE:             { fr: 'Matériel', en: 'Hardware' },
  SOFTWARE_AND_HARDWARE: { fr: 'Logiciel et matériel', en: 'Software and hardware' },
  NO_LICENSE:           { fr: 'Sans licence', en: 'No license' },
  UNLICENSED_CLUSTER:   { fr: 'Cluster sans licence', en: 'Unlicensed cluster' },
  SUCCESS:              { fr: 'Établie', en: 'Established' },
  NEGOTIATED:           { fr: 'Négocié', en: 'Negotiated' },
  CONFIGURED:           { fr: 'Configuré', en: 'Configured' },
  NIL:                  { fr: 'Aucun', en: 'None' },
  CONNECTED_SITE:       { fr: 'Site connecté', en: 'Connected site' },
  DARK_SITE:            { fr: 'Site isolé (dark site)', en: 'Dark site' },
  BACKPLANE:            { fr: 'Backplane', en: 'Backplane' },
  VOLUMES:              { fr: 'Volumes', en: 'Volumes' },
  DR:                   { fr: 'Reprise d\'activité', en: 'Disaster recovery' },
  EXTERNAL_STORAGE:     { fr: 'Stockage externe', en: 'External storage' },
  FIRMWARE:             { fr: 'Firmware', en: 'Firmware' },
};

// Une adresse saisie avec son masque (« 10.0.0.1/24 ») désigne la même machine que l'adresse nue.
const stripMask = (s) => s.replace(/^(\d{1,3}(?:\.\d{1,3}){3})\/\d{1,2}$/, '$1');

const listItems = (v) => [...new Set(String(v).split(/[,;\s]+/).filter(Boolean).map(stripMask))];

/** Comparaison tolérante : ce sont deux saisies humaines d'une même réalité, pas deux chaînes. */
export function sameValue(a, b, opts = {}) {
  const norm = (v) => {
    if (v == null || v === '') return null;
    const s = String(v).trim().toLowerCase();
    return opts.list ? listItems(s).sort().join(',') : stripMask(s);
  };
  const na = norm(a), nb = norm(b);
  if (na == null || nb == null) return true; // rien à comparer n'est pas un écart
  return na === nb;
}

function makeFormatters(lang) {
  const u = UNITS[lang] || UNITS.fr;
  const num = (n) => Number(n).toFixed(2);
  return {
    gb: (n) => n == null ? null : `${num(n)} ${u.gb}`,
    tb: (n) => n == null ? null : `${num(n)} ${u.tb}`,
    bool: (v) => v == null ? null : (v ? u.yes : u.no),
    onOff: (v) => v == null ? null : (typeof v === 'string' ? v : (v ? 'on' : 'off')),
    label: (v) => v == null || v === '' ? null : (VALUE_LABELS[String(v)]?.[lang] ?? VALUE_LABELS[String(v)]?.fr ?? v),
    // Une saisie nue (« 20 ») reçoit son unité ; une saisie qui la porte déjà reste intacte.
    withUnit: (v, unit) => /^\d+([.,]\d+)?$/.test(String(v ?? '').trim()) ? `${String(v).trim()} ${u[unit]}` : (v ?? null),
    duration: (sec) => {
      const n = Number(sec);
      if (sec == null || sec === '' || !Number.isFinite(n)) return sec ?? null;
      for (const [size, unit] of [[86400, u.day], [3600, 'h'], [60, 'min']]) {
        if (n >= size && n % size === 0) return `${n / size} ${unit}`;
      }
      return `${n} s`;
    },
    joinList: (arr) => Array.isArray(arr) ? (arr.length ? arr.join(', ') : null) : (arr || null),
    // L'onglet Build stocke le RF sous forme « RF2 (FT1) » : la comparaison avec l'API,
    // qui répond 2, passe par ce décodage.
    rf: (v) => { const m = /rf\s*(\d)/i.exec(String(v ?? '')); return m ? Number(m[1]) : (v ?? null); },
  };
}

const titleOf = (t, lang) => typeof t === 'string' ? t : (t?.[lang] ?? t?.fr ?? '');

// Normalise un nom de cluster pour l'appariement Build ↔ réel (casse, tirets, espaces).
const nameKey = (s) => String(s ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');

/**
 * Apparie les clusters du bundle aux entrées de `project.build.clusters`.
 * Le backend propose l'appariement (`planRef`) ; à défaut on retombe sur le nom, et les
 * clusters décrits mais absents du PC sont documentés depuis le Build seul.
 */
export function pairClusters(bundle, buildClusters) {
  const plans = buildClusters.map((plan, index) => ({ plan, index, used: false }));
  const byName = new Map(plans.map(p => [nameKey(p.plan.cluster?.clusterName ?? p.plan.clusterName), p]));

  const paired = (bundle.clusters || []).map(entry => {
    let match = entry.planRef != null ? plans[entry.planRef] : byName.get(nameKey(entry.name));
    if (match) match.used = true;
    return { entry, plan: match?.plan || {}, planned: !!match };
  });

  // Un cluster prévu que le PC ne connaît pas : documenté depuis le Build, et dit comme tel.
  const orphans = plans.filter(p => !p.used).map(p => ({
    entry: {
      extId: null,
      name: p.plan.cluster?.clusterName || p.plan.clusterName || null,
      data: {},
      source: { kind: 'absent', reason: 'not-registered' },
    },
    plan: p.plan,
    planned: true,
  }));

  return [...paired, ...orphans];
}

export function buildAsBuiltModel({
  bundle = {}, project = {}, catalog = SECTIONS, enabled = DEFAULT_ENABLED, lang = 'fr',
  integrator = null,
} = {}) {
  const f = makeFormatters(lang);
  const t = (x) => titleOf(x, lang);
  const isOn = (s) => enabled == null || enabled.includes(s.id);
  const gaps = [];
  const collection = [];
  const sections = [];

  const buildClusters = Array.isArray(project.build?.clusters) ? project.build.clusters : [];
  const pairs = pairClusters(bundle, buildClusters);
  const clusters = pairs.map(({ entry, plan, planned }) => ({
    view: normalizeCluster(entry, plan), plan, entry, planned,
  }));

  const pcData = bundle.pc?.data || {};
  const pcEntity = asList(pcData.v4_clusters).find(c => {
    const fns = c.config?.clusterFunction || c.config?.clusterFunctions || [];
    return (Array.isArray(fns) ? fns : [fns]).some(x => String(x).toUpperCase().includes('PRISM_CENTRAL'));
  });

  // Journal de collecte : une ligne par cible, y compris celles qui n'ont rien rendu.
  const logSource = (target, source = {}) => collection.push({
    target,
    source: t(SOURCE_LABEL[source.kind] || SOURCE_LABEL.absent),
    collectedAt: source.collectedAt || null,
    collectors: source.collectors ? `${source.collectors.ok}/${source.collectors.total}` : null,
    errors: (source.errors || []).length || 0,
  });

  logSource(bundle.pc?.host || 'Prism Central', bundle.pc?.source);
  clusters.forEach(c => logSource(c.view.name || '—', c.entry.source));

  // ─── Contexte offert aux sections ───────────────────────────────────────────
  const baseCtx = (current) => {
    const clusterName = current?.view.name || null;
    // Seul point d'entrée de l'annexe des écarts : la comparaison s'y fait une fois, pour les
    // valeurs de cluster comme pour celles des nœuds. Une liste s'affiche sur une ligne.
    const pushGap = (entity, field, planned, actual, opts = {}) => {
      if (planned == null || planned === '' || actual == null || actual === '') return;
      if (sameValue(actual, planned, opts)) return;
      const shown = (v) => opts.list ? listItems(v).join(', ') : String(v);
      gaps.push({ cluster: clusterName, entity, field, planned: shown(planned), actual: shown(actual) });
    };
    return {
      lang, f,
      customer: project.scoping?.engagement?.customer || null,
      integrator,
      notCollected: (reason) => ({ rows: [], notCollected: reason }),
      pc: {
        host: bundle.pc?.host || null,
        name: pcEntity?.name || null,
        version: pcEntity?.config?.buildInfo?.version || null,
        entity: pcEntity || null,
        one: (key) => pcData[key],
        list: (key) => asList(pcData[key]),
      },
      allClusters: clusters.map(c => ({ ...c.view, plan: c.plan })),
      gaps, collection,
      row: (cells, provenance = 'api') => ({
        cells: cells.map(c => (c === undefined || c === '' ? null : c)),
        provenance: cells.every(c => c == null || c === '') ? 'absent' : provenance,
      }),
      gapNode: (nodeName, field, planned, actual) => pushGap(nodeName, field, planned, actual),
      gap: pushGap,
    };
  };

  const clusterCtx = (c, sectionTitle) => {
    const base = baseCtx(c);
    const p = (key) => c.plan.cluster?.[key] ?? c.plan[key];
    return {
      ...base,
      scope: 'cluster',
      cluster: c.view,
      plan: p,
      planNode: (hostName) => (c.plan.nodes || []).find(n => nameKey(n.hypervisorHost) === nameKey(hostName)) || null,
      kv: (label, apiValue, plannedValue, opts) => {
        const planned = plannedValue === '' ? null : plannedValue;
        const api = apiValue === '' ? null : apiValue;
        base.gap(t(sectionTitle), t(label), planned, api, opts);
        return {
          label: t(label),
          value: api != null ? api : (planned != null ? planned : null),
          planned: planned != null ? planned : null,
          provenance: api != null ? 'api' : (planned != null ? 'build' : 'absent'),
        };
      },
    };
  };

  const pcCtx = (sectionTitle) => {
    const base = baseCtx(null);
    return {
      ...base, scope: 'pc', plan: () => null, planNode: () => null,
      kv: (label, apiValue, plannedValue, opts) => clusterCtx({ view: {}, plan: {} }, sectionTitle)
        .kv(label, apiValue, plannedValue, opts),
    };
  };

  // Une section qui lève ne doit pas emporter le document : elle est produite vide, avec sa
  // raison — un tableau manquant qui s'annonce vaut mieux qu'un export qui échoue.
  // Pourquoi une section est vide. Le lien clé de collecte → section est `section.keys` : une
  // clé en erreur donne « Non collecté » et sa raison, une clé lue mais sans contenu donne
  // « Non configuré ».
  const whyEmpty = (section, out, failure, { sources = [], data = {} }) => {
    const not = (reason) => ({
      kind: 'uncollected',
      text: [t(EMPTY_LABEL.uncollected), reason].filter(Boolean).join(' — '),
    });
    if (failure) return not(failure);
    if (out?.notCollected) return not(t(out.notCollected));
    if (out?.emptyText) return { kind: 'custom', text: t(out.emptyText) };

    const keys = section.keys || [];
    const failed = sources.flatMap(s => s?.errors || []).filter(e => keys.includes(e.key));
    if (failed.length) {
      return not(failed.map(e => `${e.key} : ${e.error ?? e.message ?? e.status ?? '?'}`).join(', '));
    }
    if (keys.some(k => data[k] === undefined && sources.some(s => (s?.unattributed || []).includes(k)))) {
      return not(t(REASONS.unattributed));
    }
    if (keys.some(k => data[k] !== undefined || pcData[k] !== undefined)) {
      return { kind: 'unconfigured', text: t(EMPTY_LABEL.unconfigured) };
    }
    const own = sources[0];
    if (own?.kind === 'absent' && own.reason) return not(t(REASONS[own.reason]) || own.reason);
    return not(keys.length ? t(REASONS.missing) : null);
  };

  const emit = (section, ctx, extra) => {
    let out = null, failure = null;
    try { out = section.build(ctx); } catch (err) { failure = err.message || String(err); }
    const empty = failure != null || out == null
      || (out.rows != null && out.rows.length === 0)
      || (section.kind === 'diagram' && out.data == null)
      || (section.kind === 'text' && !out.text);
    const why = empty ? whyEmpty(section, out, failure, extra) : null;
    sections.push({
      id: section.id, chapter: section.chapter, kind: section.kind,
      title: t(section.title), scope: extra.scope,
      clusterRef: extra.clusterRef ?? null, clusterName: extra.clusterName ?? null,
      source: extra.source ?? null,
      columns: (out?.columns || []).map(c => t(c)),
      rows: out?.rows || [],
      data: out?.data ?? null,
      text: out?.text ?? null,
      untitled: section.untitled === true,
      empty, failure,
      emptyKind: why?.kind ?? null, emptyText: why?.text ?? null,
    });
  };

  const pcChapters = CHAPTERS.filter(c => c.scope === 'pc').map(c => c.id);
  for (const s of catalog.filter(s => pcChapters.includes(s.chapter) && isOn(s))) {
    emit(s, pcCtx(s.title), {
      scope: 'pc', source: bundle.pc?.source?.kind || 'absent',
      sources: [bundle.pc?.source], data: pcData,
    });
  }

  const clusterChapters = CHAPTERS.filter(c => c.scope === 'cluster').map(c => c.id);
  clusters.forEach((c, i) => {
    for (const s of catalog.filter(s => clusterChapters.includes(s.chapter) && isOn(s))) {
      emit(s, clusterCtx(c, s.title), {
        scope: 'cluster', clusterRef: c.view.uuid || `plan-${i}`, clusterName: c.view.name,
        source: c.entry.source?.kind || 'absent',
        sources: [c.entry.source, bundle.pc?.source], data: c.entry.data || {},
      });
    }
  });

  // Les annexes se nourrissent de ce que les sections précédentes ont consigné : elles sont
  // donc produites en dernier, jamais avant.
  for (const s of catalog.filter(s => s.chapter === 'annex' && isOn(s))) {
    emit(s, baseCtx(null), { scope: 'annex' });
  }

  return {
    meta: {
      generatedAt: bundle.meta?.generatedAt || null,
      lang,
      projectName: project.name || null,
      pcHost: bundle.pc?.host || null,
      clusterCount: clusters.length,
    },
    chapters: CHAPTERS.map(c => ({ id: c.id, title: t(c.title), scope: c.scope })),
    clusters: clusters.map((c, i) => ({
      ref: c.view.uuid || `plan-${i}`, name: c.view.name,
      hasApi: c.view.hasApi, planned: c.planned,
    })),
    sections, gaps, collection,
  };
}
