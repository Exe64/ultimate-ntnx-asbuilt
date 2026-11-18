// Application desktop : le même serveur que l'exécutable, affiché dans une fenêtre native.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BrowserWindow, Updater } from 'electrobun/main';
import { startServer } from '../server/app.js';
import { updateSource, withTimeout, NONE, REPO } from '../server/update.js';

// Electrobun's Updater reads `<channel>-win-x64-update.json` from the release (electrobun.config.ts).
// Offline or a dev build: nothing to report, as for the portable executables.
async function check() {
  const u = await withTimeout(Updater.checkForUpdate());
  if (!u?.updateAvailable || u.error) return NONE;
  return { available: true, version: u.version, url: `https://github.com/${REPO}/releases/tag/v${u.version}`, canApply: true };
}

// Prepared before answering the page; the restart itself comes once the page has its answer.
async function apply() {
  await Updater.downloadUpdate();
  const info = Updater.updateInfo();
  if (!info.updateReady) throw new Error(`Téléchargement de la mise à jour impossible${info.error ? ` : ${info.error}` : ''}`);
  return () => Updater.applyUpdate();
}

// Bun resolves bundled assets against the working directory, and a Start-menu launch starts in
// System32: move next to the bundle first.
process.chdir(import.meta.dir);

// The page is built separately for the browser (`build:web`): Electrobun's bundler compiles HTML
// imports for Bun, which a webview cannot load.
const web = join(import.meta.dir, '..', 'web');
const page = Object.fromEntries(readdirSync(web).map(f => [f === 'index.html' ? '/' : `/${f}`, () => new Response(Bun.file(join(web, f)))]));

const { url } = startServer(page, updateSource({ check, apply }));
console.log(`Ultimate As-Built — ${url}`);   // visible avec ELECTROBUN_CONSOLE=1
new BrowserWindow({ title: 'Ultimate As-Built Generator', url, frame: { width: 1200, height: 900 } });
