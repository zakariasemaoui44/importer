const express = require('express');
const cors    = require('cors');
const path    = require('path');
const axios   = require('axios');
const http    = require('http');
const https   = require('https');

const app  = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const moviesScr = require('./scrapers/movies');
const seriesScr = require('./scrapers/series');
const animeScr  = require('./scrapers/anime');
const { fetchPage, fetchPost, fetchJson } = require('./scrapers/browser');

// ─── Cache ───────────────────────────────────────────────────────────────────
const cache    = new Map();
const CACHE_TTL = 30 * 60 * 1000;
function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > CACHE_TTL) { cache.delete(key); return null; }
  return item.data;
}
function setCache(key, data) { cache.set(key, { data, time: Date.now() }); }

function asyncHandler(fn) {
  return (req, res) => fn(req, res).catch(err => {
    console.error('[ERR]', err.message);
    res.status(500).json({ error: err.message });
  });
}

// ─── Shared axios instance ────────────────────────────────────────────────────
const proxyAxios = axios.create({
  timeout: 20000,
  maxRedirects: 10,
  httpAgent:  new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
  responseType: 'arraybuffer',
});

const PROXY_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ─── MOVIES ──────────────────────────────────────────────────────────────────
app.get('/api/movies', asyncHandler(async (req, res) => {
  const page     = parseInt(req.query.page) || 1;
  const category = req.query.category || '';
  const genre    = req.query.genre    || '';
  const key      = `movies_${page}_${category}_${genre}`;
  let data = getCache(key);
  if (!data) {
    data = await moviesScr.scrapeMovies(page, { category, genre });
    setCache(key, data);
  }
  res.json(data);
}));

app.get('/api/movies/filters', asyncHandler(async (req, res) => {
  const key  = 'movies_filters';
  let data = getCache(key);
  if (!data) { data = await moviesScr.scrapeMovieFilters(); setCache(key, data); }
  res.json(data);
}));

app.get('/api/movies/detail', asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  const key  = `movie_detail_${url}`;
  let data = getCache(key);
  if (!data) { data = await moviesScr.scrapeMovieDetail(url); setCache(key, data); }
  res.json(data);
}));

app.get('/api/movies/watch', asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  const key  = `movie_watch_${url}`;
  let data = getCache(key);
  if (!data) { data = await moviesScr.scrapeMovieWatch(url); setCache(key, data); }
  res.json(data);
}));

// ─── SERIES ──────────────────────────────────────────────────────────────────
app.get('/api/series', asyncHandler(async (req, res) => {
  const page     = parseInt(req.query.page) || 1;
  const category = req.query.category || '';
  const genre    = req.query.genre    || '';
  const key      = `series_${page}_${category}_${genre}`;
  let data = getCache(key);
  if (!data) {
    data = await seriesScr.scrapeSeries(page, { category, genre });
    setCache(key, data);
  }
  res.json(data);
}));

app.get('/api/series/filters', asyncHandler(async (req, res) => {
  const key  = 'series_filters';
  let data = getCache(key);
  if (!data) { data = await seriesScr.scrapeSeriesFilters(); setCache(key, data); }
  res.json(data);
}));

app.get('/api/series/detail', asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  const key  = `series_detail_${url}`;
  let data = getCache(key);
  if (!data) { data = await seriesScr.scrapeSeriesDetail(url); setCache(key, data); }
  res.json(data);
}));

app.get('/api/series/watch', asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  const key  = `ep_watch_${url}`;
  let data = getCache(key);
  if (!data) { data = await seriesScr.scrapeEpisodeWatch(url); setCache(key, data); }
  res.json(data);
}));

// ─── ANIME ───────────────────────────────────────────────────────────────────
app.get('/api/anime', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const key  = `anime_${page}`;
  let data = getCache(key);
  if (!data) { data = await animeScr.scrapeAnime(page); setCache(key, data); }
  res.json(data);
}));

app.get('/api/anime/detail', asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  const key  = `anime_detail_${url}`;
  let data = getCache(key);
  if (!data) { data = await animeScr.scrapeAnimeDetail(url); setCache(key, data); }
  res.json(data);
}));

