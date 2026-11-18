import pkg from './package.json';

export default {
  app: {
    name: 'Ultimate As-Built Generator',
    identifier: 'fr.juliendumur.ultimate-asbuilt',
    version: pkg.version,
  },
  build: {
    bun: { entrypoint: 'desktop/main.js' },
    // The page, built for the browser by `build:web`, served by desktop/main.js.
    copy: { 'dist-web': 'web' },
    win: { icon: 'assets/icon.ico' },
  },
  // Windows: our name and icon on bun.exe, which owns the window (Task Manager showed "Bun").
  scripts: { postBuild: 'desktop/postbuild.js' },
  runtime: { exitOnLastWindowClosed: true },
  // Updates come from the latest stable GitHub release: the Windows CI job attaches the
  // update files (update.json, checksum, full archive, patch) next to the installer.
  release: { baseUrl: 'https://github.com/Exe64/ultimate-ntnx-asbuilt/releases/latest/download' },
};
