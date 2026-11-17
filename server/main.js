// Ultimate As-Built : un exécutable, une page locale ouverte dans le navigateur.
import { startServer } from './app.js';

const { url } = startServer();
console.log(`Ultimate As-Built — ${url}\nLaissez cette fenêtre ouverte ; Ctrl+C pour quitter.`);

if (!process.env.NO_OPEN) {
  const cmd = { win32: ['cmd', '/c', 'start', '', url], darwin: ['open', url] }[process.platform] || ['xdg-open', url];
  try { Bun.spawn(cmd, { stdio: ['ignore', 'ignore', 'ignore'] }); } catch { /* l'URL est affichée ci-dessus */ }
}
