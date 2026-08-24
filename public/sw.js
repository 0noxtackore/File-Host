const CACHE='fh-v5';
const PRECACHE=['/','/index.html','/css/style.css','/js/app.js','/js/firebase.js','/favicon.svg','/manifest.json'];

self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const u=e.request.url;
  // Never cache Firebase API / auth traffic.
  if(u.includes('firestore.googleapis.com')||u.includes('identitytoolkit.googleapis.com')||u.includes('securetoken.googleapis.com')||u.includes('firebase.googleapis.com')||u.includes('firebaseinstallations.googleapis.com'))return;
  // Cache Firebase Storage media (network-first).
  if(u.includes('firebasestorage.googleapis.com')){e.respondWith(caches.match(e.request).then(r=>{const f=fetch(e.request).then(res=>{const c=res.clone();caches.open(CACHE).then(c2=>c2.put(e.request,c));return res});return r||f}));return}
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const c=res.clone();caches.open(CACHE).then(c2=>c2.put(e.request,c));return res})));
});