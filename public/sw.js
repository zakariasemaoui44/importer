// ─── Stream Hub — Service Worker Ad Blocker ──────────────────────────────────
// Intercepts fetch requests and blocks known ad/tracker domains.
// This works for requests from our own React app pages only.
// Popup ads from cross-origin iframes are blocked via iframe sandbox in Watch.jsx.

const CACHE_NAME = 'stream-hub-v1';

const AD_DOMAINS = [
  'googlesyndication.com','doubleclick.net','adservice.google.com',
  'adnxs.com','popads.net','popcash.net','adcash.com','exoclick.com',
  'trafficfactory.biz','clickadu.com','propellerads.com','adskeeper.co.uk',
  'taboola.com','outbrain.com','juicyads.com','plugrush.com','traffichunt.com',
  'mgid.com','bidvertiser.com','omoonsih.net','dressedoutrageousrun.com',
  'coinzillatag.com','galaksion.com','hilltopads.net','adsterra.com',
  'trafficstars.com','adspyglass.com','revcontent.com','bidgear.com',
  'onclickads.net','popunderpool.com','richpush.co','pushground.com',
  'monetag.com','adcombo.com','fuckingfast.co','mc.yandex.ru',
  'yandex-team.ru','smartadserver.com','adriver.ru','traffiq.com',
  'popunder.ru','adnetwork.com','popupads.net','adsrvr.org',
  'amazon-adsystem.com','media.net','zedo.com','advertising.com',
  'ads.yahoo.com','criteo.com','pubmatic.com','openx.net','rubiconproject.com',
  'appnexus.com','lijit.com','quantserve.com','scorecardresearch.com',
  'chartbeat.com','newrelic.com','hotjar.com',
];

const AD_URL_PATTERNS = [
  /\/ads\//i, /\/adv\//i, /\/banner\//i, /\/pop\//i,
  /\/popunder/i, /\/popup/i, /ad\.js$/i, /ads\.js$/i,
  /\/adsense\//i, /\/adframe\//i,
];

function isAdRequest(url) {
  try {
    const u = new URL(url);
    const hostname = u.hostname.toLowerCase();
    if (AD_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) return true;
    if (AD_URL_PATTERNS.some(p => p.test(u.pathname))) return true;
  } catch {}
  return false;
}

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  if (isAdRequest(url)) {
    e.respondWith(new Response('', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    }));
    return;
  }
});
