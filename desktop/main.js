// Application desktop : le même serveur que l'exécutable, affiché dans une fenêtre native.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BrowserWindow } from 'electrobun/main';
import { startServer } from '../server/app.js';

// Bun resolves bundled assets against the working directory, and a Start-menu launch starts in
// System32: move next to the bundle first.
process.chdir(import.meta.dir);

// The page is built separately for the browser (`build:web`): Electrobun's bundler compiles HTML
// imports for Bun, which a webview cannot load.
const web = join(import.meta.dir, '..', 'web');
const page = Object.fromEntries(readdirSync(web).map(f => [f === 'index.html' ? '/' : `/${f}`, () => new Response(Bun.file(join(web, f)))]));

const { url } = startServer(page);
console.log(`Ultimate As-Built — ${url}`);   // visible avec ELECTROBUN_CONSOLE=1
new BrowserWindow({ title: 'Ultimate As-Built Generator', url, frame: { width: 1200, height: 900 } });
