// Page in French or English. French is the source text and the key: the page and the server keep
// writing French, and an observer translates every text node as it lands in the page. One
// mechanism covers the static page, what app.js renders and the server's messages.

// Whole strings, as they appear in a text node (whitespace collapsed).
export const EN = {
  'Dossier as-built Nutanix, prêt à livrer : connexion au Prism Central, collecte, document Word.':
    'Nutanix as-built document, ready to deliver: connect to Prism Central, collect, Word document.',
  'Langue': 'Language',
  "Vous aimez l'appli ? Offrez-moi un Ko-fi": 'Love the app? Buy me a Ko-fi',
  '· Conçu par Julien Dumur · © 2026 ·': '· Designed by Julien Dumur · © 2026 ·',
  'Licence GPL-3.0': 'GPL-3.0 license',
  'Outil indépendant, non affilié à Nutanix, Inc.': 'Independent tool, not affiliated with Nutanix, Inc.',
  'Thème': 'Theme',
  'Clair': 'Light',
  'Sombre': 'Dark',
  'Prism Central (IP ou FQDN)': 'Prism Central (IP or FQDN)',
  'Utilisateur': 'Username',
  'Mot de passe': 'Password',
  'Accepter les certificats auto-signés': 'Accept self-signed certificates',
  'Lecture seule : un compte « Viewer » suffit. Les mots de passe ne sont ni stockés ni écrits dans le document.':
    'Read-only: a "Viewer" account is enough. Passwords are neither stored nor written to the document.',
  'Détecter les clusters': 'Detect clusters',
  'Reprendre une collecte': 'Resume a collection',
  'Collecte exportée (.json)': 'Exported collection (.json)',
  "Recharge la collecte et les saisies d'un fichier exporté à l'étape 3 : le document se régénère sans réinterroger Prism. Le fichier ne contient aucun identifiant.":
    'Reloads the collection and inputs from a file exported at step 3: the document is rebuilt without querying Prism again. The file holds no credentials.',
  'Clusters déclarés par le Prism Central. Chacun se collecte avec ses propres identifiants ; une ligne laissée sans mot de passe est documentée depuis le Prism Central seul.':
    'Clusters declared by Prism Central. Each one is collected with its own credentials; a row left without a password is documented from Prism Central only.',
  'Adresse': 'Address',
  'État': 'State',
  'Recopier la première ligne sur les autres': 'Copy the first row to the others',
  'Collecter les Prism Element': 'Collect Prism Elements',
  'Client': 'Customer',
  'Projet': 'Project',
  'Intégrateur': 'Integrator',
  'Sections': 'Sections',
  'Retirer les sections et les lignes non collectées (au lieu de « Non collecté ») ; « Non configuré » reste dit':
    'Remove sections and rows that were not collected (instead of "Not collected"); "Not configured" is still stated',
  'Charte': 'Branding',
  'Template Word (.docx) — facultatif, celui livré sert par défaut':
    'Word template (.docx) — optional, the bundled one is used by default',
  'Un template personnel doit contenir le marqueur {{corps}} et un style de tableau « AsBuiltTable ».':
    'A custom template must contain the {{corps}} marker and an "AsBuiltTable" table style.',
  'Télécharger le template par défaut': 'Download the default template',
  'pour le retoucher dans Word.': 'to edit it in Word.',
  'Exporter la collecte': 'Export the collection',
  'Comparer deux collectes': 'Compare two collections',
  'Collecte de référence (avant)': 'Reference collection (before)',
  'Collecte récente (après)': 'Recent collection (after)',
  "Rapport d'écarts .docx entre deux collectes exportées : lignes ajoutées, supprimées et valeurs modifiées, section par section. Rien n'est demandé à Prism.":
    'A .docx change report between two exported collections: rows added, removed and values changed, section by section. Prism is not queried.',
  "Générer le rapport d'écarts": 'Generate the change report',
  'Choisir les deux collectes à comparer.': 'Choose the two collections to compare.',
  'Comparaison des collectes…': 'Comparing the collections…',
  'Générer le .docx': 'Generate the .docx',
  'IP ou FQDN': 'IP or FQDN',
  // app.js
  'Site / Datacenter': 'Site / Datacenter',
  'Switches ToR (nombre)': 'ToR switches (count)',
  'Modèle des switches': 'Switch model',
  'Mode des switches (MLAG, VPC…)': 'Switch mode (MLAG, VPC…)',
  'Vitesse des ports (ex. 25 GbE)': 'Port speed (e.g. 25 GbE)',
  'Connectique des ports 10G': '10G port media',
  'SFP+ (fibre / DAC)': 'SFP+ (fiber / DAC)',
  'Interrogation du Prism Central…': 'Querying Prism Central…',
  'Collecte des Prism Element…': 'Collecting Prism Elements…',
  'En attente…': 'Waiting…',
  'Collecte en cours…': 'Collecting…',
  'Collecté': 'Collected',
  'Sans identifiants : Prism Central seul': 'No credentials: Prism Central only',
  'Collecte terminée.': 'Collection complete.',
  'Collecte exportée.': 'Collection exported.',
  'Lecture de la collecte…': 'Reading the collection…',
  'Génération…': 'Generating…',
  'Document généré.': 'Document generated.',
  // New version band
  "L'application redémarre sur la nouvelle version ; la collecte en cours est conservée.":
    'The application restarts on the new version; the collection in progress is kept.',
  'Mettre à jour': 'Update',
  'Voir la release': 'See the release',
  'Téléchargement de la mise à jour…': 'Downloading the update…',
  'Redémarrage sur la nouvelle version…': 'Restarting on the new version…',
};

