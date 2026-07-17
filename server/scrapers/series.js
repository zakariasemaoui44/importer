const cheerio = require('cheerio');
const { fetchPage, fetchPageFull, fetchJson, fetchPost, deepExtractSources, isDirectVideo } = require('./browser');

const BASE         = 'https://topcinemaa.com';
const AJAXAT_URL   = `${BASE}/wp-content/themes/movies2023/Ajaxat/Single/Server.php`;
const SERIES_CAT_URL = `${BASE}/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%a7%d8%ac%d9%86%d8%a8%d9%8a/`;

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

function extractSeasonNum(title) {
  const arMap = { 'الأول':1,'الأولى':1,'الثاني':2,'الثانية':2,'الثالث':3,'الثالثة':3,
                  'الرابع':4,'الرابعة':4,'الخامس':5,'الخامسة':5,
                  'السادس':6,'السادسة':6,'السابع':7,'السابعة':7,
                  'الثامن':8,'الثامنة':8,'التاسع':9,'التاسعة':9,'العاشر':10,'العاشرة':10 };
  const m = title.match(/الموسم\s+(الأول[ى]?|الثاني[ة]?|الثالث[ة]?|الرابع[ة]?|الخامس[ة]?|السادس[ة]?|السابع[ة]?|الثامن[ة]?|التاسع[ة]?|العاشر[ة]?|\d+)/i)
         || title.match(/season\s+(\d+)/i) || title.match(/\bs(\d+)\b/i);
  if (!m) return 1;
  return arMap[m[1]] || parseInt(m[1]) || 1;
}

// ─── FIX: رقم الموسم/الحلقة من عنصر .epnum مباشرة ────────────────────────────
// HTML: <div class="epnum"><span>الموسم</span>1</div>
function extractNumFromEpNumEl($el) {
  if (!$el || !$el.length) return null;
  const clone = $el.clone();
  clone.find('span').remove();
  const num = parseInt(clone.text().trim());
  return isNaN(num) ? null : num;
}

