// ─── ANIME SCRAPER ────────────────────────────────────────────────────────────
// Source: topcinemaa.com — anime category (same site/structure as movies & series)
// All heavy lifting (scraping, server AJAX, episode extraction) is shared with
// the series scraper; this file is just a thin adapter with the correct category URL.

const { scrapeSeries, scrapeSeriesDetail, scrapeEpisodeWatch } = require('./series');

const ANIME_CAT_URL = 'https://topcinemaa.com/category/%d9%85%d8%b3%d9%84%d8%b3%d9%84%d8%a7%d8%aa-%d8%a7%d9%86%d9%85%d9%8a/';

// ─── Listing ──────────────────────────────────────────────────────────────────
// Returns { anime, totalPages, currentPage }
// Anime.jsx uses data.anime — we map 'series' → 'anime' from the shared scraper.

async function scrapeAnime(page = 1, filters = {}) {
  const result = await scrapeSeries(page, filters, ANIME_CAT_URL);
  return {
    anime: result.series || [],
    totalPages: result.totalPages || 1,
    currentPage: result.currentPage || page,
  };
}

// ─── Detail page ─────────────────────────────────────────────────────────────
// Returns { title, poster, description, meta, genres, cast, imdb, seasons, sourceUrl }
// seasons: [{ title, seasonNum, poster, episodes: [{ title, href, epNum }] }]

async function scrapeAnimeDetail(url) {
  return scrapeSeriesDetail(url);
}

// ─── Episode watch page ───────────────────────────────────────────────────────
// Returns { servers, iframes, videoSources, title, prevEp, nextEp }

async function scrapeAnimeEpisodeWatch(url) {
  return scrapeEpisodeWatch(url);
}

module.exports = { scrapeAnime, scrapeAnimeDetail, scrapeAnimeEpisodeWatch };