// Strings with variable parts, matched whole; `$n` are the captured parts.
const PATTERNS = [
  [/^(\d+) cluster\(s\) détecté\(s\)\.$/, '$1 cluster(s) detected.'],
  [/^Collecte des Prism Element… (\d+)\/(\d+)$/, 'Collecting Prism Elements… $1/$2'],
  [/^(\d+) Prism Element en échec : corrigez la ligne et relancez, ou générez sans\.$/, '$1 Prism Element(s) failed: fix the row and retry, or generate without them.'],
  [/^Collecte de (.+) reprise : (\d+) cluster\(s\)\.$/, 'Collection of $1 resumed: $2 cluster(s).'],
  [/^(\d+)\/(\d+) collecteurs$/, '$1/$2 collectors'],
  [/^· sans réponse : (.*)$/, '· no response: $1'],
  [/^non collecté \((.*)\)$/, 'not collected ($1)'],
  [/^Version (\S+) disponible\.$/, 'Version $1 available.'],
  [/^Rapport d'écarts généré : (\d+) écart\(s\)\.$/, 'Change report generated: $1 change(s).'],
  [/^Collecte de (.+) reprise après la mise à jour : (\d+) cluster\(s\)\.$/, 'Collection of $1 restored after the update: $2 cluster(s).'],
];

// Server and validation messages: fragments of composed messages, replaced wherever they appear.
const FRAGMENTS = [
  [/identifiants refusés \(HTTP (\d+)\), aucune autre requête envoyée/g, 'credentials refused (HTTP $1), no further request sent'],
  [/injoignable ou refusé/g, 'unreachable or refused'],
  [/aucune réponse/g, 'no response'],
  [/adresse ou identifiants manquants/g, 'address or credentials missing'],
  [/identifiants Prism Element non fournis/g, 'Prism Element credentials not provided'],
  [/adresse du Prism Element inconnue/g, 'Prism Element address unknown'],
  [/Adresse, utilisateur et mot de passe du Prism Central requis/g, 'Prism Central address, username and password are required'],
  [/Collecter le Prism Central d'abord/g, 'Collect Prism Central first'],
  [/Collecte incomplète : Prism Central ou clusters absents/g, 'Incomplete collection: Prism Central or clusters missing'],
  [/Jeton invalide/g, 'Invalid token: reopen the page from the address the application printed'],
  [/^Erreur (\d+)$/g, 'Error $1'],
  [/Fichier illisible : ce n'est pas du JSON/g, 'Unreadable file: not JSON'],
  [/Ce fichier n'est pas une collecte Ultimate As-Built/g, 'This file is not an Ultimate As-Built collection'],
  [/Collecte au format (\S+), cette version lit le format (\S+) : mettre l'outil à jour ou recollecter/g, 'Collection in format $1, this version reads format $2: update the tool or collect again'],
  [/Template illisible : ce n'est pas un \.docx/g, 'Unreadable template: not a .docx'],
  [/Téléchargement de la mise à jour impossible/g, 'The update could not be downloaded'],
  [/Mise à jour automatique indisponible/g, 'Automatic update unavailable'],
  [/Sauvegarde de la collecte (invalide|indisponible)/g, (_, w) => `Collection backup ${w === 'invalide' ? 'invalid' : 'unavailable'}`],
  [/SVG illisible pour la rasterisation/g, 'Diagram could not be rendered to an image'],
  [/Le template ne contient pas le marqueur (\S+)/g, 'The template does not contain the $1 marker'],
  [/Le template ne contient pas le style de tableau « (.+?) »/g, 'The template does not contain the "$1" table style'],
];

/** English for one French text; unknown text is returned unchanged (names, addresses, keys). */
export function toEnglish(text) {
  const [, lead, core, tail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  const key = core.replace(/\s+/g, ' ');
  if (!key) return text;
  let out = EN[key];
  if (out == null) {
    const p = PATTERNS.find(([re]) => re.test(key));
    out = p ? key.replace(p[0], p[1]) : key;
    out = FRAGMENTS.reduce((s, [re, en]) => s.replace(re, en), out);
    if (out === key) return text;
    out = out.replace(/ ([:;!?])/g, '$1');   // French spacing before punctuation
  }
  return lead + out + tail;
}

/** Browser language, French or English. */
export const browserLang = () => (/^fr\b/i.test(navigator.language || '') ? 'fr' : 'en');

// ─── DOM ──────────────────────────────────────────────────────────────────────

const original = new WeakMap();   // text node / input → its French text
let lang = 'fr';

function translateNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (!original.has(node)) original.set(node, node.data);
    const fr = original.get(node);
    const want = lang === 'en' ? toEnglish(fr) : fr;
    if (node.data !== want) node.data = want;
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.placeholder) {
      if (!original.has(node)) original.set(node, node.placeholder);
      node.placeholder = lang === 'en' ? toEnglish(original.get(node)) : original.get(node);
    }
    if (node.dataset.hrefEn) {   // link whose target depends on the language
      if (!original.has(node)) original.set(node, node.getAttribute('href'));
      node.href = lang === 'en' ? node.dataset.hrefEn : original.get(node);
    }
    node.childNodes.forEach(translateNode);
  }
}

/** Translate the page now, and every node added to it from now on. */
export function startI18n(initial) {
  lang = initial;
  translateNode(document.body);
  // childList only: app.js writes through textContent / replaceChildren, which add new nodes.
  new MutationObserver((records) => records.forEach(r => r.addedNodes.forEach(translateNode)))
    .observe(document.body, { childList: true, subtree: true });
}

export function setLang(next) {
  lang = next;
  document.documentElement.lang = next;
  translateNode(document.body);
}
