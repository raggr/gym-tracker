const CACHE="gym-tracker-v6";
const ASSETS=["./","./index.html","./styles.css?v=4.2","./app.js?v=4.2","./manifest.json?v=4.2","./icon.svg?v=4.2","./icon-192.png?v=4.2","./icon-512.png?v=4.2","./icon-maskable-512.png?v=4.2","./apple-touch-icon.png?v=4.2"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  if(e.request.mode==="navigate"){
    e.respondWith(fetch(e.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put("./index.html",copy));return resp}).catch(()=>caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return resp})));
});