function extractEpNum(title, href) {
  let m = title.match(/الحلقة\s+(\d+)/i);
  if (m) return parseInt(m[1]) || 9999;
  m = title.match(/episode\s+(\d+)/i) || title.match(/\bep\s*(\d+)/i);
  if (m) return parseInt(m[1]) || 9999;
  m = title.match(/S\d+E(\d+)/i);
  if (m) return parseInt(m[1]) || 9999;
  if (href) {
    const slug = decodeURIComponent(href).replace(/\/+$/, '').split('/').pop() || '';
    let um = slug.match(/(?:episode|ep|halqa|حلقة)[_\-](\d+)/i);
    if (um) return parseInt(um[1]) || 9999;
    um = slug.match(/[_\-](\d+)$/);
    if (um && parseInt(um[1]) < 5000) return parseInt(um[1]) || 9999;
  }
  m = title.match(/(\d+)\s*$/);
  if (m && parseInt(m[1]) < 5000) return parseInt(m[1]) || 9999;
  m = title.match(/^(\d+)\s*[-–]/);
  if (m) return parseInt(m[1]) || 9999;
  return 9999;
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

// ─── FIX: two-level resolver → returns [{label, color, src}] ─────────────────
// Strategy:
//   • updown.icu → X-Frame-Options: SAMEORIGIN → must extract video URL server-side
//   • All other embed players → no restrictions → return embed URL directly
//     so the client loads the REAL player in a direct iframe (no extra HTTP fetch)
async function resolveServerEntries(item, watchUrl, nonce, cookies, serverPhpUrl) {
  const embedUrl = await fetchServerUrl(item.dataId, item.dataServer, watchUrl, nonce, cookies, serverPhpUrl);
  const baseLabel = item.label || `سيرفر`;
  const baseColor = item.color || serverColor(item.label);

  if (!embedUrl) {
    return [{ label: baseLabel, color: baseColor, src: '' }];
  }

  // Already a direct video — serve as-is
  if (isDirectVideo(embedUrl)) {
    return [{ label: baseLabel, color: baseColor, src: embedUrl }];
  }

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

// ─── SERIES LISTING ──────────────────────────────────────────────────────────

async function scrapeSeries(page = 1, filters = {}, catUrl = SERIES_CAT_URL) {
  if (filters.category || filters.genre) {
    return await scrapeSeriesFiltered(page, filters);
  }
  const url = page === 1 ? catUrl : `${catUrl}page/${page}/`;
  const html = await fetchPage(url);
  if (html && html.length > 1000) {
    const result = parseSeriesListHtml(html, page);
    if (result.series.length > 0) return result;
  }
  const html2 = await fetchPage(`${catUrl}?paged=${page}`);
  if (html2 && html2.length > 1000) {
    const result2 = parseSeriesListHtml(html2, page);
    if (result2.series.length > 0) return result2;
  }
  return { series: [], totalPages: 1, currentPage: page };
}

async function scrapeSeriesFiltered(page = 1, filters = {}) {
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
  for (const postType of ['series', 'tv-series', 'mosalsalat', 'posts']) {
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
    const series = posts.map(p => ({
      title: (p.title && p.title.rendered ? p.title.rendered : '').replace(/<[^>]+>/g, '').replace(/^(فيلم|مسلسل)\s*/i, '').trim(),
      href: p.link || '', poster: mediaMap.get(p.featured_media) || '', year: '', eps: '',
    })).filter(s => s.title && s.href);
    if (series.length) return { series, totalPages, currentPage: page };
  }
  const slug = filters.category || filters.genre || '';
  const pagePart = page > 1 ? `page/${page}/` : '';
  const tryUrls = filters.category
    ? [`${BASE}/category/${slug}/${pagePart}`, `${SERIES_CAT_URL}?category_name=${slug}&paged=${page}`]
    : [`${BASE}/genre/${slug}/${pagePart}`, `${BASE}/genres/${slug}/${pagePart}`, `${BASE}/tag/${slug}/${pagePart}`];
  for (const tryUrl of tryUrls) {
    const html = await fetchPage(tryUrl);
    if (!html || html.length < 1000) continue;
    const result = parseSeriesListHtml(html, page);
    if (result.series.length > 0) return result;
  }
  return { series: [], totalPages: 1, currentPage: page };
}

async function scrapeSeriesFilters() {
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
  if (!genres.length) {
    const html = await fetchPage(SERIES_CAT_URL);
    if (html) {
      const $ = cheerio.load(html);
      $('a[href*="/genre/"], a[href*="/genres/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const m = href.match(/\/genres?\/([^/?#]+)/);
        const term = m ? m[1] : '';
        const name = $(el).text().trim();
        if (name && term && name.length < 40 && !genres.find(g => g.term === term))
          genres.push({ name, term, id: '' });
      });
    }
  }
  return { categories, genres };
}

function extractSeriesItems($) {
  const series = [];
  const seen   = new Set();
  const selectors = ['.Small--Box.Series','.Small--Box.Mosalsalat','.Small--Box','.Block.Series','.Block','.MovieItem','article.post'];
  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const a = $(el).find('a[href]').first();
      let href = a.attr('href') || '';
      if (!href) return;
      if (!href.startsWith('http')) href = norm(href);
      if (!href.includes('topcinemaa.com') || seen.has(href)) return;
      if (/\/(category|tag|author|page)\//.test(href)) return;
      seen.add(href);
      const rawTitle =
        $(el).find('.BlockTitle,.Title,.title,h2 a,h3 a,h4 a,.entry-title a').first().text().trim() ||
        a.attr('title') || $(el).find('img').attr('alt') || '';
      const title = rawTitle.replace(/^(مسلسل|فيلم)\s*/i, '').trim();
      if (!title || title.length < 2) return;
      const style = $(el).find('[style*="url("]').first().attr('style') || '';
      const pm    = style.match(/url\(['"']?([^'"')]+)['"']?\)/);
      const img   = $(el).find('img').first();
      const poster = pm ? pm[1] : (img.attr('data-src') || img.attr('data-original') || img.attr('src') || '');
      const year   = $(el).find('.year,.Year,.date').first().text().replace(/\D/g, '').slice(0, 4);
      series.push({ title, href, poster, year, quality: '' });
    });
    if (series.length >= 4) break;
  }
  return series;
}

function parseSeriesListHtml(html, page) {
  const $ = cheerio.load(html);
  const series = extractSeriesItems($);
  let totalPages = page;
  $('a.page-numbers,.page-numbers a,nav.pagination a,.nav-links a').each((_, el) => {
    const n = parseInt($(el).text().trim());
    if (!isNaN(n) && n > totalPages) totalPages = n;
  });
  return { series, totalPages, currentPage: page };
}

// ─── SERIES DETAIL ───────────────────────────────────────────────────────────

