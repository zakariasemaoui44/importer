const cheerio = require('cheerio');
const { fetchPage, fetchPageFull, fetchJson, fetchPost, deepExtractSources, isDirectVideo } = require('./browser');

const BASE       = 'https://topcinemaa.com';
const AJAXAT_URL = `${BASE}/wp-content/themes/movies2023/Ajaxat/Single/Server.php`;
const MOVIES_URL = `${BASE}/movies/`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanHtml(raw) {
  return (raw || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .trim();
}

function norm(url) {
  if (!url) return '';
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/'))  return BASE + url;
  return url;
}

function toWatchUrl(url) {
  if (!url) return '';
  if (url.endsWith('/watch/')) return url;
  return url.endsWith('/') ? url + 'watch/' : url + '/watch/';
}

function serverColor(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('updown') || l.includes('متعدد')) return '#387c44';
  if (l.includes('dood') || l.includes('ds2play')) return '#e53935';
  if (l.includes('streamtape')) return '#f57c00';
  if (l.includes('voe')) return '#7b1fa2';
  if (l.includes('upstream')) return '#0288d1';
  if (l.includes('uqload')) return '#00838f';
  if (l.includes('mixdrop')) return '#5d4037';
  if (l.includes('streamwish') || l.includes('filelions')) return '#2e7d32';
  if (l.includes('vidhide')) return '#283593';
  if (l.includes('vidguard') || l.includes('vgfplay')) return '#ad1457';
  if (l.includes('ok.ru')) return '#1565c0';
  if (l.includes('hls') || l.includes('m3u8')) return '#00695c';
  if (l.includes('mp4')) return '#37474f';
  if (l.includes('topcinema')) return '#c62828';
  return '#1565c0';
}

function serverLabel(src, fallback, i) {
  if (fallback && fallback.length > 0) return fallback;
  if (!src) return `سيرفر ${i + 1}`;
  if (/dood|ds2play|dooood/.test(src)) return 'Dood';
  if (/streamtape|streamtp/.test(src)) return 'StreamTape';
  if (/voe\.sx/.test(src)) return 'Voe';
  if (/upstream/.test(src)) return 'UpStream';
  if (/uqload/.test(src)) return 'UQLoad';
  if (/mixdrop/.test(src)) return 'MixDrop';
  if (/streamwish|filelions/.test(src)) return 'StreamWish';
  if (/vidhide/.test(src)) return 'VidHide';
  if (/vidguard|vgfplay/.test(src)) return 'VidGuard';
  if (/ok\.ru/.test(src)) return 'OK.ru';
  if (/topcinemaa/.test(src)) return 'TopCinema';
  if (/\.m3u8/.test(src)) return 'HLS';
  if (/\.mp4/.test(src)) return 'MP4';
  return `سيرفر ${i + 1}`;
}

