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
const CLIENT_VERSIONS_URL = canonical('__offline_client_versions__');
const UPDATE_PAGE = new URL('update.html', SCOPE).pathname;
const UPDATE_SCRIPT = new URL('update-game.mjs', SCOPE).pathname;
const isGameWindow = client => {
  try { const url = new URL(client.url); return url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname) && url.pathname !== UPDATE_PAGE; }
  catch { return false; }
};
const validVersion = version => typeof version === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(version);
async function completeVersion(version) {
  if (!validVersion(version)) return false;
  const marker = await (await caches.open(CACHE_PREFIX + version)).match(READY_URL);
  if (!marker) return false;
  const ready = await marker.json();
  return ready.version === version && Number.isSafeInteger(ready.files) && ready.files > 0;
}
let clientVersionsPromise, clientVersionsWrite = Promise.resolve();
function clientVersions() {
  return clientVersionsPromise ||= (async () => {
    const marker = await (await caches.open(CACHE_NAME)).match(CLIENT_VERSIONS_URL);
    if (!marker) return {version: VERSION, previousVersion: null, clientVersions: Object.create(null)};
    const state = await marker.json();
    if (state.version !== VERSION || !validVersion(state.previousVersion) || !state.clientVersions || typeof state.clientVersions !== 'object' || Array.isArray(state.clientVersions)) throw Error('Invalid client package pins');
    return state;
  })();
}
function storeClientVersions(state) {
  // Serialize navigation writes, so an older snapshot cannot overwrite a
  // newer document's pin if CacheStorage completes its writes out of order.
  const json = JSON.stringify(state);
  const operation = clientVersionsWrite.then(async () => (await caches.open(CACHE_NAME)).put(CLIENT_VERSIONS_URL, new Response(json, {headers: {'Content-Type': 'application/json'}})));
  clientVersionsWrite = operation.catch(() => {});
  return operation;
}
async function liveClientVersions(windows, state) {
  state ||= await clientVersions();
  const versions = Object.create(null);
  for (const client of windows.filter(isGameWindow)) versions[client.id] = state.clientVersions[client.id] || state.previousVersion || VERSION;
  return versions;
}
async function validateClientVersions(versions) {
  for (const version of new Set(Object.values(versions))) if (!await completeVersion(version)) return false;
  return true;
}
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
  const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true}), state = await clientVersions();
  if (state.previousVersion) {
    // skipWaiting changes the controller of existing documents too. Keep their
    // old complete packages, including windows that appeared during activation.
    const versions = await liveClientVersions(windows, state);
    if (!await validateClientVersions(versions)) throw Error('Incomplete preceding client package');
    state.clientVersions = versions;
    await storeClientVersions(state);
  }
  if (state.previousVersion || !windows.some(isGameWindow)) {
    // A reserved old document may become visible just after matchAll(). Its
    // preceding-package fallback must outlive this snapshot and worker restart.
    const retained = new Set([CACHE_NAME]);
    if (state.previousVersion) {
      retained.add(CACHE_PREFIX + state.previousVersion);
      for (const version of Object.values(state.clientVersions)) retained.add(CACHE_PREFIX + version);
    }
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && !retained.has(name)) await caches.delete(name);
    }
  }
  // Never claim, close or reload another game window.
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
      const games = windows.filter(isGameWindow), count = games.length;
      if (count && event.data.restart !== true) return reply({status: 'blocked', count});
      if (!await (await caches.open(CACHE_NAME)).match(READY_URL)) return reply({status: 'incomplete'});
      if (count || validVersion(event.data.previousVersion)) {
        const previousVersion = event.data.previousVersion, supplied = event.data.clientVersions;
        if (!validVersion(previousVersion) || !supplied || typeof supplied !== 'object' || Array.isArray(supplied)) return reply({status: 'incomplete'});
        const versions = Object.create(null);
        for (const client of games) versions[client.id] = Object.prototype.hasOwnProperty.call(supplied, client.id) ? supplied[client.id] : previousVersion;
        if (!await validateClientVersions(versions) || !await completeVersion(previousVersion)) return reply({status: 'incomplete'});
        const state = {version: VERSION, previousVersion, clientVersions: versions};
        await storeClientVersions(state);
        clientVersionsPromise = Promise.resolve(state);
      }
      // Only the recovery page can request an explicit restart. Background
      // checks still wait; other documents keep their original package bytes.
      await self.skipWaiting();
      reply({status: 'applying'});
    })());
    return;
  }
  if (event.data?.type !== 'DUNE_OFFLINE_STATUS') return;
  event.waitUntil((async () => {
    const ready = !!await (await caches.open(CACHE_NAME)).match(READY_URL);
    const versions = ready ? await liveClientVersions(await self.clients.matchAll({type: 'window', includeUncontrolled: true})) : {};
    const clientVersion = event.source?.id ? versions[event.source.id] : undefined;
    const message = summary(ready ? 'ready' : 'downloading', ready ? {clientVersions: versions, ...(clientVersion ? {clientVersion} : {})} : {loaded: 0, bytes: 0});
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
  if (request.mode !== 'navigate' && event.clientId && url.pathname.startsWith(SCOPE.pathname)) {
    event.respondWith((async () => {
      const state = await clientVersions(), version = state.clientVersions[event.clientId] || state.previousVersion || VERSION;
      const cached = await (await caches.open(CACHE_PREFIX + version)).match(canonical(url.pathname.slice(SCOPE.pathname.length)));
      return cached || fetch(request);
    })());
    return;
  }
  let asset = ASSETS.get(url.pathname);
  if (request.mode === 'navigate' && (url.pathname === SCOPE.pathname || url.pathname === SCOPE.pathname + 'index.html')) {
    asset = ASSETS.get(new URL('index.html', SCOPE).pathname);
  }
  if (!asset) return;
  // Query-only release URLs and ?v module cache-busters map to the exact bytes
  // of this worker's coherent package, also at a GitHub project subpath.
  event.respondWith((async () => {
    if (request.mode === 'navigate' && event.resultingClientId) {
      const state = await clientVersions();
      if (state.previousVersion) { state.clientVersions[event.resultingClientId] = VERSION; await storeClientVersions(state); }
    }
    const cached = await (await caches.open(CACHE_NAME)).match(canonical(asset.path));
    return cached || fetch(request);
  })());
});
