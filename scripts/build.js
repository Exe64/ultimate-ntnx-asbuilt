// Produit les cinq exécutables depuis n'importe quelle machine : `bun run build`.
import { $ } from 'bun';

const TARGETS = {
  'windows-x64': 'ultimate-asbuilt-windows-x64.exe',
  'linux-x64': 'ultimate-asbuilt-linux-x64',
  'linux-arm64': 'ultimate-asbuilt-linux-arm64',
  'darwin-arm64': 'ultimate-asbuilt-macos-arm64',
  'darwin-x64': 'ultimate-asbuilt-macos-intel',
};

for (const [target, name] of Object.entries(TARGETS)) {
  await $`bun build server/main.js --compile --minify --target=bun-${target} --outfile=dist/${name}`;
}
