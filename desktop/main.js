// Application desktop : le même serveur que l'exécutable, affiché dans une fenêtre native.
import { readdirSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { BrowserWindow, Updater } from 'electrobun/main';
import { startServer } from '../server/app.js';
import { updateSource, withTimeout, NONE, REPO } from '../server/update.js';
import { resumeStore } from '../server/resume.js';

// The update check is silent in the page: its trace goes to a log, for when no banner shows up.
// %TEMP%\ultimate-asbuilt-update.log, and the console with ELECTROBUN_CONSOLE=1.
const UPDATE_LOG = join(tmpdir(), 'ultimate-asbuilt-update.log');
function log(line) {
  const text = `${new Date().toISOString()} ${line}`;
  console.log(text);
  try { appendFileSync(UPDATE_LOG, `${text}\n`); } catch { /* a log must never break the app */ }
}
Updater.onStatusChange((e) => log(`[${e.status}] ${e.message}${e.details ? ` ${JSON.stringify(e.details)}` : ''}`));

// Electrobun's own requests wait up to 30 s each, through two GitHub redirects.
const CHECK_TIMEOUT_MS = 30000;

// Electrobun's Updater reads `<channel>-win-x64-update-v2.json` (then `-update.json`) from the
// release (electrobun.config.ts). Offline or a dev build: nothing to report, as for the portables.
async function check() {
  try {
    const local = await Updater.getLocalInfo();
    log(`local ${local.version} ${local.channel} ${local.hash} ${local.baseUrl}`);
    const u = await withTimeout(Updater.checkForUpdate(), CHECK_TIMEOUT_MS);
    log(`check ${JSON.stringify(u)}`);
    if (!u?.updateAvailable || u.error) return NONE;
    return { available: true, version: u.version, url: `https://github.com/${REPO}/releases/tag/v${u.version}`, canApply: true };
  } catch (err) {
    log(`check failed: ${err?.message || err}`);
    return NONE;
  }
}

// Prepared before answering the page; the restart itself comes once the page has its answer.
async function apply() {
  await Updater.downloadUpdate();
  const info = Updater.updateInfo();
  log(`download ${JSON.stringify(info)}`);
  if (!info.updateReady) throw new Error(`Téléchargement de la mise à jour impossible${info.error ? ` : ${info.error}` : ''}`);
  return () => Updater.applyUpdate();
}

// Electrobun's Updater reads `../Resources/version.json` against the working directory, from the
// folder that holds bun.exe, and keeps what it read (empty when missing) for the whole session.
// Read it from there first, whatever folder the app was started in.
const binDir = dirname(process.execPath);
log(`version.json ${existsSync(join(binDir, '..', 'Resources', 'version.json')) ? 'found' : 'missing'} from ${binDir}`);
process.chdir(binDir);
await Updater.getLocalInfo();

// Work in progress kept across an update's restart: in the app's own data folder, %TEMP% otherwise.
let dataDir = tmpdir();
try { dataDir = (await Updater.appDataFolder()) || dataDir; } catch { /* dev build: %TEMP% */ }
const resume = resumeStore(join(dataDir, 'resume-after-update.json'));

// Bun resolves bundled assets against the working directory, and a Start-menu launch starts in
// System32: move next to the bundle first.
process.chdir(import.meta.dir);

// The page is built separately for the browser (`build:web`): Electrobun's bundler compiles HTML
// imports for Bun, which a webview cannot load.
const web = join(import.meta.dir, '..', 'web');
const page = Object.fromEntries(readdirSync(web).map(f => [f === 'index.html' ? '/' : `/${f}`, () => new Response(Bun.file(join(web, f)))]));

const { url } = startServer(page, updateSource({ check, apply }), resume);
console.log(`Ultimate As-Built — ${url}`);   // visible avec ELECTROBUN_CONSOLE=1
new BrowserWindow({ title: 'Ultimate As-Built Generator', url, frame: { width: 1200, height: 900 } });
