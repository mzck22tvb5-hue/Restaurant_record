
const CACHE='restaurant-map-mobile-v1';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.hostname.endsWith('googleapis.com')||url.hostname.endsWith('gstatic.com')){ return; }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{ const copy=resp.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return resp; })));
});
