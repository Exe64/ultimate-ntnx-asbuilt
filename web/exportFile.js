// Fichier de collecte : ce que Prism a rendu et ce qui a été saisi à la main, pour régénérer un
// document ou reprendre une collecte sans tout refaire. Il ne porte jamais d'identifiant : la
// collecte n'en contient pas, et les saisies exportées sont celles du document, pas celles de connexion.
export const FORMAT = 'ultimate-asbuilt-collecte';
export const VERSION = 1;

/** Une collecte a un Prism Central et une liste de clusters ; le reste se lit avec tolérance. */
export const isBundle = (b) =>
  !!b && typeof b === 'object' && !!b.pc && typeof b.pc === 'object' && !!b.pc.source
  && Array.isArray(b.clusters) && b.clusters.every(c => c && typeof c === 'object' && c.extId && c.source);

export const buildExport = (bundle, inputs, appVersion) =>
  ({ format: FORMAT, version: VERSION, appVersion, exportedAt: new Date().toISOString(), bundle, inputs });

/** Lit un fichier exporté ; lève avec la raison quand il n'est pas utilisable. */
export function parseExport(text) {
  let file;
  try { file = JSON.parse(text); } catch { throw new Error('Fichier illisible : ce n\'est pas du JSON'); }
  if (file?.format !== FORMAT) throw new Error('Ce fichier n\'est pas une collecte Ultimate As-Built');
  if (file.version !== VERSION)
    throw new Error(`Collecte au format ${file.version}, cette version lit le format ${VERSION} : mettre l'outil à jour ou recollecter`);
  if (!isBundle(file.bundle)) throw new Error('Collecte incomplète : Prism Central ou clusters absents');
  return { bundle: file.bundle, inputs: file.inputs && typeof file.inputs === 'object' ? file.inputs : {} };
}

export const exportFileName = (bundle) =>
  `collecte-${String(bundle.pc.host || 'prism').replace(/[^\w.-]+/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
