// Build navigateur de jszip : l'entrée par défaut tire le module Node « stream ».
import JSZip from 'jszip/dist/jszip.min.js';
import { BODY_PLACEHOLDER, DEFAULT_TABLE_STYLE } from '../engine/asbuilt/exportAsBuiltDocx';

/** Un template sans marqueur ou sans style produirait un document vide ou des tableaux nus. */
export async function checkTemplate(buffer) {
  let zip;
  try { zip = await JSZip.loadAsync(buffer); } catch { throw new Error('Template illisible : ce n\'est pas un .docx'); }
  const doc = await zip.file('word/document.xml')?.async('string');
  // Word découpe volontiers un texte en plusieurs « runs » : on compare sur le texte reconstitué.
  if (!doc?.replace(/<[^>]+>/g, '').includes(`{{${BODY_PLACEHOLDER}}}`))
    throw new Error(`Le template ne contient pas le marqueur {{${BODY_PLACEHOLDER}}}`);
  const styles = await zip.file('word/styles.xml')?.async('string') || '';
  if (!styles.includes(`w:styleId="${DEFAULT_TABLE_STYLE}"`))
    throw new Error(`Le template ne contient pas le style de tableau « ${DEFAULT_TABLE_STYLE} »`);
}