app.get('/api/anime/watch', asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  const key  = `anime_watch_${url}`;
  let data = getCache(key);
  if (!data) { data = await animeScr.scrapeAnimeEpisodeWatch(url); setCache(key, data); }
  res.json(data);
}));

// ─── DEBUG ────────────────────────────────────────────────────────────────────
app.get('/api/debug/watch', asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  const BASE = 'https://topcinemaa.com';
  const AJAXAT_URL = `${BASE}/wp-content/themes/movies2023/Ajaxat/Single/Server.php`;
  const cheerio = require('cheerio');

  function extractNonce(html) {
    const pats = [
      /["']nonce["']\s*:\s*["']([a-f0-9]{8,})["']/i,
      /var\s+\w*[Nn]once\w*\s*=\s*["']([a-f0-9]{8,})["']/i,
      /["']security["']\s*:\s*["']([a-f0-9]{8,})["']/i,
      /data-nonce=["']([a-f0-9]{8,})["']/i,
    ];
    for (const re of pats) { const m = html.match(re); if (m) return m[1]; }
    return '';
  }

  const watchUrl = url.endsWith('/watch/') ? url : (url.endsWith('/') ? url + 'watch/' : url + '/watch/');
  const html = await fetchPage(watchUrl, url);
  if (!html || html.length < 500) return res.json({ error: 'failed to fetch page', watchUrl, htmlLen: html ? html.length : 0 });

  const $ = cheerio.load(html);
  const nonce = extractNonce(html);

  const serverItems = [];
  $('.watch--servers--list ul li.server--item, .watch--servers--list ul li[data-server]').each((_, el) => {
    serverItems.push({
      dataId: $(el).attr('data-id') || '',
      dataServer: $(el).attr('data-server') || '',
      label: $(el).find('span').first().text().trim(),
    });
  });

  const ajaxResults = await Promise.all(serverItems.map(async item => {
    const postData = { id: item.dataId, i: item.dataServer };
    if (nonce) { postData.nonce = nonce; postData._wpnonce = nonce; }
    const { text } = await fetchPost(AJAXAT_URL, postData, watchUrl, BASE);
    return { ...item, ajaxResponseLen: text ? text.length : 0, ajaxPreview: (text || '').slice(0, 300) };
  }));

  res.json({ watchUrl, htmlLen: html.length, nonceFound: nonce || null, serverCount: serverItems.length, servers: ajaxResults });
}));

// ─── SEARCH ──────────────────────────────────────────────────────────────────
app.get('/api/search', asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q required' });
  const key = `search_${q}`;
  let data = getCache(key);
  if (!data) {
    const BASE_S = 'https://topcinemaa.com';
    const SEARCH_PHP = `${BASE_S}/wp-content/themes/movies2023/Ajaxat/Searching.php`;
    const cheerio = require('cheerio');
    let results = [];

    const { text } = await fetchPost(SEARCH_PHP, { search: q, type: '' }, BASE_S, BASE_S);
    if (text && text.length > 100) {
      const $ = cheerio.load(text);
      const seen = new Set();
      $('.Small--Box, .Block, .MovieItem, article').each((_, el) => {
        const a = $(el).find('a[href]').first();
        let href = a.attr('href') || '';
        if (!href || seen.has(href)) return;
        if (!href.startsWith('http')) href = `${BASE_S}${href}`;
        if (!href.includes('topcinemaa.com')) return;
        if (/\/(category|tag|author|page)\//.test(href)) return;
        seen.add(href);
        const rawTitle = $(el).find('.BlockTitle,.Title,.title,.entry-title,h2,h3,h4').first().text().trim()
          || a.attr('title') || $(el).find('img').attr('alt') || '';
        const title = rawTitle.replace(/^(فيلم|مسلسل|انمي)\s*/i, '').trim();
        if (!title || title.length < 2) return;
        const img = $(el).find('img').first();
        const poster = img.attr('data-src') || img.attr('src') || '';
        const year = $(el).find('.year,.Year,.date').first().text().replace(/\D/g, '').slice(0, 4);
        let type = 'movies';
        if (/\/series\//.test(href) || $(el).hasClass('Series') || $(el).hasClass('Mosalsalat')) type = 'series';
        else if (/ristoanime|\/anime\//.test(href) || $(el).hasClass('Anime')) type = 'anime';
        results.push({ title, href, poster, year, type });
      });
    }

    if (!results.length) {
      for (const postType of ['posts', 'movies', 'series']) {
        const { data: posts } = await fetchJson(
          `${BASE_S}/wp-json/wp/v2/${postType}?search=${encodeURIComponent(q)}&per_page=20&_fields=id,title,link,featured_media`
        );
        if (posts && posts.length) {
          for (const p of posts) {
            const title = (p.title?.rendered || '').replace(/<[^>]+>/g, '').replace(/^(فيلم|مسلسل)\s*/i, '').trim();
            const href = p.link || '';
            if (!title || !href) continue;
            let type = 'movies';
            if (/\/series\//.test(href)) type = 'series';
            results.push({ title, href, poster: '', year: '', type });
          }
          if (results.length) break;
        }
      }
    }

    data = { results, query: q };
    if (results.length > 0) setCache(key, data);
  }
  res.json(data);
}));

// ─── HLS PROXY ───────────────────────────────────────────────────────────────
// Fetches m3u8 playlists and media segments server-side with the correct
// Referer/Origin so CDNs that restrict direct browser access will respond.
// Usage: GET /api/hls-proxy?url=<encoded-url>&ref=<encoded-referer>
//
// For .m3u8 playlists: rewrites all segment/key/playlist URLs to go through
// this same proxy, so hls.js only ever calls our own server.
// For .ts / .aac / .key segments: streams bytes straight through.
//
app.get('/api/hls-proxy', asyncHandler(async (req, res) => {
  const targetUrl = req.query.url;
  const referer   = req.query.ref || targetUrl;

  if (!targetUrl) return res.status(400).send('url required');

  // Derive the Referer origin (e.g. https://updown.icu)
  let refOrigin = '';
  try { refOrigin = new URL(referer).origin; } catch {}

  let response;
  try {
    response = await proxyAxios.get(targetUrl, {
      headers: {
        'User-Agent': PROXY_UA,
        'Referer':  referer,
        'Origin':   refOrigin,
        'Accept':   '*/*',
      },
    });
  } catch (e) {
    console.error('[HLS-PROXY] fetch error', targetUrl, e.message);
    return res.status(502).send('upstream error: ' + e.message);
  }

  const ct = (response.headers['content-type'] || '').toLowerCase();
  const isM3u8 = ct.includes('mpegurl') || targetUrl.includes('.m3u8');

  if (isM3u8) {
    // ── Rewrite playlist so all URLs are routed through this proxy ────────────
    const text = response.data.toString('utf8');

    // Compute base URL for resolving relative paths
    const base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

    // Build the proxy prefix — use absolute path since we don't know the host here
    const proxyPrefix = `/api/hls-proxy?ref=${encodeURIComponent(referer)}&url=`;

    const rewritten = text
      .split('\n')
      .map(line => {
        const trimmed = line.trim();

        // Rewrite URI="..." in #EXT-X-KEY and #EXT-X-MAP
        const uriTagLine = trimmed.replace(
          /URI="([^"]+)"/g,
          (_, uri) => `URI="${proxyPrefix}${encodeURIComponent(resolveUrl(uri, base))}"`
        );
        if (uriTagLine !== trimmed) return uriTagLine;

        // Rewrite plain segment/playlist lines (don't touch comment/directive lines)
        if (trimmed && !trimmed.startsWith('#')) {
          const absUrl = resolveUrl(trimmed, base);
          return proxyPrefix + encodeURIComponent(absUrl);
        }
        return line;
      })
      .join('\n');

    res.set({
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    return res.send(rewritten);
  }

  // ── Pass-through for TS segments, key files, etc. ─────────────────────────
  res.set({
    'Content-Type': ct || 'video/MP2T',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600',
    'Content-Length': response.headers['content-length'] || '',
  });
  res.send(response.data);
}));

// Resolve a possibly-relative URL against a base
function resolveUrl(url, base) {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) {
    try { return new URL(url, base).href; } catch { return url; }
  }
  // relative path
  try { return new URL(url, base).href; } catch { return base + url; }
}

// ─── ADGUARD PROXY — fallback for embed pages ─────────────────────────────────
// Used as last resort when server-side extraction fails.
// Note: many embed players detect the proxy domain and block playback.
// Users will see a "فتح في نافذة جديدة" button in the UI as the primary fallback.
app.get('/api/watch-proxy', asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('url required');

  let html = '';
  try {
    const { data } = await axios.get(url, {
      timeout: 12000,
      headers: {
        'User-Agent': PROXY_UA,
        'Referer': url,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      maxRedirects: 5,
      responseType: 'text',
    });
    html = typeof data === 'string' ? data : String(data);
  } catch (e) {
    return res.status(502).send(`<html><body style="background:#111;color:#eee;font-family:sans-serif;padding:20px">فشل تحميل الصفحة: ${e.message}</body></html>`);
  }

  const AD_DOMAINS = [
    'googlesyndication','doubleclick','adservice.google','adnxs.com',
    'popads.net','popcash.net','adcash.com','adspyglass','exoclick.com',
    'trafficfactory','clickadu.com','propellerads','adskeeper','revcontent',
    'taboola.com','outbrain.com','juicyads.com','plugrush.com','traffichunt',
    'yandex-team.ru/ads','mc.yandex','smartadserver','bidgear','popunder',
    'adnetwork','banner_ads','adriver.ru','mgid.com','bidvertiser',
  ];

  html = html.replace(/<script[\s\S]*?<\/script>/gi, match => {
    const low = match.toLowerCase();
    if (AD_DOMAINS.some(d => low.includes(d))) return '<!-- adguard:script-removed -->';
    if (/window\.open\s*\(|popunder|showinterstitial|openpopup|showpopup|adblocker\s*=\s*false/i.test(match))
      return '<!-- adguard:popup-removed -->';
    return match;
  });

  html = html.replace(/<iframe[^>]*>/gi, match => {
    if (AD_DOMAINS.some(d => match.toLowerCase().includes(d))) return '<!-- adguard:iframe-removed -->';
    return match;
  });

  try {
    const u = new URL(url);
    const base = `${u.protocol}//${u.host}`;
    if (!/<base\s/i.test(html))
      html = html.replace(/<head>/i, `<head>\n<base href="${base}/">`);
    if (!/<head>/i.test(html))
      html = `<head><base href="${base}/"></head>` + html;
  } catch {}

  const adguardInject = `
<style>
[id*="ad-"],[class*="ad-"],[id*="ads-"],[class*="ads-"],
[id*="banner"],[class*="banner"],[id*="popup"],[class*="popup"],
[id*="overlay"],[class*="overlay"],[id*="interstitial"],[class*="interstitial"],
iframe[src*="doubleclick"],iframe[src*="googlesyndication"] { display:none!important; }
</style>
<script>
(function(){
  var _open = window.open;
  window.open = function(u, t, f) {
    if (!u || u === '' || u === 'about:blank') return _open ? _open.apply(this, arguments) : null;
    return null;
  };
  window.alert = function(){};
  window.onbeforeunload = null;
  window.adsbygoogle = { loaded: true };
  window.__adpushup = true;
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(function(muts) {
      muts.forEach(function(m) {
        m.addedNodes.forEach(function(n) {
          if (n.nodeType !== 1) return;
          var src = (n.src || n.href || '').toLowerCase();
          var adPat = /googlesyndication|doubleclick|popads|exoclick|adcash|propellerads|clickadu|popcash/;
          if (adPat.test(src) && n.parentNode) n.parentNode.removeChild(n);
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
</script>`;

  html = html.replace(/<\/head>/i, adguardInject + '</head>');
  if (!/<\/head>/i.test(html)) html = adguardInject + html;

  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'X-Frame-Options': 'ALLOWALL',
    'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-ancestors *",
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.send(html);
}));

// ─── STATUS ──────────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => res.json({ status: 'ok', mode: 'live' }));

// ─── PRODUCTION STATIC ───────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../dist/index.html')));
}

app.listen(PORT, () => console.log(`API server on http://localhost:${PORT}`));
