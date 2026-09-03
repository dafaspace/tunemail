// Copies the shipping web files into www/ for Capacitor.
//
// The house stack has no build step and this is not one: it is a copy with an
// explicit list. The list is explicit on purpose - webDir pointed at the repo
// root would bundle brand/, migrations/, the .psd files and every index_NN.html
// snapshot into the app people download.
//
// The bundle is LOCAL, not a webview pointed at tunemail.app. Apple rejects a
// wrapper around a website under guideline 4.2, and a remote shell is dead
// without a network. The service worker still runs inside the bundle, so
// offline works the same way it does on the web.
import { cp, rm, mkdir, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not .pathname: the folder is "My Apps" and .pathname hands
// back "My%20Apps", which then does not exist.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WWW  = join(ROOT, 'mobile', 'www');

// Everything a running app needs, and nothing else.
const SHIP = [
  'index.html',
  'manifest.json',
  'privacy.html',
  'sw.js',
  'icons',
  'fonts',
];

await rm(WWW, { recursive: true, force: true });
await mkdir(WWW, { recursive: true });

let files = 0, bytes = 0;
for (const name of SHIP) {
  const src = join(ROOT, name);
  const dst = join(WWW, name);
  await mkdir(dirname(dst), { recursive: true });
  await cp(src, dst, { recursive: true });
  const walk = async (p) => {
    const s = await stat(p);
    if (s.isFile()) { files++; bytes += s.size; return; }
    for (const e of await readdir(p)) await walk(join(p, e));
  };
  await walk(dst);
}
console.log(`www: ${files} files, ${(bytes / 1024).toFixed(0)} KB`);
