/* Generated for publication by tools/build_publication.py.
 * Only the web host is cached. No game state or gameplay is changed here. */
'use strict';
const VERSION = '__DUNE_CACHE_VERSION__';
const PRECACHE = /*__DUNE_PRECACHE__*/ [];
const SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = 'dune-sega-offline:' + SCOPE.pathname + ':';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const ASSETS = new Map(PRECACHE.map(asset => [new URL(asset.path, SCOPE).pathname, asset]));
const TOTAL_BYTES = PRECACHE.reduce((sum, asset) => sum + asset.bytes, 0);
const canonical = path => new URL(path, SCOPE).href;
const READY_URL = canonical('__offline_ready__');
const summary = (status, extra = {}) => ({type: 'DUNE_OFFLINE_PROGRESS', status, version: VERSION,
  loaded: PRECACHE.length, total: PRECACHE.length, bytes: TOTAL_BYTES, totalBytes: TOTAL_BYTES, ...extra});
async function broadcast(message) {
  const clients = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
  for (const client of clients) client.postMessage(message);
}
async function digest(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function installPackage() {
  if (!PRECACHE.length || VERSION.startsWith('__')) throw Error('Offline package has not been built');
  // A failed candidate never deletes the preceding, still-active version.
  const cache = await caches.open(CACHE_NAME);
  const alreadyReady = !!(await cache.match(READY_URL));
  let next = 0, loaded = 0, bytes = 0, failure = null;
  await broadcast(summary('downloading', {loaded, bytes}));
  const download = async () => {
    while (!failure && next < PRECACHE.length) {
     try {
      const asset = PRECACHE[next++], url = canonical(asset.path);
      const response = await fetch(url, {cache: 'reload', credentials: 'same-origin'});
      if (!response.ok || response.type === 'opaque') throw Error('Offline download failed: ' + asset.path);
      const data = await response.clone().arrayBuffer();
      if (data.byteLength !== asset.bytes || await digest(data) !== asset.sha256) {
        throw Error('Offline integrity check failed: ' + asset.path);
      }
      await cache.put(url, response);
      ++loaded; bytes += asset.bytes;
      await broadcast(summary('downloading', {loaded, bytes}));
     } catch (error) { failure = error; throw error; }
    }
  };
  // Wait for every in-flight writer before deleting an unsuccessful candidate.
  const results = await Promise.allSettled(Array.from({length: Math.min(4, PRECACHE.length)}, download));
  const failed = results.find(result => result.status === 'rejected');
  if (failed) {
    if (!alreadyReady) await caches.delete(CACHE_NAME);
    await broadcast(summary('error', {loaded, bytes, message: failed.reason?.message || 'Offline download failed'}));
    throw failed.reason;
  }
  try {
    await cache.put(READY_URL, new Response(JSON.stringify({version: VERSION, files: PRECACHE.length}), {headers: {'Content-Type': 'application/json'}}));
  } catch (error) {
    if (!alreadyReady) await caches.delete(CACHE_NAME);
    await broadcast(summary('error', {loaded, bytes, message: error.message || 'Offline download failed'}));
    throw error;
  }
  await broadcast(summary('ready'));
}
self.addEventListener('install', event => event.waitUntil(installPackage()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  if (!await (await caches.open(CACHE_NAME)).match(READY_URL)) throw Error('Incomplete offline package');
  for (const name of await caches.keys()) {
    if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
  }
  // No skipWaiting/claim: an update never swaps assets under a running mission.
  await broadcast(summary('ready'));
})()));
self.addEventListener('message', event => {
  if (event.data?.type !== 'DUNE_OFFLINE_STATUS') return;
  event.waitUntil((async () => {
    const ready = !!await (await caches.open(CACHE_NAME)).match(READY_URL);
    const message = summary(ready ? 'ready' : 'downloading', ready ? {} : {loaded: 0, bytes: 0});
    if (event.ports?.[0]) event.ports[0].postMessage(message);
    else event.source?.postMessage(message);
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== SCOPE.origin) return;
  let asset = ASSETS.get(url.pathname);
  if (request.mode === 'navigate' && (url.pathname === SCOPE.pathname || url.pathname === SCOPE.pathname + 'index.html')) {
    asset = ASSETS.get(new URL('index.html', SCOPE).pathname);
  }
  if (!asset) return;
  // Query-only release URLs and ?v module cache-busters map to the exact bytes
  // of this worker's coherent package, also at a GitHub project subpath.
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE_NAME)).match(canonical(asset.path));
    return cached || fetch(request);
  })());
});
