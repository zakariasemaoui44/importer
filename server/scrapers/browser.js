const axios = require('axios');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

// ─── Simple in-memory TTL cache ───────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.val;
}
function cacheSet(key, val) {
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { val, ts: Date.now() });
}

const http  = require('http');
const https = require('https');
const instance = axios.create({
  timeout: 20000,
  maxRedirects: 10,
  httpAgent:  new http.Agent({ keepAlive: true, maxSockets: 20 }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 20 }),
});

function parseCookies(headers) {
  const setCookies = headers['set-cookie'] || [];
  return setCookies
    .map(c => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function fetchPage(url, referer) {
  if (!url) return '';
  const cached = cacheGet('html:' + url);
  if (cached) return cached;
  try {
    const res = await instance.get(url, {
      headers: {
        ...HEADERS,
        ...(referer ? { Referer: referer } : { Referer: 'https://www.google.com/' }),
      },
      responseType: 'text',
    });
    const data = res.data || '';
    if (data.length > 500) cacheSet('html:' + url, data);
    return data;
  } catch {
    return '';
  }
}

async function fetchPageFull(url, referer) {
  if (!url) return { html: '', cookies: '' };
  try {
    const res = await instance.get(url, {
      headers: {
        ...HEADERS,
        ...(referer ? { Referer: referer } : { Referer: 'https://www.google.com/' }),
      },
      responseType: 'text',
    });
    const html = res.data || '';
    const cookies = parseCookies(res.headers);
    if (html.length > 500) cacheSet('html:' + url, html);
    return { html, cookies };
  } catch {
    return { html: '', cookies: '' };
  }
}

async function fetchJson(url) {
  if (!url) return { data: [], headers: {} };
  const cached = cacheGet('json:' + url);
  if (cached) return cached;
  try {
    const res = await instance.get(url, {
      headers: { ...HEADERS, Accept: 'application/json', Referer: 'https://www.google.com/' },
    });
    const raw = res.data;
    const data = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? [raw] : []);
    const result = { data, headers: res.headers };
    if (data.length > 0) cacheSet('json:' + url, result);
    return result;
  } catch {
    return { data: [], headers: {} };
  }
}

async function fetchPost(url, postData, referer, origin, cookies) {
  try {
    const body = typeof postData === 'string' ? postData : new URLSearchParams(postData).toString();
    const res  = await instance.post(url, body, {
      headers: {
        ...HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': '*/*',
        'Referer': referer || url,
        'Origin': origin || new URL(url).origin,
        ...(cookies ? { Cookie: cookies } : {}),
      },
      responseType: 'text',
    });
    const text = res.data || '';
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { text, json };
  } catch {
    return { text: '', json: null };
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function isDirectVideo(url) {
  return /\.(m3u8|mp4|webm)(\?|$)/i.test(url || '');
}

// ─── Dean Edwards p,a,c,k UNPACKER ───────────────────────────────────────────
// Many embed players (updown.icu, vidtube, etc.) pack their JS with this format:
//   eval(function(p,a,c,k,e,d){...}('PACKED',BASE,COUNT,'DICT'.split('|')))
// We decode it server-side so our URL-extraction regexes can find the real URLs.
function unpackEval(html) {
  if (!html.includes('eval(function(p,a,c,k')) return html;
  const re = /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d?\s*\)\s*\{[\s\S]{10,600}?\}\s*\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:[^'\\]|\\.)*)'\s*\.split\s*\(\s*['"][|]['"]\s*\)\s*\)\s*\)/g;
  return html.replace(re, (_, p, a, c, dictRaw) => {
    try {
      let decoded = p;
      const base = parseInt(a, 10);
      let count  = parseInt(c, 10);
      const k    = dictRaw.split('|');
      while (count--) {
        if (k[count]) {
          decoded = decoded.replace(new RegExp('\\b' + count.toString(base) + '\\b', 'g'), k[count]);
        }
      }
      return decoded;
    } catch {
      return _;
    }
  });
}

// ─── DEEP EXTRACT SOURCES ─────────────────────────────────────────────────────
// Fetches an embed page server-side and extracts the real video URL(s).
// Returns an array of { url, label } objects (label = quality like "720p").
// Returns [] when extraction fails or is not worth attempting.
//
// Supported players:
//   • UpDown (updown.icu)     — eval-packed JW Player with direct MP4
//   • StreamWish / FileLions  — JW Player single/multi HLS
//   • VidHide                 — JW Player HLS
//   • OK.ru                   — flashvars videoSrc
//   • StreamTape               — robotlink pattern
//   • Generic JW / VideoJS    — file/src/sources keys in <script>
//
async function deepExtractSources(embedUrl, referer) {
  if (!embedUrl || !embedUrl.startsWith('http')) return [];

  // Skip players with heavy token-based auth that can't be extracted statically
  if (/dood|ds2play|dooood|vidguard|vgfplay/i.test(embedUrl)) return [];

  const rawHtml = await fetchPage(embedUrl, referer || embedUrl);
  if (!rawHtml || rawHtml.length < 200) return [];

  // Decode any eval-packed JS blocks so URL patterns are visible in plain text
  const html = unpackEval(rawHtml);

  const sources = [];

  // ── 1. JW Player / VideoJS sources array ─────────────────────────────────
  // Matches:  sources:[{file:"...",label:"720p"},{file:"...",label:"360p"}]
  //       or: sources: [ {"file": "...", "label": "..."} ]
  const srcBlockRe = /sources\s*:\s*\[([\s\S]{5,4000}?)\]/i;
  const srcBlock = html.match(srcBlockRe);
  if (srcBlock) {
    const block = srcBlock[1];
    // Split into individual objects
    const objRe = /\{[^{}]*\}/g;
    let objM;
    while ((objM = objRe.exec(block)) !== null) {
      const obj = objM[0];
      const fileM = obj.match(/["']?file["']?\s*:\s*["']([^"']{8,})["']/i);
      if (!fileM) continue;
      let url = fileM[1].trim();
      if (url.startsWith('//')) url = 'https:' + url;
      if (!url.startsWith('http')) continue;
      // Only keep video URLs (m3u8, mp4, or looks like a CDN stream)
      if (!/\.(m3u8|mp4|webm)/.test(url) && !/cdn|stream|video|media/i.test(url)) continue;
      const labelM = obj.match(/["']?label["']?\s*:\s*["']([^"']+)["']/i);
      const label  = labelM ? labelM[1].trim() : '';
      sources.push({ url, label });
    }
  }

  // ── 2. jwplayer setup with single file key (not inside sources array) ─────
  if (!sources.length) {
    const fm = html.match(/["']?file["']?\s*:\s*["'](https?:\/\/[^"']{8,})["']/i)
            || html.match(/file\s*=\s*["'](https?:\/\/[^"']{8,})["']/i);
    if (fm) {
      const url = fm[1].trim();
      if (/\.(m3u8|mp4|webm)/i.test(url) || /cdn|stream|video|media/i.test(url))
        sources.push({ url, label: '' });
    }
  }

  // ── 3. VideoJS / plyr src= in JS ────────────────────────────────────────
  if (!sources.length) {
    const m = html.match(/["']src["']\s*:\s*["'](https?:\/\/[^"']{8,}\.(?:m3u8|mp4)[^"']*)["']/i);
    if (m) sources.push({ url: m[1].trim(), label: '' });
  }

  // ── 4. OK.ru — flashvars videoSrc ────────────────────────────────────────
  if (!sources.length && /ok\.ru/i.test(embedUrl)) {
    const m = html.match(/videoSrc\s*[=:]\s*["']([^"']{10,})["']/i)
           || html.match(/"url"\s*:\s*"(https?:\/\/[^"]{10,}\.(?:m3u8|mp4)[^"]*)"/)  ;
    if (m) sources.push({ url: decodeURIComponent(m[1]).replace(/\\u0026/g, '&'), label: '' });
  }

  // ── 5. StreamTape — robotlink concat trick ────────────────────────────────
  if (!sources.length && /streamtape|streamtp/i.test(embedUrl)) {
    const links = [...html.matchAll(/innerHTML\s*=\s*["']([^"']+)["']/g)].map(m => m[1]);
    if (links.length >= 2) {
      const joined = 'https:' + links.join('');
      // StreamTape URLs look like: https://streamtape.com/get_video?id=...
      if (joined.startsWith('https://') && joined.length > 40)
        sources.push({ url: joined, label: '' });
    }
  }

  // ── 6. Any direct m3u8 / mp4 URL in script tags ─────────────────────────
  if (!sources.length) {
    const m = html.match(/https?:\/\/[^\s"'<>\\]{10,}\.(?:m3u8|mp4)(?:\?[^\s"'<>\\]{0,300})?/i);
    if (m) sources.push({ url: m[0].replace(/:\d+:\d+$/, ''), label: '' });
  }

  return sources;
}

module.exports = { fetchPage, fetchPageFull, fetchJson, fetchPost, HEADERS, deepExtractSources, isDirectVideo };