async function scrapeSeriesDetail(postUrl) {
  const url  = norm(postUrl);
  const html = await fetchPage(url);
  const $    = cheerio.load(html || '');

  let poster = $('section.Single--Container .left .image img, section.Single--Container .image img').first().attr('src') || '';
  if (!poster) {
    const sty = $('section.Single--Container .left, section.Single--Container .image').first().attr('style') || '';
    const pm  = sty.match(/url\(['"']?([^'"')]+)['"']?\)/);
    if (pm) poster = pm[1];
  }
  if (!poster) poster = $('meta[property="og:image"]').attr('content') || '';

  let title = cleanHtml(
    $('section.Single--Container h1, section.Single--Container .BlockTitle, section.Single--Container .Title').first().text() ||
    $('h1.post-title,.PostTitle,.entry-title').first().text() ||
    $('h1').not('.site-title, header h1').first().text() ||
    $('meta[property="og:title"]').attr('content') || ''
  ).replace(/^(مسلسل|فيلم)\s*/i, '').trim();

  const description = cleanHtml(
    $('.infoAndWatch .story, .infoAndWatch .infoB .story').first().text() ||
    $('section.Single--Container .Description, section.Single--Container .StoryLine').first().text() ||
    $('.Description p,.story p').first().text()
  ).slice(0, 800);

  const meta = {}, genres = [], cast = [];

  $('ul.InfoBox li,.InfoBox li,.infoAndWatch li,section.Single--Container .Info li').each((_, el) => {
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
  const imdbEl = $('[class*="imdb" i],[class*="IMDb"],.Rate,.iMDBRating,.RateBox').first();
  if (imdbEl.length) {
    const txt = imdbEl.text().trim();
    const m = txt.match(/(\d+\.?\d*)\s*\/\s*10/) || txt.match(/\b(\d+\.?\d*)\b/);
    if (m) imdb = m[1];
  }

  // ─── FIX: رقم الموسم من .epnum مباشرة ────────────────────────────────────
  const seasonCards = [];
  $('ul.Blocks--List .Small--Box.Season,.Blocks--List .Season,.SeasonsBox .Season,.SeasonsList .Season').each((_, el) => {
    const a = $(el).find('a[href]').first();
    let href = a.attr('href') || '';
    if (!href) return;
    if (!href.startsWith('http')) href = norm(href);

    const epNumEl = $(el).find('.epnum');
    let seasonNum = extractNumFromEpNumEl(epNumEl);
    let sTitle = '';
    if (epNumEl.length) {
      const spanText = epNumEl.find('span').first().text().trim();
      sTitle = `${spanText} ${seasonNum || ''}`.trim();
    }
    if (!sTitle) {
      sTitle = cleanHtml($(el).find('.Title,.title,h3,h4,span').not('i').first().text() || a.attr('title') || a.text())
        .replace(/^(مسلسل)\s*/i, '').trim();
    }
    if (!seasonNum) seasonNum = extractSeasonNum(sTitle || href);

    const img  = $(el).find('img').first();
    const sty2 = $(el).find('[style*="url("]').first().attr('style') || '';
    const pm2  = sty2.match(/url\(['"']?([^'"')]+)['"']?\)/);
    const sPoster = pm2 ? pm2[1] : (img.attr('data-src') || img.attr('src') || '');
    seasonCards.push({ title: sTitle || `الموسم ${seasonNum}`, href, seasonNum, poster: sPoster });
  });

  const isSeasonPage = $('section.allepcont,.allepcont').length > 0;
  let seasons = [];

  if (seasonCards.length > 0) {
    const seasonData = await Promise.all(
      seasonCards.sort((a, b) => a.seasonNum - b.seasonNum)
        .map(s => fetchSeasonEpisodes(s.href, s.title, s.seasonNum, s.poster))
    );
    seasons = seasonData.filter(Boolean);
  } else if (isSeasonPage) {
    const eps = extractEpisodesFromPage($, url);
    if (eps.length > 0) seasons = [{ title: title || 'الموسم الأول', seasonNum: 1, episodes: eps }];
  }

  if (seasons.length === 0) {
    const altLinks = [];
    const seenLinks = new Set([url]);
    $('a[href*="/series/"]').each((_, el) => {
      let href = $(el).attr('href') || '';
      if (!href.startsWith('http')) href = norm(href);
      if (!href || !href.includes('topcinemaa.com') || seenLinks.has(href)) return;
      if (/الموسم|season/i.test(href + $(el).text())) {
        seenLinks.add(href);
        altLinks.push({ href, title: $(el).text().trim() || '' });
      }
    });
    if (altLinks.length > 0) {
      const data = await Promise.all(altLinks.map((s, i) => fetchSeasonEpisodes(s.href, s.title, i + 1)));
      seasons = data.filter(Boolean);
    }
  }

  if (seasons.length === 0) {
    seasons = [{ title: 'مشاهدة', seasonNum: 1, episodes: [{ title, href: url }] }];
  }

  if (!title) {
    try { title = decodeURIComponent(url.replace(/\/$/, '').split('/').pop()).replace(/-/g, ' ').replace(/^مسلسل\s*/i, '').trim(); }
    catch { title = url.replace(/\/$/, '').split('/').pop().replace(/-/g, ' ').trim(); }
  }

  return { title, poster, description, meta, genres, cast, imdb, seasons, sourceUrl: url };
}

