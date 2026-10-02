const CACHE='dpl-demo-v3';
async function cacheBuild(cache){
  const manifest=await (await fetch('/.vite/manifest.json',{cache:'no-store'})).json();
  const files=new Set(Object.values(manifest).flatMap(m=>[m.file,...(m.css||[])]));
  await cache.addAll(['/logo.png',...[...files].map(f=>'/'+f)]);
}
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.add('/');await cacheBuild(cache);self.skipWaiting();})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('dpl-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api')||url.pathname.startsWith('/socket.io'))return;
  if(event.request.mode==='navigate'){
    const network=fetch(event.request);
    event.respondWith(network.catch(()=>caches.match('/')));
    event.waitUntil(network.then(async response=>{if(!response.ok)return;const cache=await caches.open(CACHE);await cache.put('/',response.clone());await cacheBuild(cache);}).catch(()=>{}));return;
  }
  if(url.pathname.startsWith('/assets/')||url.pathname==='/logo.png')event.respondWith((async()=>{const cached=await caches.match(event.request);if(cached)return cached;const res=await fetch(event.request);if(res.ok)(await caches.open(CACHE)).put(event.request,res.clone());return res;})());
});
