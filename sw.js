const CACHE='journal-planner-static-v0220-one-click-recovery-import-qa';
const STATIC=['./manifest.webmanifest','./styles.css?v=0220oneclickrecoveryimportqa','./js/media-store.js?v=0220oneclickrecoveryimportqa','./js/recurrence.js?v=0220oneclickrecoveryimportqa','./js/inventory.js?v=0220oneclickrecoveryimportqa','./js/sellers.js?v=0220oneclickrecoveryimportqa','./js/orders.js?v=0220oneclickrecoveryimportqa','./js/productivity.js?v=0220oneclickrecoveryimportqa','./js/challenges.js?v=0220oneclickrecoveryimportqa','./js/collections.js?v=0220oneclickrecoveryimportqa','./js/subscriptions.js?v=0220oneclickrecoveryimportqa','./js/today-dashboard.js?v=0220oneclickrecoveryimportqa','./js/one-line-import.js?v=0220oneclickrecoveryimportqa','./js/five-year-journal.js?v=0220oneclickrecoveryimportqa','./js/timeline-filter.js?v=0220oneclickrecoveryimportqa','./js/daily-question-calendar.js?v=0220oneclickrecoveryimportqa','./js/persistence-foundation.js?v=fail-safe-persistence-foundation','./js/recovery-import.js?v=0220oneclickrecoveryimportqa','./js/app.js?v=0220oneclickrecoveryimportqa','./js/v0220-nospend-readonly-diagnostic.js?v=0220oneclickrecoveryimportqa','./js/v0200-dashboard-forwarding-backup.js?v=0220oneclickrecoveryimportqa','./js/v0210-backup-plan.js?v=0220oneclickrecoveryimportqa','./js/v0220-one-click-recovery-import-build.js?v=0220oneclickrecoveryimportqa','./data/daily-question-calendar.json?v=0220oneclickrecoveryimportqa','./icon.svg'];

STATIC.push('./js/persistence-health.js?v=p0-snapshot-health-gate');

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(STATIC.map(u=>c.add(u)))));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);

  // HTML/navigation is always network-first and is NOT placed in Cache Storage.
  if(req.mode==='navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')){
    event.respondWith(fetch(req).catch(()=>new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title><p>当前离线，请联网后重新打开手帐。</p>',
      {headers:{'Content-Type':'text/html; charset=utf-8'}}
    )));
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{
      if(res.ok && (url.pathname.endsWith('.svg') || url.pathname.endsWith('.webmanifest'))){
        const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy));
      }
      return res;
    })));
  }
});