async function fetchSeasonEpisodes(seasonUrl, seasonTitle, seasonNum, poster) {
  try {
    const html = await fetchPage(seasonUrl);
    if (!html || html.length < 500) return null;
    const $ = cheerio.load(html);
    const eps = extractEpisodesFromPage($, seasonUrl);
    if (!eps.length) return null;
    const resolvedPoster = poster || $('meta[property="og:image"]').attr('content') || '';
    return { title: seasonTitle || `الموسم ${seasonNum}`, seasonNum: seasonNum || 1, poster: resolvedPoster, episodes: eps };
  } catch { return null; }
}

// ─── FIX: استخراج الحلقات من .ep-info h2 و .epnum ───────────────────────────

function extractEpisodesFromPage($, pageUrl) {
  const eps  = [];
  const seen = new Set();
  const rowSels = [
    'section.tabContents section.allepcont .row',
    'section.allepcont.getMoreByScroll .row',
    'section.allepcont .row',
    '.allepcont .row',
    '.tabContents .row',
  ];
  let $row = null;
  for (const sel of rowSels) {
    if ($(sel).length) { $row = $(sel); break; }
  }

  if ($row && $row.length) {
    $row.find('a[href],.Small--Box,.ep-item,article,.col,.BlockItem').each((_, el) => {
      const a = $(el).is('a') ? $(el) : $(el).find('a[href]').first();
      let href = a.attr('href') || '';
      if (!href) return;
      if (!href.startsWith('http')) href = norm(href);
      if (!href.includes('topcinemaa.com') || seen.has(href) || href === pageUrl) return;
      if (/\/(category|tag|author|page)\//.test(href)) return;
      seen.add(href);

      // ── FIX: أولوية لعنوان الحلقة من .ep-info h2 ──
      const epInfoTitle = $(el).find('.ep-info h2,.ep-info h3,.ep-info .title').first().text().trim();
      const rawTitle = epInfoTitle ||
        $(el).find('.Title,.title,.BlockTitle,h4,h3,span').first().text().trim() ||
        a.attr('title') || a.text().trim() || '';
      const epTitle = rawTitle.replace(/^(مسلسل|فيلم)\s*/i, '').trim();
      if (!epTitle || epTitle.length < 2) return;

      // ── FIX: رقم الحلقة من .epnum مباشرة ──
      const epNumEl = $(el).find('.epnum');
      let epNum = 9999;
      if (epNumEl.length) {
        const fromEl = extractNumFromEpNumEl(epNumEl);
        if (fromEl !== null) epNum = fromEl;
      }
      if (epNum === 9999) epNum = extractEpNum(epTitle, href);
      eps.push({ title: epTitle, href, epNum });
    });
  }

  if (!eps.length) {
    $('a[href]').each((_, el) => {
      let href = $(el).attr('href') || '';
      if (!href.startsWith('http')) href = norm(href);
      if (!href.includes('topcinemaa.com') || seen.has(href) || href === pageUrl) return;
      if (/\/(category|tag|author|page|series\/?)$/.test(href)) return;
      const txt = $(el).text().trim();
      if (!txt || !/الحلقة|episode|\bep\s*\d/i.test(txt)) return;
      seen.add(href);
      eps.push({ title: txt.replace(/^(مسلسل|فيلم)\s*/i, '').trim(), href, epNum: extractEpNum(txt, href) });
    });
  }

  const sorted = eps.sort((a, b) => a.epNum - b.epNum);
  let unknownCounter = sorted.filter(e => e.epNum !== 9999).length;
  return sorted.map(e => ({
    title: e.title, href: e.href,
    epNum: (e.epNum && e.epNum !== 9999) ? e.epNum : ++unknownCounter,
  }));
}

// ─── EPISODE WATCH ────────────────────────────────────────────────────────────

async function scrapeEpisodeWatch(url) {
  const watchUrl = toWatchUrl(url);
  const [watchFull, htmlEp] = await Promise.all([
    fetchPageFull(watchUrl, url),
    watchUrl !== url ? fetchPage(url, url) : Promise.resolve(''),
  ]);

  const htmlWatch = watchFull.html;
  const cookies   = watchFull.cookies;
  const html = (htmlWatch || '').length > 500 ? htmlWatch : (htmlEp || htmlWatch || '');
  if (!html) return { servers: [], iframes: [], videoSources: [], title: '', prevEp: '', nextEp: '' };

  const $ = cheerio.load(html);
  const nonce = extractNonce(html);
  console.log(`[WATCH/series] url=${watchUrl} html_len=${html.length} nonce="${nonce||'NOT FOUND'}"`);

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

  if (!serverItems.length) {
    return await fallbackServerExtraction($, html, watchUrl);
  }

  const myAjaxBase  = extractMyAjaxBase(html);
  const serverPhpUrl = myAjaxBase ? `${myAjaxBase}/Single/Server.php` : AJAXAT_URL;

  // ── FIX: استخدم resolveServerEntries بدل fetchServerUrl المباشر ──────────
  const resolved = await Promise.all(
    serverItems.map(item => resolveServerEntries(item, watchUrl, nonce, cookies, serverPhpUrl))
  );
  const servers = resolved.flat().filter(s => s.label);

  // أضف أي <video src> مضمّن في الصفحة نفسها
  $('video[src]').each((_, el) => {
    let src = $(el).attr('src') || '';
    if (!src || src.length < 10 || !src.startsWith('http')) return;
    if (servers.some(s => s.src === src)) return;
    const label = serverLabel(src, '', servers.length);
    servers.push({ label, color: serverColor(label), src });
  });

  // ── FIX: عنوان الحلقة من .ep-info h2 أولاً ──
  const epInfoTitle = cleanHtml($('.ep-info h2,.ep-info h3,.ep-info .title').first().text());
  const title = (epInfoTitle || cleanHtml($('h1.PostTitleWatch,h1.EntryTitle,h1.post-title,.Title,h1').first().text()))
    .replace(/^(مسلسل|فيلم)\s*/i, '').trim();

  const prevEp = norm($('.PrevEpi a,a[rel="prev"],.prev-ep a').first().attr('href') || '');
  const nextEp = norm($('.NextEpi a,a[rel="next"],.next-ep a').first().attr('href') || '');

  return { servers, iframes: servers.map(s => s.src), videoSources: [], title, prevEp, nextEp };
}

async function fallbackServerExtraction($, html, refUrl) {
  const seen    = new Set();
  const servers = [];

  $('li[data-watch],li[data-link],li[data-src]').each((_, el) => {
    let src = $(el).attr('data-watch') || $(el).attr('data-link') || $(el).attr('data-src') || '';
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
      const re = /["'](?:src|url|link|iframe|embed|file)["']\s*:\s*["'](https?:\/\/[^"']{15,})["']/gi;
      let m;
      while ((m = re.exec(txt)) !== null) {
        const src = m[1];
        if (src && !seen.has(src) && !src.includes('.css') && src.length < 400) {
          seen.add(src);
          const label = serverLabel(src, '', servers.length);
          servers.push({ label, color: serverColor(label), src });
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
    let src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (!src || src.length < 10 || seen.has(src)) return;
    if (src.startsWith('//')) src = 'https:' + src;
    if (!src.startsWith('http') || /google|facebook|analytics/.test(src)) return;
    seen.add(src);
    servers.push({ label: serverLabel(src, '', servers.length), color: serverColor(''), src, isEmbed: true });
  });

  const epInfoTitle = cleanHtml($('.ep-info h2,.ep-info h3').first().text());
  const title = (epInfoTitle || cleanHtml($('h1').first().text())).replace(/^(مسلسل|فيلم)\s*/i,'').trim();
  const prevEp = norm($('a[rel="prev"],.prev-ep a').first().attr('href') || '');
  const nextEp = norm($('a[rel="next"],.next-ep a').first().attr('href') || '');

  return { servers, iframes: servers.map(s => s.src), videoSources: [], title, prevEp, nextEp };
}

module.exports = { scrapeSeries, scrapeSeriesDetail, scrapeEpisodeWatch, scrapeSeriesFilters };
