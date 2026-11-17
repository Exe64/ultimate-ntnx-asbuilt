// Electrobun postBuild hook (Windows): the window belongs to the bundled bun.exe, so Task Manager
// shows "Bun" with Bun's icon. Rewrite the app's executables to carry our name and icon.
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { rcedit } from 'rcedit';

if (process.env.ELECTROBUN_OS === "win") {
  const name = process.env.ELECTROBUN_APP_NAME;
  const version = process.env.ELECTROBUN_APP_VERSION;
  const exes = readdirSync(process.env.ELECTROBUN_BUILD_DIR, { recursive: true })
    .filter(f => /(^|[\\/])bin[\\/](bun|launcher)\.exe$/i.test(f))
    .map(f => join(process.env.ELECTROBUN_BUILD_DIR, f));
  if (!exes.length) throw new Error('postBuild: bun.exe not found');
  for (const exe of exes) {
    await rcedit(exe, {
      icon: resolve('assets/icon.ico'),
      'file-version': version,
      'product-version': version,
      'version-string': { FileDescription: name, ProductName: name, CompanyName: '', LegalCopyright: '', OriginalFilename: '', InternalName: name },
    });
    console.log(`postBuild: ${exe} -> ${name} ${version}`);
  }
}
