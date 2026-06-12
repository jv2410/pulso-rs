const GovBrScraper = require('./GovBrScraper');
const { getInstance } = require('./BrowserPool');

/**
 * AtendeNet scraper - extends GovBrScraper.
 *
 * AtendeNet sites are all Vue.js SPAs — go straight to Playwright (Decision D2).
 * Falls back to parent's HTML-based discovery only if Playwright is disabled
 * or rendering fails.
 */
class AtendeNetScraper extends GovBrScraper {
  constructor(config = {}) {
    super(config);
    // CRITICAL (Atlas 2026-06-11): the parent fetches articles with concurrency
    // 6, but AtendeNet routes every fetch through the SINGLE shared Playwright
    // Chromium. With ~10 cities running concurrently, 6× per city = ~60 parallel
    // renders → Chromium overload → mass hard_timeouts (observed 255). SPAs must
    // fetch serially (1 render at a time per city).
    this.articleConcurrency = config.ATENDENET_ARTICLE_CONCURRENCY || 1;
    // Pagination on a SPA means extra Playwright renders per page — keep it tight.
    this.maxListingPages = config.ATENDENET_MAX_LISTING_PAGES || 2;
  }

  /**
   * AtendeNet sites are Vue.js SPAs — both listing and article pages need
   * JavaScript rendering. We override fetchPage to route through the
   * Playwright BrowserPool. This way, the inherited _fetchArticle, title
   * extraction, content extraction, etc. all operate on rendered HTML.
   *
   * Falls back to parent's static fetchPage if Playwright is disabled (kill
   * switch) or if BrowserPool throws (e.g. PLAYWRIGHT_MAX_PER_RUN reached).
   */
  async fetchPage(url, options = {}) {
    const pool = getInstance();
    if (!pool.isEnabled()) {
      return super.fetchPage(url, options);
    }
    try {
      return await pool.fetchRendered(url);
    } catch (err) {
      // Cap reached or render failed — best-effort fall back so we don't crash
      // the whole scrape. The static fetch will likely return SPA shell HTML
      // which will fail later validation, but that's a clean failure mode.
      console.error(`[AtendeNet] Playwright fetchPage failed for ${url}: ${err.message}. Falling back to static.`);
      return super.fetchPage(url, options);
    }
  }

  /**
   * Override fetchPageWithUrl too (used by BaseScraper.discoverNewsPage for
   * redirect tracking). For SPA, finalUrl == url because Playwright already
   * navigated to the final URL.
   */
  async fetchPageWithUrl(url, options = {}) {
    const pool = getInstance();
    if (!pool.isEnabled()) {
      return super.fetchPageWithUrl(url, options);
    }
    try {
      const html = await pool.fetchRendered(url);
      return { html, finalUrl: url };
    } catch (err) {
      console.error(`[AtendeNet] Playwright fetchPageWithUrl failed for ${url}: ${err.message}. Falling back to static.`);
      return super.fetchPageWithUrl(url, options);
    }
  }

  /**
   * Override title extraction for AtendeNet (Vue SPA). (Atlas 2026-06-11)
   * The inherited CSS-selector approach picks up nav junk ("Portais"/"Notícias")
   * on these SPAs and rejects the article (e.g. Lagoa Vermelha → 0 artigos).
   * AtendeNet renders a correct <meta property="og:title"> per article — prefer
   * it, falling back to the parent extractor. Reject og:title that is just the
   * municipality name, the og:site_name, or a generic section label.
   */
  _extractTitle($, siteName) {
    const og = ($('meta[property="og:title"]').attr('content') || '').trim();
    if (og && og.length >= 5) {
      const lower = og.toLowerCase();
      const siteNameLower = (siteName || '').toLowerCase().trim();
      const ogSiteName = ($('meta[property="og:site_name"]').attr('content') || '').toLowerCase().trim();
      const isSiteName = (siteNameLower && lower === siteNameLower) || (ogSiteName && lower === ogSiteName);
      const isJunk = /^(not[íi]cias?|portais?|portal|p[áa]gina inicial|in[íi]cio|cidad[ãa]o)$/i.test(og);
      if (!isSiteName && !isJunk) return og;
    }
    return super._extractTitle($, siteName);
  }