function extractNonce(html) {
  const patterns = [
    /["']nonce["']\s*:\s*["']([a-f0-9]{8,})["']/i,
    /var\s+\w*[Nn]once\w*\s*=\s*["']([a-f0-9]{8,})["']/i,
    /nonce\s*=\s*["']([a-f0-9]{8,})["']/i,
    /"ajax_nonce"\s*:\s*"([a-f0-9]{8,})"/i,
    /["']security["']\s*:\s*["']([a-f0-9]{8,})["']/i,
    /["']token["']\s*:\s*["']([a-f0-9]{8,})["']/i,
    /["']_wpnonce["']\s*:\s*["']([a-f0-9]{8,})["']/i,
    /wpNonce\s*[=:]\s*["']([a-f0-9]{8,})["']/i,
    /data-nonce=["']([a-f0-9]{8,})["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return '';
}

function cleanSrc(url) {
  if (!url) return '';
  url = url.replace(/:\d+:\d+$/, '');
  url = url.replace(/:\d+$/, '');
  if (url.startsWith('//')) url = 'https:' + url;
  return url;
}

function extractMyAjaxBase(html) {
  const m = (html || '').match(/MyAjaxURL\s*=\s*["']([^"']+?)["']/);
  return m ? m[1].replace(/\/$/, '') : null;
}

// ─── AJAX → embed URL (first level) ─────────────────────────────────────────

async function fetchServerUrl(dataId, dataServer, referer, nonce, cookies, serverPhpUrl) {
  const url = serverPhpUrl || AJAXAT_URL;
  const postData = { id: dataId, i: dataServer };
  const { text } = await fetchPost(url, postData, referer, BASE, cookies);
  console.log(`[AJAX] id=${dataId} server=${dataServer} -> len=${text ? text.length : 0} preview="${(text||'').slice(0,120)}"`);
  if (!text || text.trim() === '' || text === '-1') return '';

  let m = text.match(/<iframe[^>]+src=["']([^"']{10,})["']/i);
  if (m && m[1]) { const s = cleanSrc(m[1]); if (s.startsWith('http')) return s; }

  m = text.match(/<video[^>]+class=["'][^"']*jw-video[^"']*["'][^>]+src=["']([^"']{10,})["']/i)
    || text.match(/<video[^>]+src=["']([^"']{10,})["'][^>]+class=["'][^"']*jw-video[^"']*["']/i)
    || text.match(/<video[^>]+src=["'](https?:\/\/[^"']{10,})["']/i);
  if (m && m[1]) { const s = cleanSrc(m[1]); if (s.startsWith('http')) return s; }

  m = text.match(/["']file["']\s*:\s*["'](https?:\/\/[^"']{10,})["']/i)
    || text.match(/["']source["']\s*:\s*["'](https?:\/\/[^"']{10,})["']/i)
    || text.match(/["']src["']\s*:\s*["'](https?:\/\/[^"']{10,})["']/i)
    || text.match(/["']link["']\s*:\s*["'](https?:\/\/[^"']{10,})["']/i)
    || text.match(/["']url["']\s*:\s*["'](https?:\/\/[^"']{10,})["']/i);
  if (m && m[1]) { const s = cleanSrc(m[1]); if (s.startsWith('http')) return s; }

  m = text.match(/https?:\/\/[^\s"'<>\\]{10,}\.(?:mp4|m3u8)[^\s"'<>\\]*/i);
  if (m && m[0]) return cleanSrc(m[0]);

  m = text.match(/https?:\/\/[^\s"'<>\\]{15,}/);
  if (m && m[0]) return cleanSrc(m[0]);

  return '';
}

// ─── FIX: two-level resolver → [{label, color, src}] ─────────────────────────
// Strategy:
//   • updown.icu → X-Frame-Options: SAMEORIGIN → must extract video URL server-side
//   • All other embed players → no restrictions → return embed URL directly
//     so the client loads the REAL player in a direct iframe (no extra HTTP fetch)
async function resolveServerEntries(item, watchUrl, nonce, cookies, serverPhpUrl) {
  const embedUrl = await fetchServerUrl(item.dataId, item.dataServer, watchUrl, nonce, cookies, serverPhpUrl);
  const baseLabel = item.label || `سيرفر`;
  const baseColor = item.color || serverColor(item.label);

  if (!embedUrl) return [{ label: baseLabel, color: baseColor, src: '' }];

  // Already a direct video — serve as-is
  if (isDirectVideo(embedUrl)) return [{ label: baseLabel, color: baseColor, src: embedUrl }];

  // UpDown has X-Frame-Options: SAMEORIGIN — iframe blocked by browser.
  // Must extract the real video URL server-side.
  if (/updown\.icu|updown\.cam/i.test(embedUrl)) {
    const extracted = await deepExtractSources(embedUrl, watchUrl);
    if (extracted.length === 0) {
      return [{ label: baseLabel, color: baseColor, src: embedUrl, isEmbed: true }];
    }
    if (extracted.length === 1) {
      return [{ label: baseLabel, color: baseColor, src: extracted[0].url, referer: embedUrl }];
    }
    const qualityOrder = ['1080', '720', '480', '360', '240'];
    extracted.sort((a, b) => {
      const ai = qualityOrder.findIndex(q => a.label.includes(q));
      const bi = qualityOrder.findIndex(q => b.label.includes(q));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return extracted.map(src => ({
      label: src.label ? `${baseLabel} ${src.label}` : baseLabel,
      color: baseColor,
      src: src.url,
      referer: embedUrl,
    }));
  }

  // All other players (streamwish, dood, streamtape, mixdrop, vidtube, earnvids…):
  // No X-Frame-Options or CSP → return embed URL directly.
  // Client loads it in a direct iframe showing the REAL player.
  return [{ label: baseLabel, color: baseColor, src: embedUrl, isEmbed: true }];
}

// ─── MOVIES LISTING ──────────────────────────────────────────────────────────

async function scrapeMovies(page = 1, filters = {}) {
  if (filters.category || filters.genre) return await scrapeMoviesFiltered(page, filters);

  const url = page === 1 ? MOVIES_URL : `${BASE}/movies/page/${page}/`;
  const html = await fetchPage(url);
  if (html && html.length > 1000) {
    const result = parseMoviesHtml(html, page);
    if (result.movies.length > 0) return result;
  }
  const html2 = await fetchPage(`${MOVIES_URL}?paged=${page}`);
  if (html2 && html2.length > 1000) {
    const result2 = parseMoviesHtml(html2, page);
    if (result2.movies.length > 0) return result2;
  }
  return { movies: [], totalPages: 1, currentPage: page };
}

async function scrapeMoviesFiltered(page = 1, filters = {}) {
  const wpApi = `${BASE}/wp-json/wp/v2`;
  const perPage = 20;
  let catId = '', genreId = '', genreTax = '';
  if (filters.category) {
    const { data: cd } = await fetchJson(`${wpApi}/categories?slug=${filters.category}&_fields=id`);
    if (cd && cd[0] && cd[0].id) catId = String(cd[0].id);
  }
  if (filters.genre) {
    for (const tax of ['genres', 'genre']) {
      const { data: gd } = await fetchJson(`${wpApi}/${tax}?slug=${filters.genre}&_fields=id`);
      if (gd && gd[0] && gd[0].id) { genreId = String(gd[0].id); genreTax = tax; break; }
    }
  }
  for (const postType of ['movies', 'movie', 'posts']) {
    const qp = new URLSearchParams({ per_page: String(perPage), page: String(page), _fields: 'id,title,link,featured_media' });
    if (catId) qp.set('categories', catId);
    if (genreId && genreTax) qp.set(genreTax, genreId);
    const { data: posts, headers } = await fetchJson(`${wpApi}/${postType}?${qp}`);
    if (!posts || !posts.length) continue;
    const mediaIds = posts.map(p => p.featured_media).filter(id => id > 0);
    const mediaMap = new Map();
    if (mediaIds.length) {
      const { data: ml } = await fetchJson(`${wpApi}/media?include=${mediaIds.join(',')}&per_page=${mediaIds.length}&_fields=id,source_url`);
      for (const m of (ml || [])) mediaMap.set(m.id, m.source_url || '');
    }
    const totalPages = parseInt(String((headers || {})['x-wp-totalpages'] || '1'));
    const movies = posts.map(p => ({
      title: (p.title && p.title.rendered ? p.title.rendered : '').replace(/<[^>]+>/g, '').replace(/^(فيلم|مسلسل)\s*/i, '').trim(),
      href: p.link || '', poster: mediaMap.get(p.featured_media) || '', year: '', quality: '',
    })).filter(m => m.title && m.href);
    if (movies.length) return { movies, totalPages, currentPage: page };
  }
  const slug = filters.category || filters.genre || '';
  const pagePart = page > 1 ? `page/${page}/` : '';
  const tryUrls = filters.category
    ? [`${BASE}/category/${slug}/${pagePart}`, `${MOVIES_URL}?category_name=${slug}&paged=${page}`]
    : [`${BASE}/genre/${slug}/${pagePart}`, `${BASE}/genres/${slug}/${pagePart}`, `${BASE}/tag/${slug}/${pagePart}`];
  for (const tryUrl of tryUrls) {
    const html = await fetchPage(tryUrl);
    if (!html || html.length < 1000) continue;
    const result = parseMoviesHtml(html, page);
    if (result.movies.length > 0) return result;
  }
  return { movies: [], totalPages: 1, currentPage: page };
}

async function scrapeMovieFilters() {
  const wpApi = `${BASE}/wp-json/wp/v2`;
  const categories = [], genres = [];
  const { data: cats } = await fetchJson(`${wpApi}/categories?per_page=100&_fields=name,slug,id,count`);
  for (const c of (cats || []))
    if (c.name && c.name !== 'Uncategorized' && (c.count == null || c.count > 0))
      categories.push({ name: c.name, term: c.slug, id: String(c.id) });
  for (const tax of ['genres', 'genre']) {
    const { data: gs } = await fetchJson(`${wpApi}/${tax}?per_page=100&_fields=name,slug,id,count`);
    if (gs && gs.length) {
      for (const g of gs)
        if (g.name && (g.count == null || g.count > 0))
          genres.push({ name: g.name, term: g.slug, id: String(g.id) });
      break;
    }
  }
  if (!categories.length) {
    const html = await fetchPage(MOVIES_URL);
    if (html) {
      const $ = cheerio.load(html);
      $('a[href*="/category/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const m = href.match(/\/category\/([^/?#]+)/);
        const term = m ? m[1] : '';
        const name = $(el).text().trim();
        if (name && term && name.length < 40 && !categories.find(c => c.term === term))
          categories.push({ name, term, id: '' });
      });
    }
  }
  return { categories, genres };
}

function parseMoviesHtml(html, page) {
  const $ = cheerio.load(html);
  const movies = extractItemsFromHtml($);
  let totalPages = page;
  $('a.page-numbers,.page-numbers a,nav.pagination a,.nav-links a').each((_, el) => {
    const n = parseInt($(el).text().trim());
    if (!isNaN(n) && n > totalPages) totalPages = n;
  });
  return { movies, totalPages, currentPage: page };
}

function extractItemsFromHtml($) {
  const items = [];
  const seen  = new Set();
  const selectors = ['.Small--Box.Movie','.Small--Box.Film','.Small--Box','.Block.Movie','.Block','.MovieItem','article.post'];
  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const a = $(el).find('a[href]').first();
      let href = a.attr('href') || '';
      if (!href) return;
      if (!href.startsWith('http')) href = norm(href);
      if (!href.includes('topcinemaa.com') || seen.has(href)) return;
      if (/\/(category|tag|author|page|movies\/?)$/.test(href)) return;
      seen.add(href);
      const rawTitle =
        $(el).find('.BlockTitle,.Title,.title,.entry-title,h2 a,h3 a,h4 a').first().text().trim() ||
        a.attr('title') || $(el).find('img').attr('alt') || '';
      const title = rawTitle.replace(/^(فيلم|مسلسل)\s*/i, '').trim();
      if (!title || title.length < 2) return;
      const style  = $(el).find('[style*="url("]').first().attr('style') || '';
      const pm     = style.match(/url\(['"']?([^'"')]+)['"']?\)/);
      const img    = $(el).find('img').first();
      const poster  = pm ? pm[1] : (img.attr('data-src') || img.attr('data-original') || img.attr('src') || '');
      const quality = $(el).find('.Quality,.quality,.iMDBRating').first().text().trim();
      const year    = $(el).find('.year,.Year,.date').first().text().replace(/\D/g, '').slice(0, 4);
      items.push({ title, href, poster, year, quality });
    });
    if (items.length >= 4) break;
  }
  return items;
}

// ─── MOVIE DETAIL ─────────────────────────────────────────────────────────────

async function scrapeMovieDetail(postUrl) {
  const html = await fetchPage(postUrl);
  if (!html || html.length < 500)
    return { title:'', poster:'', description:'', meta:{}, genres:[], cast:[], imdb:'', watchUrl: toWatchUrl(postUrl), sourceUrl: postUrl };
  const $ = cheerio.load(html);
  return extractSingleContainerDetail($, postUrl);
}

function extractSingleContainerDetail($, postUrl) {
  let poster = $('section.Single--Container .left .image img,section.Single--Container .image img').first().attr('src') || '';
  if (!poster) {
    const sty = $('section.Single--Container .left,section.Single--Container .image').first().attr('style') || '';
    const pm  = sty.match(/url\(['"']?([^'"')]+)['"']?\)/);
    if (pm) poster = pm[1];
  }
  if (!poster) poster = $('meta[property="og:image"]').attr('content') || '';

  let title = cleanHtml(
    $('section.Single--Container h1,section.Single--Container .BlockTitle,section.Single--Container .Title').first().text() ||
    $('h1.post-title,h2.post-title,.PostTitle,.entry-title').first().text() ||
    $('h1').not('.site-title,header h1').first().text() ||
    $('meta[property="og:title"]').attr('content') ||
    $('title').text().replace(/\s*[-|–|·]\s*.*$/, '').trim() || ''
  ).replace(/^(فيلم|مسلسل)\s*/i, '').trim();

  const description = cleanHtml(
    $('.infoAndWatch .story,.infoAndWatch .infoB .story,.infoAndWatch .StoryLine').first().text() ||
    $('section.Single--Container .Description,section.Single--Container .story').first().text() ||
    $('.Description p,.story p,.entry-content p').first().text()
  ).slice(0, 800);

  const meta = {}, genres = [], cast = [];

  $('ul.InfoBox li,.InfoBox li,.infoAndWatch li,section.Single--Container .Info li,.SingleInfo li,.PostInfo li').each((_, el) => {
    const label = $(el).find('em,.label,strong,dt').first().text().replace(/\s*:\s*$/, '').trim();
    if (!label) return;
    const linkTexts = $(el).find('a').map((_, a) => $(a).text().trim()).get().filter(Boolean);
    const value = linkTexts.length
      ? linkTexts.join(' ، ')
      : $(el).clone().children('em,.label,strong,dt,i.fa,i.fal,i.far,i.fas').remove().end()
          .text().replace(/^\s*:\s*/, '').trim();
    if (value && value !== label && value.length < 400) meta[label] = value;
    $(el).find('a[href*="genre"],a[href*="category"]').each((_, a) => {
      const t = $(a).text().trim();
      if (t && t.length < 30 && !genres.includes(t)) genres.push(t);
    });
  });

  if (!genres.length) {
    $('section.Single--Container a[href*="genre"],section.Single--Container a[href*="category"],.GenresList a').each((_, el) => {
      const t = $(el).text().trim();
      if (t && t.length < 30 && !genres.includes(t)) genres.push(t);
    });
  }

  const castKey = Object.keys(meta).find(k => /بطول|ممثل|cast|actor/i.test(k));
  if (castKey) {
    meta[castKey].split(/[\u060C,،\/\n]+/).forEach(name => {
      name = name.trim();
      if (name && name.length > 1 && name.length < 60) cast.push({ name, href: '', image: '' });
    });
  }

  let imdb = '';
  const imdbEl = $('[class*="imdb" i],[class*="IMDb"],.Rate,.iMDBRating,.RateBox,.rating-imdb').first();
  if (imdbEl.length) {
    const txt = imdbEl.text().trim();
    const m = txt.match(/(\d+\.?\d*)\s*\/\s*10/) || txt.match(/\b(\d+\.?\d*)\b/);
    if (m) imdb = m[1];
  }
  if (!imdb) {
    const imdbLink = $('a[href*="imdb.com/title"]');
    if (imdbLink.length) {
      const txt = imdbLink.closest('li,.Row,.row').text().trim();
      const m = txt.match(/(\d+\.?\d*)\s*\/\s*10/) || txt.match(/\b(\d\.\d)\b/);
      if (m) imdb = m[1];
    }
  }

  const canonicalUrl = $('link[rel="canonical"]').attr('href') || postUrl;
  return { title, poster, description, meta, genres, cast, imdb, watchUrl: toWatchUrl(canonicalUrl), sourceUrl: canonicalUrl };
}

// ─── MOVIE WATCH ─────────────────────────────────────────────────────────────

async function scrapeMovieWatch(postUrl) {
  const watchUrl = toWatchUrl(postUrl);

  const [watchFull, htmlBase] = await Promise.all([
    fetchPageFull(watchUrl, postUrl),
    watchUrl !== postUrl ? fetchPage(postUrl, postUrl) : Promise.resolve(''),
  ]);

  const htmlWatch = watchFull.html;
  const cookies   = watchFull.cookies;
  const html = (htmlWatch || '').length > 500 ? htmlWatch : (htmlBase || htmlWatch || '');
  if (!html) return { servers: [], iframes: [], videoSources: [], title: '' };

  const $ = cheerio.load(html);
  const nonce = extractNonce(html);
  console.log(`[WATCH/movie] url=${watchUrl} html_len=${html.length} nonce="${nonce||'NOT FOUND'}"`);

  const serverItems = [];
  const seenIds = new Set();

  $('.watch--servers--list ul li.server--item,.watch--servers--list ul li[data-server]').each((_, el) => {
    const dataId     = $(el).attr('data-id') || '';
    const dataServer = $(el).attr('data-server') || '';
    const label      = $(el).find('span').first().text().trim() ||
                       $(el).clone().children('i').remove().end().text().trim() ||
                       `سيرفر ${serverItems.length + 1}`;
    const iStyle     = $(el).find('i').first().attr('style') || '';
    const colorMatch = iStyle.match(/background:\s*(#[0-9a-f]{3,8}|[a-z]+)/i);
    const color      = colorMatch ? colorMatch[1] : serverColor(label);
    const key = `${dataId}:${dataServer}`;
    if (!dataId || seenIds.has(key)) return;
    seenIds.add(key);
    serverItems.push({ dataId, dataServer, label, color });
  });

  if (!serverItems.length) return await fallbackServerExtraction($, html, watchUrl);

  const myAjaxBase  = extractMyAjaxBase(html);
  const serverPhpUrl = myAjaxBase ? `${myAjaxBase}/Single/Server.php` : AJAXAT_URL;

  // ── FIX: استخدم resolveServerEntries بدل fetchServerUrl المباشر ──────────
  const resolved = await Promise.all(
    serverItems.map(item => resolveServerEntries(item, watchUrl, nonce, cookies, serverPhpUrl))
  );
  const servers = resolved.flat().filter(s => s.label);

  $('video[src]').each((_, el) => {
    let src = $(el).attr('src') || '';
    if (!src || src.length < 10 || !src.startsWith('http')) return;
    if (servers.some(s => s.src === src)) return;
    const label = serverLabel(src, '', servers.length);
    servers.push({ label, color: serverColor(label), src });
  });

  const title = cleanHtml($('h1.PostTitleWatch,h1.EntryTitle,h1.post-title,.Title,h1').first().text())
    .replace(/^(فيلم|مسلسل)\s*/i, '').trim();

  return { servers, iframes: servers.map(s => s.src), videoSources: [], title };
}

async function fallbackServerExtraction($, html, refUrl) {
  const seen    = new Set();
  const servers = [];

  $('li[data-watch],li[data-link],li[data-src]').each((_, el) => {
    let src = $(el).attr('data-watch')||$(el).attr('data-link')||$(el).attr('data-src')||'';
    if (!src || seen.has(src)) return;
    if (src.startsWith('//')) src = 'https:' + src;
    else if (src.startsWith('/')) src = BASE + src;
    if (!src.startsWith('http')) return;
    seen.add(src);
    const label = $(el).find('span').text().trim() || serverLabel(src, '', servers.length);
    servers.push({ label, color: serverColor(label), src });
  });

  if (!servers.length) {
    $('script:not([src])').each((_, el) => {
      const txt = $(el).html() || '';
      const pats = [
        /["'](?:src|url|link|iframe|embed|file|watch)["']\s*:\s*["'](https?:\/\/[^"']{15,})["']/gi,
        /player_url\s*=\s*["'](https?:\/\/[^"']{15,})["']/gi,
      ];
      for (const re of pats) {
        let m;
        while ((m = re.exec(txt)) !== null) {
          const src = m[1];
          if (src && !seen.has(src) && !src.includes('.css') && src.length < 400) {
            seen.add(src);
            servers.push({ label: serverLabel(src, '', servers.length), color: serverColor(''), src });
          }
        }
      }
    });
  }

  $('video[src]').each((_, el) => {
    let src = $(el).attr('src') || '';
    if (!src || src.length < 10 || seen.has(src)) return;
    if (src.startsWith('//')) src = 'https:' + src;
    if (!src.startsWith('http')) return;
    seen.add(src);
    servers.push({ label: serverLabel(src, '', servers.length), color: serverColor(''), src });
  });

  $('iframe').each((_, el) => {
    let src = $(el).attr('src')||$(el).attr('data-src')||'';
    if (!src || src.length < 10 || seen.has(src)) return;
    if (src.startsWith('//')) src = 'https:' + src;
    if (!src.startsWith('http') || /google|facebook|analytics/.test(src)) return;
    seen.add(src);
    servers.push({ label: serverLabel(src, '', servers.length), color: serverColor(''), src, isEmbed: true });
  });

  const title = cleanHtml($('h1').first().text()).replace(/^(فيلم|مسلسل)\s*/i,'').trim();
  return { servers, iframes: servers.map(s => s.src), videoSources: [], title };
}

module.exports = { scrapeMovies, scrapeMovieDetail, scrapeMovieWatch, scrapeMovieFilters };
