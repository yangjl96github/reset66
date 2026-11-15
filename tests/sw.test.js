// Guards the offline guarantee: every shipped file must be precached by the service worker.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

const toUrl = (full) => `./${relative(ROOT, full).split(sep).join('/')}`;

function precacheList() {
  const source = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const block = /const PRECACHE = \[([\s\S]*?)\];/.exec(source);
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('service worker precache', () => {
  const precache = precacheList();

  it('includes every source module, stylesheet, manifest and icon', () => {
    const shipped = [
      ...listFiles(join(ROOT, 'src')),
      ...listFiles(join(ROOT, 'icons')),
      join(ROOT, 'index.html'),
      join(ROOT, 'styles.css'),
      join(ROOT, 'manifest.webmanifest'),
    ].map(toUrl);
    expect(shipped.filter((url) => !precache.includes(url))).toEqual([]);
  });

  it('lists only files that exist', () => {
    const missing = precache.filter((url) => url !== './' && !statSync(join(ROOT, url), { throwIfNoEntry: false }));
    expect(missing).toEqual([]);
  });

  it('precaches with cache: reload so a new worker never stores stale HTTP-cached files', () => {
    const source = readFileSync(join(ROOT, 'sw.js'), 'utf8');
    const install = /addEventListener\('install'[\s\S]*?\n\}\);/.exec(source)[0];
    expect(install).toMatch(/cache\.addAll\(\s*PRECACHE\.map\(\s*\(url\)\s*=>\s*new Request\(url,\s*\{\s*cache:\s*'reload'\s*\}\)\s*\)\s*\)/);
    expect(install).not.toMatch(/cache\.addAll\(\s*PRECACHE\s*\)/);
  });

  it('uses the version from src/version.js in package.json', async () => {
    const { APP_VERSION } = await import('../src/version.js');
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.version).toBe(APP_VERSION);
  });
});
