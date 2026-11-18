// What the page was working on, kept across the restart of an update: the export file (the
// collection and the document inputs, never a credential). Written just before the restart,
// read once at the next launch and deleted at once, so no customer collection lingers on disk.
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { FORMAT, isBundle } from '../web/exportFile.js';

/** Only an export of this tool is written: anything else is refused before the update starts. */
export const isResume = (file) => !!file && typeof file === 'object' && file.format === FORMAT && isBundle(file.bundle);

export function resumeStore(path) {
  // Taken when the server starts: the file is gone even if the page never asks for it.
  let pending = null;
  try {
    if (existsSync(path)) {
      const file = JSON.parse(readFileSync(path, 'utf8'));
      if (isResume(file)) pending = file;
    }
  } catch { /* unreadable: dropped below */ }
  try { if (existsSync(path)) unlinkSync(path); } catch { /* read-only folder: harmless */ }

  return {
    save(file) {
      if (!isResume(file)) throw new Error('Sauvegarde de la collecte invalide');
      writeFileSync(path, JSON.stringify(file));
    },
    /** The update did not happen: the saved work must not come back at the next launch. */
    discard() { try { if (existsSync(path)) unlinkSync(path); } catch { /* nothing to undo */ } },
    /** The saved work, once; null afterwards or when there was none. */
    take() { const file = pending; pending = null; return file; },
  };
}
