// Les Fromages Jean-Paul — appli de JP : fonctionnement hors connexion et notifications
var VERSION = 'fjp-admin-3';
var FICHIERS = [
  './', './admin.css', './admin.js', './admin-produits.js', './admin-campagnes.js', './admin-appli.js', './admin-commande.js',
  './manifest.webmanifest', '../assets/app.css', '../assets/config.js',
  '../images/logo.png', '../images/app-192.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(FICHIERS.map(function (f) { return c.add(f).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (l) {
    return Promise.all(l.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Toujours la dernière version du site quand il y a Internet ; la copie gardée sinon.
// Les échanges avec la base (Supabase) ne passent pas par ici.
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  // « no-cache » : le téléphone vérifie à chaque fois s'il y a une nouvelle version (sans tout retélécharger)
  var frais = r.mode === 'navigate' ? new Request(r.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(r, { cache: 'no-cache' });
  e.respondWith(fetch(frais).then(function (rep) {
    if (rep.ok) { var copie = rep.clone(); caches.open(VERSION).then(function (c) { c.put(r, copie); }); }
    return rep;
  }).catch(function () {
    return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || caches.match('./'); });
  }));
});

// Notification reçue
self.addEventListener('push', function (e) {
  var m = {};
  try { m = e.data ? e.data.json() : {}; } catch (err) { m = { titre: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.titre || 'Les Fromages Jean-Paul', {
    body: m.corps || '',
    icon: '../images/app-192.png',
    tag: m.tag || undefined,
    data: { vue: m.vue || 'accueil' },
    lang: 'fr'
  }));
});

// Toucher la notification ouvre l'appli à la bonne rubrique
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var vue = (e.notification.data && e.notification.data.vue) || 'accueil';
  var url = new URL('./#' + vue, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (l) {
    for (var i = 0; i < l.length; i++) {
      if (l[i].url.indexOf(self.registration.scope) === 0) {
        l[i].postMessage({ aller: vue });
        return l[i].focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