  /**
   * AtendeNet sites are all Vue.js SPAs — go straight to Playwright.
   * Falls back to parent's HTML-based discovery only if Playwright is disabled.
   */
  /**
   * Override date extraction for AtendeNet.
   *
   * AtendeNet pages embed numeric file IDs in static-element paths like
   * "/static/portal/html/elementos/2026/05/03/2251_<hash>.html". The generic
   * DD/MM/YYYY regex used by the parent scraper would otherwise pick up
   * "05/03/2251" as a publication date (year 2251 — corrupted), which then
   * gets rejected as "suspicious" and falls back to LLM, which often returns
   * today's date from a page-template banner.
   *
   * Strategy (with mandatory year sanity [2000, 2030]):
   *   1. <meta property="article:published_time"> — authoritative on AtendeNet
   *   2. JSON-LD datePublished
   *   3. <time datetime="...">
   *   4. Generic regex on HTML *with the static-elements paths stripped*
   *   5. null (do NOT invent)
   */
  _extractDate($, html) {
    const isYearSane = (iso) => {
      if (!iso) return false;
      const m = String(iso).match(/(\d{4})/);
      if (!m) return false;
      const y = parseInt(m[1], 10);
      return y >= 2000 && y <= 2030;
    };

    // 1) <meta property="article:published_time">
    const metaSelectors = [
      'meta[property="article:published_time"]',
      'meta[property="og:article:published_time"]',
      'meta[itemprop="datePublished"]',
      'meta[name="pubdate"]',
      'meta[name="date"]',
    ];
    for (const sel of metaSelectors) {
      const v = ($(sel).attr('content') || '').trim();
      if (v && isYearSane(v)) return v;
    }

    // 2) JSON-LD
    if (html) {
      const ldRe = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let m;
      while ((m = ldRe.exec(html)) !== null) {
        try {
          const obj = JSON.parse(m[1]);
          const candidates = [obj?.datePublished];
          if (Array.isArray(obj?.['@graph'])) {
            for (const g of obj['@graph']) candidates.push(g?.datePublished);
          }
          for (const c of candidates) {
            if (c && isYearSane(c)) return c;
          }
        } catch { /* ignore malformed JSON-LD */ }
      }
    }

    // 3) <time datetime="...">
    const timeEl = $('time[datetime]').first();
    if (timeEl.length) {
      const v = (timeEl.attr('datetime') || '').trim();
      if (v && isYearSane(v)) return v;
    }

    // 4) Fall back to generic extraction, but on HTML with the
    // static-elements path (and any "/elementos/YYYY/MM/DD/<id>" pattern)
    // stripped so the DD/MM/YYYY regex can't confuse a numeric file ID
    // with a year. parseBrazilianDate also enforces [2000, 2030].
    if (html) {
      const cleanedHtml = html
        // /static/portal/html/elementos/YYYY/MM/DD/<id>_<hash>.html
        .replace(/\/static\/portal\/html\/elementos\/\d{4}\/\d{2}\/\d{2}\/\d+_[a-f0-9]+\.html/gi, '')
        // any other /elementos/YYYY/MM/DD/<digits> path
        .replace(/\/elementos\/\d{4}\/\d{2}\/\d{2}\/\d+/gi, '');
      const cleaned$ = this.loadHTML(cleanedHtml);
      const generic = super._extractDate(cleaned$, cleanedHtml);
      // Reject anything whose year falls outside [2000, 2030]
      if (generic && isYearSane(generic)) return generic;
    }

    // 5) Give up — caller will mark publishedAt = null and reject the article
    return null;
  }

  async discoverNewsPage(baseUrl, siteName = null) {
    const pool = getInstance();
    if (!pool.isEnabled()) {
      return super.discoverNewsPage(baseUrl, siteName);
    }

    // Resolve target URL: override (explicit) > AtendeNet conventional /cidadao/noticia
    let targetUrl;
    try {
      // Read overrides via the parent's helper if exposed; otherwise build path
      const fs = require('fs');
      const path = require('path');
      let overrides = {};
      try {
        overrides = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'news-url-overrides.json'), 'utf8'));
      } catch {}
      const ovEntry = siteName && overrides[siteName];
      const ovUrl = typeof ovEntry === 'string' ? ovEntry : (ovEntry && ovEntry.url) || null;
      if (ovUrl) {
        targetUrl = ovUrl;
      } else {
        // AtendeNet convention: <subdomain>.atende.net/cidadao/noticia
        const u = new URL(baseUrl);
        targetUrl = `${u.protocol}//${u.host}/cidadao/noticia`;
      }
    } catch {
      return super.discoverNewsPage(baseUrl, siteName);
    }

    try {
      const html = await pool.fetchRendered(targetUrl);
      const links = this.extractArticleLinks(html, baseUrl);
      if (links.length > 0) {
        return { url: targetUrl, html };
      }
      // Playwright returned empty/no-links — try static fetch (axios) as fallback.
      // Some AtendeNet sites serve usable HTML statically that Playwright misses.
      try {
        const staticHtml = await this.fetchPage(targetUrl);
        const staticLinks = this.extractArticleLinks(staticHtml, baseUrl);
        if (staticLinks.length > 0) return { url: targetUrl, html: staticHtml };
      } catch {}
      return { url: targetUrl, html };
    } catch (err) {
      console.error(`[AtendeNet] Playwright failed for ${baseUrl}: ${err.message}. Falling back to HTML.`);
      return super.discoverNewsPage(baseUrl, siteName);
    }
  }
}

module.exports = AtendeNetScraper;
