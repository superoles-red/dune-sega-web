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
const MAX_DOWNLOAD_ATTEMPTS = 3;
const DOWNLOAD_TIMEOUT_MS = 30000;
const canonical = path => new URL(path, SCOPE).href;
const READY_URL = canonical('__offline_ready__');
const UPDATE_PAGE = new URL('update.html', SCOPE).pathname;
const UPDATE_SCRIPT = new URL('update-game.mjs', SCOPE).pathname;
const isGameWindow = client => {
  try { const url = new URL(client.url); return url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname) && url.pathname !== UPDATE_PAGE; }
  catch { return false; }
};
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
async function downloadVerified(asset) {
  let lastError;
  for (let attempt = 0; attempt < MAX_DOWNLOAD_ATTEMPTS; ++attempt) {
    const url = new URL(asset.path, SCOPE);
    // A retry must not get stuck behind a stale browser/CDN/VPN cache entry.
    // The verified response is still stored under the canonical resource URL.
    if (attempt) {
      url.searchParams.set('__dune_asset', asset.sha256);
      url.searchParams.set('__dune_retry', String(attempt));
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timeout;
    try {
      const operation = (async () => {
        const response = await fetch(url.href, {cache: 'reload', credentials: 'same-origin', ...(controller ? {signal: controller.signal} : {})});
        if (!response.ok || response.type === 'opaque') throw Error('HTTP ' + response.status + '/' + response.type + ': ' + asset.path);
        const data = await response.clone().arrayBuffer();
        if (data.byteLength !== asset.bytes || await digest(data) !== asset.sha256) {
          throw Error('Integrity check failed: ' + asset.path);
        }
        return response;
      })();
      const deadline = new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller?.abort();
          reject(Error('Download timed out: ' + asset.path));
        }, DOWNLOAD_TIMEOUT_MS);
      });
      return await Promise.race([operation, deadline]);
    } catch (error) { controller?.abort(); lastError = error; }
    finally { clearTimeout(timeout); }
  }
  throw Error('Offline download failed after ' + MAX_DOWNLOAD_ATTEMPTS + ' attempts: ' + asset.path + ' (' + (lastError?.message || String(lastError)) + ')');
}
async function completedPreviousCaches() {
  // Discover candidates once. A markerless partial install and another game's
  // cache are never sources; no preceding package is changed by this lookup.
  const previous = [];
  let names; try { names = await caches.keys(); } catch { return previous; }
  for (const name of names) {
    if (!name.startsWith(CACHE_PREFIX) || name === CACHE_NAME) continue;
    try {
      const cache = await caches.open(name), marker = await cache.match(READY_URL);
      if (!marker) continue;
      const ready = await marker.json();
      if (ready.version === name.slice(CACHE_PREFIX.length) && Number.isSafeInteger(ready.files) && ready.files > 0) previous.push(cache);
    } catch { /* An unreadable old package is not trusted or removed. */ }
  }
  return previous;
}
async function reuseVerified(asset, previous) {
  for (const cache of previous) {
    try {
      const response = await cache.match(canonical(asset.path));
      if (!response?.ok || response.type === 'opaque') continue;
      const data = await response.clone().arrayBuffer();
      // A complete old package alone is not sufficient: the actual bytes must
      // match this new release, including its expected length and SHA-256.
      if (data.byteLength === asset.bytes && await digest(data) === asset.sha256) return response;
    } catch { /* Missing, damaged or unreadable entries use the network path. */ }
  }
  return null;
}
let installErrorReported = false;
async function reportInstallFailure(error, extra = {}) {
  const detail = [error?.name, error?.message || String(error)].filter(Boolean).join(': ');
  // Reporting must never hide the original install failure, even if the page
  // was closed or the browser has denied its storage/client APIs.
  try {
    await broadcast(summary('error', {loaded: 0, bytes: 0, ...extra, message: detail}));
    installErrorReported = true;
  } catch {}
}
async function installPackage() {
  if (!PRECACHE.length || VERSION.startsWith('__')) throw Error('Offline package has not been built');
  // A failed candidate never deletes the preceding, still-active version.
  const cache = await caches.open(CACHE_NAME);
  const alreadyReady = !!(await cache.match(READY_URL));
  const previous = await completedPreviousCaches();
  let next = 0, loaded = 0, bytes = 0, failure = null;
  await broadcast(summary('downloading', {loaded, bytes}));
  const download = async () => {
    while (!failure && next < PRECACHE.length) {
     try {
      const asset = PRECACHE[next++];
      const response = await reuseVerified(asset, previous) || await downloadVerified(asset);
      await cache.put(canonical(asset.path), response);
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
    await reportInstallFailure(failed.reason, {loaded, bytes});
    throw failed.reason;
  }
  try {
    await cache.put(READY_URL, new Response(JSON.stringify({version: VERSION, files: PRECACHE.length}), {headers: {'Content-Type': 'application/json'}}));
  } catch (error) {
    if (!alreadyReady) await caches.delete(CACHE_NAME);
    await reportInstallFailure(error, {loaded, bytes});
    throw error;
  }
  await broadcast(summary('ready'));
}
self.addEventListener('install', event => event.waitUntil(installPackage().catch(async error => {
  // CacheStorage can reject before the first progress message. Surface that
  // precise early failure too; failed installs still reject and never activate.
  if (!installErrorReported) await reportInstallFailure(error);
  throw error;
})));
self.addEventListener('activate', event => event.waitUntil((async () => {
  if (!await (await caches.open(CACHE_NAME)).match(READY_URL)) throw Error('Incomplete offline package');
  // Normal activation follows the browser's waiting lifecycle. Explicit update
  // activation is accepted only from the recovery page with no game windows.
  // Recheck before collecting old packages in case a window opened meanwhile.
  if (!(await self.clients.matchAll({type: 'window', includeUncontrolled: true})).some(isGameWindow)) {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    }
  }
  // Never claim or reload an existing game window.
  await broadcast(summary('ready'));
})()));
self.addEventListener('message', event => {
  if (event.data?.type === 'DUNE_APPLY_UPDATE') {
    event.waitUntil((async () => {
      const reply = value => event.ports?.[0]?.postMessage({type: 'DUNE_UPDATE_RESULT', version: VERSION, ...value});
      const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
      const source = windows.find(client => client.id === event.source?.id);
      let url; try { url = new URL(source?.url); } catch {}
      if (!source || url?.origin !== SCOPE.origin || url.pathname !== UPDATE_PAGE) return reply({status: 'denied'});
      const count = windows.filter(isGameWindow).length;
      if (count) return reply({status: 'blocked', count});
      if (!await (await caches.open(CACHE_NAME)).match(READY_URL)) return reply({status: 'incomplete'});
      // The recovery document runs no game. All playable windows must be closed
      // first; this opt-in action is never sent by the normal game host.
      await self.skipWaiting();
      reply({status: 'applying'});
    })());
    return;
  }
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
  // A stable recovery URL must escape even an obsolete coherent package.
  // These two small files are intentionally network-only and never precached.
  if (url.pathname === UPDATE_PAGE || url.pathname === UPDATE_SCRIPT) return;
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
