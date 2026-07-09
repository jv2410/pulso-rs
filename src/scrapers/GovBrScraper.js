const BaseScraper = require('./BaseScraper');
const { extractWithLLM, classifyAndSummarize, extractContentWithLLM } = require('../utils/llmDateExtractor');

/**
 * Title selectors in priority order.
 */
const TITLE_SELECTORS = [
  // Abase Sistemas CMS (Layout 2019) — ~150 municipal sites
  'h2.doctor-name',
  '.doctor-details h2',
  // Abase Sistemas CMS (Bossoroca-style layout)
  '.section-title h2',
  // Specific h1 classes — these are real article titles
  'h1.titulo-noticia',
  'h1.titulo-internas',  // Barra do Ribeiro
  'h1.titulo',
  'article h1',
  '.entry-title',
  '.noticia-titulo',
  '.page-title',
  '.post-title',
  'h2.titulo-noticia',
  // ".content h1" / ".container h1" / generic h1 — try BEFORE h2.titulo
  // because some sites put "Leia Mais" in <h2 class="titulo"> which would
  // otherwise be picked instead of the real <h1> article title.
  '.content h1',
  '.container h1',
  'h1',
  // Títulos escopados de CMS cittaweb (Atlas 2026-06-18) — tentados depois do
  // h1 genérico, antes do fallback. isJunkCandidate continua filtrando lixo.
  '#content h3',          // Coqueiros do Sul
  'div.texto > h4',       // Marques de Souza
  // Generic h2.titulo fallback last (Bom Retiro do Sul etc.)
  'h2.titulo',
];

/**
 * Date extraction strategies (tried in order).
 */
const DATE_META_SELECTORS = [
  { selector: 'meta[property="article:published_time"]', attr: 'content' },
  { selector: 'meta[property="og:article:published_time"]', attr: 'content' },
  { selector: 'meta[property="datePublished"]', attr: 'content' },
  { selector: 'meta[name="pubdate"]', attr: 'content' },
  { selector: 'meta[name="date"]', attr: 'content' },
  { selector: 'meta[name="DC.date.issued"]', attr: 'content' },
  { selector: 'meta[itemprop="datePublished"]', attr: 'content' },
  { selector: '[itemprop="datePublished"]', attr: 'content' },
  { selector: 'time[datetime]', attr: 'datetime' },
  { selector: 'time[pubdate]', attr: 'datetime' },
];

const DATE_TEXT_SELECTORS = [
  // Abase Sistemas CMS — "Publicado em: DD/MM/YYYY às HH:MM"
  '.doctor-edu li',
  '.cp-post-tools li',
  '.data-publicacao',
  '.data',
  '.date',
  '.post-date',
  '.info-data',
  '.noticia-data',
  '.news-date',
  'span.data',
  'p.data',
  '.published',
  '.entry-date',
  '.post-meta time',
  '.meta-date',
  '.noticia-info .data',
  '.noticia-detalhe .data',
  '.article-date',
  '.article-meta time',
  '.byline time',
  '.timestamp',
  '.dateline',
  '.post-info .date',
  '.info-publicacao',
  '.dados-noticia span',
  '.detalhe-data',
  '.materia-data',
  '.publicado-em',
  '.posted-on',
  '.field-name-post-date',
];

/**
 * Content selectors in priority order.
 */
const CONTENT_SELECTORS = [
  // Abase Sistemas CMS
  '.doctor-details',
  // Drupal/Porto Alegre new portal — node article wrapper holds title+body
  '.node--type-article',
  '.field--name-body',
  '.conteudo-noticia',
  '.noticia-conteudo',
  '.noticia-texto',
  '.entry-content',
  '.post-content',
  '.article-content',
  '.article-body',
  '.news-content',
  '.texto-noticia',
  '.corpo-noticia',
  '.materia-texto',
  '.conteudo',
  '.texto',
  '#conteudo',
  'article .content',
  'article',
  'main .content',
  'main',
];

/**
 * Minimum content length to accept from a CONTENT_SELECTOR before falling
 * through to the next one. Below this, the matched element is presumed to
 * be a wrapper for accessibility widgets / "Reduzir Fonte / Aumentar Fonte"
 * controls (Alvorada-style WordPress sites) rather than the real article body.
 */
const MIN_CONTENT_LEN = 200;

/**
 * Words/phrases that indicate a title is actually a site name or navigation.
 */
const TITLE_BLACKLIST = [
  'notícias',
  'noticias',
  'página inicial',
  'home',
  'início',
  'inicio',
  'leia mais',
  'ler mais',
  'ver mais',
  'saiba mais',
  'continuar lendo',
  'ir para o conteúdo',
  'ir para o conteudo',
  'pular para o conteúdo',
  'siga nossas redes sociais',
  'mapa do site',
  'fale conosco',
];

/**
 * Mojibake replacements (UTF-8 interpreted as Latin-1).
 */
const MOJIBAKE_MAP = [
  ['Ã£', 'ã'], ['Ã§', 'ç'], ['Ã©', 'é'], ['Ãº', 'ú'],
  ['Ã³', 'ó'], ['Ã¡', 'á'], ['Ãª', 'ê'], ['Ã\xad', 'í'],
  ['Ã¢', 'â'], ['Ã´', 'ô'], ['Ã‰', 'É'],
  ['Ã"', 'Ó'], ['Ãš', 'Ú'], ['Ã‡', 'Ç'],
  ['Ã¼', 'ü'], ['Ã±', 'ñ'],
];

/**
 * Patterns that indicate an accessibility/navigation title, not a real article.
 */
const JUNK_TITLE_PATTERNS = [
  /^ir para o conte[uú]do/i,
  /^pular para/i,
  /^skip to/i,
  /^not[ií]cias?$/i,
  /^home$/i,
  /^in[ií]cio$/i,
  /^edital\b/i,
  /^decreto\b/i,
  /^portaria\b/i,
  /^lei\s+n[º°]/i,
  /^ata\s+da\b/i,
  /^convoca[çc][ãa]o\b/i,
  /preg[ãa]o\s+(presencial|eletr[oô]nico)/i,
  /^preg[ãa]o\b/i,
  /licita[çc][ãa]o/i,
  /processo licitat[oó]rio/i,
  /dispensa\s+de\s+licita/i,
  /inexigibilidade/i,
  /^tomada\s+de\s+pre[çc]o/i,
  /^carta\s+convite/i,
  /chamamento\s+p[uú]blico/i,
  /aviso\s+de\s+licita/i,
  /processo seletivo/i,
  /siga nossas redes sociais/i,
];

/**
 * Content noise prefixes — if content starts with these, it's nav/menu garbage.
 */
const CONTENT_NOISE_PREFIXES = [
  /^menu principal/i,
  /^pular para/i,
  /^reduzir fonte/i,
  /^calend[aá]rio municipal/i,
  /^secretaria de administra[çc][ãa]o/i,
];

class GovBrScraper extends BaseScraper {
  constructor(config = {}) {
    super(config);
    this.lookbackDays = config.LOOKBACK_DAYS || 7;
    // Pagination (Atlas 2026-06-11): high-volume sites spill recent articles
    // onto pages 2+. Only paginate when page 1 looks high-volume to avoid
    // wasting fetches (and blowing timeouts) on low-volume cities.
    this.paginationMinLinks = config.PAGINATION_MIN_LINKS || 12;
    this.maxListingPages = config.MAX_LISTING_PAGES || 4;
    this.maxArticlesPerCity = config.MAX_ARTICLES_PER_CITY || 60;
    this.articleConcurrency = config.ARTICLE_CONCURRENCY || 6;
  }

  /**
   * Find the "next page" URL in a listing's HTML by following the site's own
   * pagination link. Tries rel=next, common pager classes, then anchor text
   * ("próxima"/"próximo"/»). Returns an absolute same-origin URL or null.
   */
  _findNextPageUrl(html, currentUrl, baseUrl) {
    try {
      const $ = this.loadHTML(html);
      let href = $('a[rel="next"]').first().attr('href')
        || $('link[rel="next"]').first().attr('href')
        || $('.pager__item--next a, li.pager__item--next a, .pager-next a, a.next, .next > a, a.page-link[rel="next"], .pagination-next a').first().attr('href');
      if (!href) {
        $('a').each((i, el) => {
          if (href) return;
          const t = ($(el).text() || '').trim().toLowerCase();
          const al = ($(el).attr('aria-label') || '').toLowerCase();
          if (/^(pr[óo]xim[ao]|next|»|›|>>)$/.test(t) || /^(pr[óo]xim|next)/.test(al)) {
            const h = $(el).attr('href');
            if (h && !/^#/.test(h) && !/javascript:/i.test(h)) href = h;
          }
        });
      }
      if (!href) return null;
      const abs = new URL(href, currentUrl).href;
      if (new URL(abs).origin !== new URL(currentUrl).origin) return null;
      if (abs.replace(/#.*$/, '') === currentUrl.replace(/#.*$/, '')) return null;
      return abs;
    } catch {
      return null;
    }
  }

  /**
   * Scrape a municipal government site - ONLY articles from today.
   */
  async scrape(site) {
    const articles = [];
    const errors = [];
    const baseUrl = this.ensureProtocol(site.site_url).replace(/\/+$/, '');

    // Step 1: Discover news listing page (with optional override by site name)
    const listing = await this.discoverNewsPage(baseUrl, site.name);
    if (!listing) {
      errors.push({
        type: 'listing_not_found',
        site: baseUrl,
        message: 'No news listing page found after trying all known paths'
      });
      return { articles, errors };
    }

    // If the listing URL is on a different host than the configured site_url,
    // use the listing's origin so relative links resolve to the live domain.
    let effectiveBaseUrl = baseUrl;
    try {
      const listingOrigin = new URL(listing.url).origin;
      const baseOrigin = new URL(baseUrl).origin;
      if (listingOrigin !== baseOrigin) effectiveBaseUrl = listingOrigin;
    } catch {}

    // Step 2: Extract article links from main listing
    let links = this.extractArticleLinks(listing.html, effectiveBaseUrl);

    // If site has hardcoded absolute links to a stale/dead domain (different
    // from where we found the listing), rewrite link hosts to the live origin.
    try {
      const listingHost = this._normalizeHost(new URL(listing.url).hostname);
      const baseHost = this._normalizeHost(new URL(baseUrl).hostname);
      if (listingHost !== baseHost) {
        links = links.map(u => {
          try {
            const lu = new URL(u);
            const liveOrigin = new URL(listing.url).origin;
            return liveOrigin + lu.pathname + lu.search + lu.hash;
          } catch { return u; }
        });
      }
    } catch {}

    // Step 2b: Also discover category/editorial sub-pages and extract their articles
    const categoryPages = this.discoverCategoryPages(listing.html, effectiveBaseUrl);
    for (const catUrl of categoryPages) {
      try {
        const catHtml = await this.fetchPage(catUrl);
        const catLinks = this.extractArticleLinks(catHtml, effectiveBaseUrl);
        // Add new links not already found
        for (const link of catLinks) {
          if (!links.includes(link)) links.push(link);
        }
      } catch {
        // Category page failed, continue
      }
    }

    if (links.length === 0) {
      errors.push({
        type: 'no_links',
        site: baseUrl,
        url: listing.url,
        message: 'Listing page found but no article links matched known patterns'
      });
      return { articles, errors };
    }

    // Step 2c: PAGINATION (Atlas 2026-06-11) — high-volume sites (POA, Caxias)
    // spill recent articles onto pages 2+; reading only page 1 loses 30-60% of
    // them permanently. We follow the site's own "next" link, bounded by:
    //  - GATE: only when page 1 yields >= paginationMinLinks (high-volume) so
    //    low-volume cities (most of the 442) never paginate → zero regression;
    //  - page cap (maxListingPages) and total-links cap (maxArticlesPerCity)
    //    to bound per-city cost and avoid blowing the sync HARD timeout;
    //  - stop early when a page adds no new links.
    // The lookback/date filter in _fetchArticle still gates final inclusion,
    // so old articles fetched from deeper pages are simply rejected.
    if (links.length >= this.paginationMinLinks) {
      const seen = new Set(links);
      const visitedPages = new Set([listing.url]);
      let curHtml = listing.html;
      let curUrl = listing.url;
      let pages = 0;
      while (pages < this.maxListingPages && links.length < this.maxArticlesPerCity) {
        const nextUrl = this._findNextPageUrl(curHtml, curUrl, effectiveBaseUrl);
        if (!nextUrl || visitedPages.has(nextUrl)) break;
        visitedPages.add(nextUrl);
        let nextHtml;
        try {
          nextHtml = await this.fetchPage(nextUrl);
        } catch {
          break;
        }
        const nextLinks = this.extractArticleLinks(nextHtml, effectiveBaseUrl);
        let added = 0;
        for (const l of nextLinks) {
          if (!seen.has(l)) { seen.add(l); links.push(l); added++; }
          if (links.length >= this.maxArticlesPerCity) break;
        }
        if (added === 0) break;
        curHtml = nextHtml;
        curUrl = nextUrl;
        pages++;
      }
    }

    // Hard cap on total links to fetch (Atlas 2026-06-11). Category pages
    // (Step 2b) can push the link count well past maxArticlesPerCity (e.g.
    // ERECHIM accumulated ~160 links → 160 serial-ish fetches → blew the 120s
    // sync timeout → captured 0). Links are in listing order (newest first),
    // so truncating keeps the most recent — exactly what the D-1/lookback
    // window needs — while bounding per-city cost.
    if (links.length > this.maxArticlesPerCity) {
      links = links.slice(0, this.maxArticlesPerCity);
    }

    // Step 3: Try to extract dates from the listing page first
    const today = this._getTodayString();
    const listingDates = this._extractListingDates(listing.html, links, baseUrl);

    // Step 4: Fetch articles with BOUNDED CONCURRENCY (Atlas 2026-06-11).
    // Previously serial — with pagination surfacing 50-90 links, serial fetch
    // blew the per-city HARD timeout (POA/Tabaí timed out → captured 0). A
    // small concurrency pool keeps total time well under the 120s budget.
    // We do NOT skip based on listingDate alone (it's often the wrong date);
    // _fetchArticle owns the final date decision and lookback filter.
    const ARTICLE_CONCURRENCY = this.articleConcurrency || 6;
    let qIdx = 0;
    const worker = async () => {
      while (qIdx < links.length) {
        const articleUrl = links[qIdx++];
        try {
          const listingDate = listingDates.get(articleUrl);
          const article = await this._fetchArticle(articleUrl, site, baseUrl, listingDate);
          // Strict policy: only accept a confirmed per-page/per-URL date within
          // the lookback window. Dateless articles are REJECTED (they polluted
          // the feed with year-old content stamped as "today").
          if (article && article.publishedAt && this._isToday(article.publishedAt)) {
            articles.push(article);
          }
        } catch (err) {
          errors.push({ type: 'article_fetch', url: articleUrl, message: err.message });
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(ARTICLE_CONCURRENCY, links.length) }, () => worker())
    );

    return { articles, errors };
  }

  /**
   * Get today's date string in YYYY-MM-DD format.
   */
  _getTodayString() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Check if a date is within the lookback window (today + last 3 days).
   * This ensures weekend articles are captured on Monday scrapes.
   */
  _isToday(dateStr) {
    if (!dateStr) return false;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      const articleDate = d.toISOString().split('T')[0];
      const today = this._getTodayString();

      // Accept if it's exactly the target date
      if (articleDate === today) return true;

      // Also accept articles within the lookback window (catches weekends)
      const cutoff = new Date(today + 'T00:00:00Z');
      cutoff.setDate(cutoff.getDate() - this.lookbackDays);
      return d >= cutoff;
    } catch {
      return false;
    }
  }

  /**
   * Check if a date is in the future (after today's end-of-day).
   * Stricter than _isDateSuspicious — used to reject listing-date fallbacks
   * that would mark articles with tomorrow's date.
   */
  _isFutureDate(dateStr) {
    if (!dateStr) return false;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      const today = this._getTodayString();
      const endOfToday = new Date(today + 'T23:59:59Z');
      return d > endOfToday;
    } catch {
      return false;
    }
  }

  /**
   * Try to parse a date embedded in the article URL.
   * Recognizes /YYYY-MM-DD/, /DD-MM-YYYY/, /YYYY/MM/DD/ patterns.
   * Returns ISO string or null.
   */
  _extractDateFromUrl(url) {
    if (!url) return null;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    const accept = (iso) => {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      if (d > tomorrow) return null; // reject future dates (event deadlines in slug)
      return d.toISOString();
    };
    // YYYY-MM-DD or YYYY/MM/DD
    let m = url.match(/[/_-](20\d{2})[-/](\d{2})[-/](\d{2})(?=[/_.-]|$)/);
    if (m) {
      const r = accept(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
      if (r) return r;
    }
    // DD-MM-YYYY
    m = url.match(/[/_-](\d{2})-(\d{2})-(20\d{2})(?=[/_.-]|$)/);
    if (m) {
      const r = accept(`${m[3]}-${m[2]}-${m[1]}T12:00:00Z`);
      if (r) return r;
    }
    return null;
  }

  /**
   * Check if a parsed date is implausible (future or too old).
   * Used to detect wrong dates extracted from body text (event dates, deadlines).
   */
  _isDateSuspicious(dateStr) {
    if (!dateStr) return false;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return true;
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      // Reject future dates beyond tomorrow
      if (d > tomorrow) return true;
      // Reject dates older than 60 days (outside lookback window)
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 60);
      if (d < cutoff) return true;
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Try to extract dates from the listing page HTML, associated with article links.
   * Many sites show "13/03/2026" or "13 mar 2026" near each article link.
   * Returns a Map<articleUrl, parsedDateISO>
   */
  _extractListingDates(html, articleLinks, baseUrl) {
    const $ = this.loadHTML(html);
    const dateMap = new Map();

    // For each link in the page, look for a date in nearby elements
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const abs = this.buildAbsoluteUrl(href, baseUrl);
      if (!articleLinks.includes(abs)) return;

      // Look for date in: parent, siblings, nearby spans
      const parent = $(el).parent();
      const grandparent = parent.parent();

      // Check text of parent/grandparent for date patterns
      for (const container of [parent, grandparent]) {
        const text = container.text();
        if (!text) continue;

        // DD/MM/YYYY
        const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (slashMatch) {
          const parsed = this.parseBrazilianDate(slashMatch[0]);
          if (parsed) {
            dateMap.set(abs, parsed);
            return;
          }
        }

        // DD mon YYYY (short month)
        const shortMonths = {
          'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04',
          'mai': '05', 'jun': '06', 'jul': '07', 'ago': '08',
          'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
        };
        const shortMatch = text.match(/(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(\d{4})/i);
        if (shortMatch) {
          const [, day, mon, year] = shortMatch;
          const month = shortMonths[mon.toLowerCase()];
          if (month) {
            const iso = `${year}-${month}-${day.padStart(2, '0')}T12:00:00.000Z`;
            dateMap.set(abs, iso);
            return;
          }
        }

        // "DD de mês de YYYY"
        const longMatch = text.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
        if (longMatch) {
          const parsed = this.parseBrazilianDate(longMatch[0]);
          if (parsed) {
            dateMap.set(abs, parsed);
            return;
          }
        }
      }
    });

    // Also check for dates in WordPress URL patterns /{yyyy}/{mm}/{dd}/
    for (const url of articleLinks) {
      if (dateMap.has(url)) continue;
      const wpMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
      if (wpMatch) {
        const [, year, month, day] = wpMatch;
        dateMap.set(url, `${year}-${month}-${day}T12:00:00.000Z`);
      }
    }

    return dateMap;
  }

  /**
   * Fix mojibake encoding and validate title + content.
   * Returns { valid, cleanTitle, cleanContent } or { valid: false } for junk.
   */
  _validateArticle(title, content) {
    let cleanTitle = title || '';
    let cleanContent = content || null;

    // --- Fix mojibake encoding ---
    for (const [bad, good] of MOJIBAKE_MAP) {
      cleanTitle = cleanTitle.split(bad).join(good);
      if (cleanContent) {
        cleanContent = cleanContent.split(bad).join(good);
      }
    }

    // --- Title cleaning (after mojibake fix, before validation) ---
    // Strip concatenated breadcrumb prefixes from broken sites
    cleanTitle = cleanTitle.replace(/^InícioInformativosNotícias\s*/, '');
    cleanTitle = cleanTitle.replace(/^Início\s+Informativos\s+Notícias\s+/, '');
    // Strip leading "Notícia - " or "Notícias - " prefix
    cleanTitle = cleanTitle.replace(/^Not[ií]cias?\s*-\s*/, '');
    // Strip trailing " - RS" when preceded by a city name pattern
    cleanTitle = cleanTitle.replace(/\s+-\s*RS\s*$/, '').trim();

    // --- Title validation ---
    // Reject if title still has replacement-character after encoding fix
    if (cleanTitle.includes('\uFFFD')) {
      return { valid: false, cleanTitle, cleanContent };
    }

    // Too short (after cleaning)
    if (cleanTitle.length < 20) {
      return { valid: false, cleanTitle, cleanContent };
    }

    // Matches accessibility / navigation text
    if (JUNK_TITLE_PATTERNS.some(re => re.test(cleanTitle.trim()))) {
      return { valid: false, cleanTitle, cleanContent };
    }

    // Generic site-name title: "Prefeitura (Municipal) de <City> (- RS)"
    if (/^Prefeitura\s+(Municipal\s+)?de\s+.+\s*-\s*RS$/i.test(cleanTitle.trim())) {
      return { valid: false, cleanTitle, cleanContent };
    }
    // Generic "Município de <City> (- RS)"
    if (/^Município de\s+.{3,}\s*-?\s*RS$/i.test(cleanTitle.trim())) {
      return { valid: false, cleanTitle, cleanContent };
    }
    // Bare "Prefeitura de <City>" (without "Municipal")
    if (/^Prefeitura de\s+\S+(\s+\S+){0,3}$/i.test(cleanTitle.trim())) {
      return { valid: false, cleanTitle, cleanContent };
    }
    // "Prefeitura de <City> - RS" variant
    if (/^Prefeitura de\s+.+\s*-\s*RS$/i.test(cleanTitle.trim())) {
      return { valid: false, cleanTitle, cleanContent };
    }
    // Original prefeitura check for bare city names without " - RS"
    const prefeituraMatch = cleanTitle.match(/^Prefeitura\s+Municipal\s+de\s+(.+)$/i);
    if (prefeituraMatch) {
      const rest = prefeituraMatch[1].trim();
      if (!/[-–|:]/.test(rest) && rest.split(/\s+/).length <= 3) {
        return { valid: false, cleanTitle, cleanContent };
      }
    }

    // --- Content validation ---
    if (cleanContent) {
      const isContentNoise = CONTENT_NOISE_PREFIXES.some(re => re.test(cleanContent.trim()));
      if (isContentNoise) {
        cleanContent = null; // discard garbage, keep article with null content
      }
    }

    return { valid: true, cleanTitle, cleanContent };
  }

  /**
   * Fetch a single article page and extract title, date, content.
   */
  async _fetchArticle(url, site, baseUrl, listingDate = null) {
    const html = await this.fetchPage(url);
    const $ = this.loadHTML(html);

    const title = this._extractTitle($, site.name);
    if (!title) return null;

    const imageUrl = this._extractImage($, url);

    const dateRaw = this._extractDate($, html);
    let publishedAt = this.parseBrazilianDate(dateRaw);
    let publishedAtFromUrl = false;

    // WORDPRESS DATE-PERMALINK PRIORITY (Atlas 2026-06-09):
    // URLs shaped /YYYY/MM/DD/slug encode an UNAMBIGUOUS publication date set
    // by the CMS at publish time. Some WP themes render the visible "Publicado
    // em" stamp in MM/DD/YYYY (American) format — e.g. June 9 shown as
    // "06/09/2026" — which parseBrazilianDate misreads as DD/MM (→ 6 September).
    // When the URL carries an explicit /YYYY/MM/DD/ date, trust it over any
    // body-text date. Only affects date-permalink sites (Arroio do Sal etc.);
    // ID/slug-based sites (incl. all banner-bug cities) return null here and
    // are left completely untouched.
    const urlPermalinkDate = this._extractDateFromUrl(url);
    if (urlPermalinkDate && !this._isFutureDate(urlPermalinkDate)) {
      const urlDay = urlPermalinkDate.slice(0, 10);
      if (!publishedAt || publishedAt.slice(0, 10) !== urlDay) {
        publishedAt = urlPermalinkDate;
        publishedAtFromUrl = true;
      }
    }

    // BANNER-BUG GUARD (Atlas 2026-05-04):
    // If the only date we found equals "today" AND the page contains the
    // "<City>, <weekday>, DD de mês de YYYY" header banner with that exact
    // date AND there is NO article-anchored date keyword (Publicado/Postado/
    // Data de publicação) anywhere in the HTML, we cannot trust the extracted
    // date — it almost certainly came from the page header banner that
    // every page on the site renders for "today". Discard the date and let
    // the LLM/listing-date paths attempt recovery.
    if (publishedAt && html && !publishedAtFromUrl) {
      const today = this._getTodayString ? this._getTodayString() : new Date().toISOString().slice(0, 10);
      const isToday = publishedAt.slice(0, 10) === today;
      if (isToday) {
        const hasArticleAnchor = /(?:Data\s+de\s+publica(?:[cç]|&ccedil;)(?:[aã]|&atilde;)o|Publicad[oa]\s+em|Postad[oa]\s+em|article:published_time|datePublished)/i.test(html);
        const hasCityBanner = /[A-ZÀ-Ú][a-zà-úA-ZÀ-Ú\s'-]+,\s+(?:[a-zçé-]+-feira,\s+)?\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/i.test(html);
        if (!hasArticleAnchor && hasCityBanner) {
          publishedAt = null; // banner-bug suspected — refuse to mark as today
        }
      }
    }

    // Strong fallback: many municipal sites encode the publication date
    // directly in the article URL (e.g. /noticia/1810/10-03-2026/...).
    // Trust that over the listingDate when meta-tag extraction fails.
    if (!publishedAt) {
      const urlDate = this._extractDateFromUrl(url);
      if (urlDate && !this._isDateSuspicious(urlDate) && !this._isFutureDate(urlDate)) {
        publishedAt = urlDate;
        publishedAtFromUrl = true;
      }
    }

    // Layer 2.5: If meta tag gave a VERY old date (> 1 year), the article is genuinely old
    // Don't override with LLM — just discard the article entirely
    if (publishedAt) {
      const articleDate = new Date(publishedAt);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      if (articleDate < oneYearAgo) {
        return null; // Article is genuinely old, skip it
      }
    }

    // Layer 3: reject suspicious dates (future/too-old) and let LLM try
    if (publishedAt && this._isDateSuspicious(publishedAt)) {
      publishedAt = null;
    }

    // Layer 4a: listingDate is UNRELIABLE for date attribution.
    // It often reflects the listing page's "last updated" stamp (which is
    // today) rather than each article's real publication date. We never
    // overwrite a per-page extracted publishedAt with a listingDate.
    // listingDate is now used ONLY as a final tie-breaker when nothing else
    // worked AND it's within a tight window (Layer 4c below).
    const trustedListingDate = (listingDate && !this._isDateSuspicious(listingDate) && !this._isFutureDate(listingDate)) ? listingDate : null;

    // Layer 4b: REMOVED — never seed publishedAt from listingDate alone.
    // Listing dates are typically page-level "last update" stamps, not
    // article-specific publication dates, and were misleading articles
    // with today's date when articles were actually months/years old.

    const cleanTitle = this.cleanText(title);

    // Extract content — try CSS selectors first, then LLM fallback
    let rawContent = this._extractContent($);
    let cleanContent = rawContent || null;

    // Detect if content is noise (menus, navigation, etc)
    const isNoise = cleanContent && (
      cleanContent.length < 200 ||
      /^(menu principal|calendário municipal|secretaria de|pular para)/im.test(cleanContent) ||
      (cleanContent.split('\n\n').filter(p => p.length > 50).length < 2)
    );

    // If content is missing, too short, or noise — use LLM to extract clean text
    if ((!cleanContent || isNoise) && process.env.SKIP_LLM !== 'true') {
      const pageText = $('body').text().replace(/\s+/g, ' ').trim();
      const llmContent = await extractContentWithLLM(cleanTitle, pageText);
      if (llmContent) {
        cleanContent = llmContent;
      }
    }

    // Sites where the LLM is known to extract the page-template "today"
    // banner instead of the article date — disable LLM date for these.
    const DATE_LLM_BLACKLIST = new Set([
      'COQUEIRO BAIXO', 'LAVRAS DO SUL', 'PROGRESSO', 'NOVA ALVORADA', 'IBARAMA',
      'AUGUSTO PESTANA', 'BALNEÁRIO PINHAL', 'BARRA DO QUARAÍ', 'MAMPITUBA',
      'PUTINGA', 'DOUTOR RICARDO', 'HULHA NEGRA', 'DOM PEDRO DE ALCÂNTARA',
      'QUEVEDOS', 'BOA VISTA DO CADEADO',
    ]);
    const skipLlmForThisSite = site && site.name && DATE_LLM_BLACKLIST.has(site.name);

    // If regex/URL failed to find a date, ALWAYS try LLM — date is critical
    // (without it the article is rejected). Only the heavier categorize/
    // summarize calls respect SKIP_LLM. Honor SKIP_LLM_DATE override if set.
    // Skip LLM entirely for blacklisted sites (chronic mis-attribution).
    if (!publishedAt && process.env.SKIP_LLM_DATE !== 'true' && !skipLlmForThisSite) {
      const pageText = $('body').text().replace(/\s+/g, ' ').trim();
      const llmResult = await extractWithLLM(cleanTitle, pageText, url);

      // LLM says it's not a news article → reject
      if (!llmResult.isNews) return null;

      // LLM found a date when regex didn't — reject if suspicious
      if (llmResult.date && !this._isDateSuspicious(llmResult.date)) {
        publishedAt = llmResult.date;
      }
    }

    // Layer 4c: REMOVED — listingDate is no longer used as a fallback
    // source for publishedAt. Articles without a per-page or per-URL
    // detected date will keep publishedAt = null and be rejected by
    // the lookback filter rather than being mis-dated as "today".

    // Validate and fix encoding before persisting
    const validation = this._validateArticle(cleanTitle, cleanContent);
    if (!validation.valid) return null;

    const validatedTitle = validation.cleanTitle;
    const validatedContent = validation.cleanContent;

    // Classify, summarize, and rate with LLM (single call).
    // Can be disabled via SKIP_LLM=true to speed up bulk runs (categorize later).
    let summary = null, category = null, relevanceScore = null;
    if (process.env.SKIP_LLM !== 'true') {
      ({ summary, category, relevanceScore } = await classifyAndSummarize(validatedTitle, validatedContent));
    }

    return {
      title: validatedTitle,
      url: this.ensureProtocol(url),
      publishedAt,
      summary,
      category,
      relevanceScore,
      content: validatedContent,
      imageUrl: imageUrl || null,
      municipalityId: site.id || null,
      scrapedAt: new Date().toISOString()
    };
  }

  /**
   * Extract the main image URL from an article page.
   * Tries og:image, twitter:image, article content area, then heuristic patterns.
   * Skips tiny/tracking images, logos, icons, and SVGs.
   */
  _extractImage($, url) {
    const SKIP_SRC_PATTERNS = [
      /^data:image/i,
      /\.svg(\?|$)/i,
      /\.gif(\?|$)/i,
      /logo/i,
      /icon/i,
      /favicon/i,
      /banner/i,
      /pixel/i,
      /1x1/i,
      /spacer/i,
      /transparent/i,
      /tracking/i,
    ];

    const isValidImageSrc = (src) => {
      if (!src || src.length < 5) return false;
      return !SKIP_SRC_PATTERNS.some((re) => re.test(src));
    };

    const baseUrl = url.replace(/\/[^/]*$/, '');

    const resolve = (src) => {
      if (!src) return null;
      const abs = this.buildAbsoluteUrl(src.trim(), baseUrl);
      return abs && isValidImageSrc(abs) ? abs : null;
    };

    // Strategy 1: og:image meta tag
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      const resolved = resolve(ogImage);
      if (resolved) return resolved;
    }

    // Strategy 2: twitter:image meta tag
    const twImage = $('meta[name="twitter:image"]').attr('content');
    if (twImage) {
      const resolved = resolve(twImage);
      if (resolved) return resolved;
    }

    // Strategy 3: First <img> inside article content area
    for (const selector of CONTENT_SELECTORS) {
      const container = $(selector).first();
      if (!container.length) continue;
      const img = container.find('img').first();
      if (img.length) {
        const src = img.attr('src');
        const resolved = resolve(src);
        if (resolved) return resolved;
      }
      break; // only check the first matching content container
    }

    // Strategy 4: First <img> with src containing common media path patterns
    const MEDIA_PATTERNS = /upload|wp-content|media|imagem|foto/i;
    let fallbackImg = null;
    $('img').each((_, el) => {
      if (fallbackImg) return false; // break
      const src = $(el).attr('src') || '';
      if (MEDIA_PATTERNS.test(src)) {
        const resolved = resolve(src);
        if (resolved) {
          fallbackImg = resolved;
          return false; // break
        }
      }
    });

    return fallbackImg;
  }

  /**
   * Extract article title using multiple selectors.
   * For each selector, the candidate text is rejected if it matches a blacklist
   * entry, the site name, or a JUNK_TITLE_PATTERN — and we move on to the next
   * selector instead of returning the noise text.
   */
  _extractTitle($, siteName) {
    const isJunkCandidate = (text) => {
      const trimmed = (text || '').trim();
      if (!trimmed) return true;
      const lower = trimmed.toLowerCase();
      if (TITLE_BLACKLIST.some(bl => lower === bl)) return true;
      if (siteName && lower === siteName.toLowerCase().trim()) return true;
      if (JUNK_TITLE_PATTERNS.some(re => re.test(trimmed))) return true;
      // Too short to be a real title
      if (trimmed.length < 5) return true;
      return false;
    };

    for (const selector of TITLE_SELECTORS) {
      // Try every match for the selector — some pages have multiple h1s where
      // the first is junk ("Notícias") and the second is the real title.
      const elements = $(selector);
      let chosen = null;
      elements.each((_, el) => {
        if (chosen) return;
        const text = $(el).text().trim();
        if (!isJunkCandidate(text)) chosen = text;
      });
      if (chosen) return chosen;
    }

    // og:title / twitter:title (Atlas 2026-07-09): em templates tipo /noticia/view/
    // (Erechim, Araricá etc.) o <title> é genérico ("Cidade/RS") e os seletores
    // não pegam o h2 do artigo — mas o título REAL está no og:title. Tentado antes
    // do fallback <title>, filtrado por isJunkCandidate (rejeita nome da cidade).
    if ($) {
      for (const sel of ['meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[name="title"]']) {
        const c = ($(sel).attr('content') || '').trim();
        if (c && !isJunkCandidate(c)) return c;
      }
    }

    // Last resort: <title> tag
    const titleTag = $('title').first().text().trim();
    if (titleTag) {
      const cleaned = titleTag.replace(/\s*[-|–]\s*.{0,50}$/, '').trim();
      const lower = cleaned.toLowerCase();
      const isBlacklisted = TITLE_BLACKLIST.some(bl => lower === bl);
      const isSiteName = siteName && lower === siteName.toLowerCase().trim();
      if (!isBlacklisted && !isSiteName && cleaned.length > 5) {
        return cleaned;
      }
    }

    return null;
  }

  /**
   * Extract article date using meta tags, time elements, CSS selectors,
   * and finally regex scanning the page text.
   */
  _extractDate($, html) {
    // Strategy 0: Anchored "Data de publicação:" / "Publicado em" patterns in raw HTML.
    // These take priority over meta tags and CSS selectors because some sites have
    // a banner like "Cidade, DD de Mês de YYYY" in the header that gets picked up
    // by selectors but is actually the page-render date, not the article date.
    if (html) {
      // Pattern A: <strong>Data de publicação:</strong> DD/MM/YYYY (handles HTML entities)
      let m = html.match(/Data de publica(?:[cç]|&ccedil;)(?:[aã]|&atilde;)o:?\s*<\/strong>\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (m) return m[1];
      m = html.match(/Data de publica(?:[cç]|&ccedil;)(?:[aã]|&atilde;)o:?[^0-9<]{0,30}(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (m) return m[1];
      // Pattern B: "Publicado em DD/MM/YYYY" / "Publicada em" / "Postado em" anchors
      m = html.match(/Publicad[oa]\s+em:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (m) return m[1];
      m = html.match(/Postad[oa]\s+em:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (m) return m[1];
      // Pattern C: <h2><span>...DD de Mês de YYYY...</span></h2> (Jaguari, Coronel Barros style)
      m = html.match(/<h2[^>]*>\s*<span[^>]*>[\s\S]{0,200}?(\d{1,2})\s+de\s+([A-Za-zçÇ]+)\s+de\s+(\d{4})[\s\S]{0,50}?<\/span>/i);
      if (m) return `${m[1]} de ${m[2]} de ${m[3]}`;
      // Pattern D: Drupal grupo-datas block (Novo Hamburgo)
      m = html.match(/grupo-datas[^>]*>\s*Publicado em\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (m) return m[1];
    }

    // Strategy 1: Meta tags and time elements
    for (const { selector, attr } of DATE_META_SELECTORS) {
      const el = $(selector).first();
      if (el.length) {
        const val = (el.attr(attr) || '').trim();
        // Skip pure numeric values (Unix timestamps) and empty strings
        if (val && !/^\d+$/.test(val)) return val;
      }
    }

    // Strategy 2: Date-specific CSS selectors
    for (const selector of DATE_TEXT_SELECTORS) {
      const el = $(selector).first();
      if (el.length) {
        const text = el.text().trim();
        if (!text) continue;
        // Normalize whitespace (templates often split "DD de\n  mes de\n  YYYY")
        const norm = text.replace(/\s+/g, ' ').trim();
        // Reject site-banner pattern: "<City Name>, DD de mes de YYYY"
        if (/^[A-ZÀ-Ú][a-zà-úA-ZÀ-Ú\s'-]+,\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/.test(norm)) continue;
        // Reject bare "DD de mes de YYYY" with no anchor/time/slash — this is
        // the page-template "today" banner on sites like Nova Alvorada/Ibarama.
        // Real article date selectors typically include "Publicado em", time,
        // or DD/MM/YYYY format.
        if (/^\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\.?$/i.test(norm)) continue;
        // Prefer slash format
        if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(norm)) return norm;
        // Accept text with year if it has anchor words or time
        if (/\d{4}/.test(norm) && /(publicad|postad|criad|atualizad|às|as\s+\d|\d+\s*h\d|\d{1,2}:\d{2})/i.test(norm)) return norm;
      }
    }

    // Strategy 3: Look for JSON-LD structured data
    if (html) {
      const jsonLdMatch = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (jsonLdMatch) {
        try {
          const jsonLd = JSON.parse(jsonLdMatch[1]);
          const datePublished = jsonLd.datePublished || (jsonLd['@graph'] && jsonLd['@graph'].find(i => i.datePublished)?.datePublished);
          if (datePublished) return datePublished;
        } catch {
          // Invalid JSON-LD, continue
        }
      }
    }

    // Strategy 4: Scan article content area for date patterns
    // First try within article/content containers, then fall back to full page
    if (html) {
      let plainText = '';
      const contentArea = $('article, .conteudo-noticia, .noticia-conteudo, .entry-content, .conteudo, .content, main, #conteudo').first();
      if (contentArea.length) {
        plainText = contentArea.text().substring(0, 8000);
      } else {
        plainText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<[^>]*>/g, ' ')
          .substring(0, 8000);
      }

      // Anchored phrases take priority over generic date matches
      const ANCHORED_PATTERNS = [
        /publicad[oa]\s+em[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
        /data\s+de\s+publica[çc][ãa]o[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
        /publica[çc][ãa]o[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
        /postad[oa]\s+em[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
        /criad[oa]\s+em[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
        /\bem\s+(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:às|as)\s+\d{1,2}[h:]/i,
        /publicad[oa]\s+em\s+(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i,
      ];
      for (const pat of ANCHORED_PATTERNS) {
        const m = plainText.match(pat);
        if (m) return m[1];
      }

      // Reject site-banner "header" date pattern: "<City Name>, DD de mes de YYYY"
      // — this is the page-template "today" stamp, not the article publication date.
      // We strip these matches from plainText before further regex extraction.
      const headerBanner = plainText.match(/[A-ZÀ-Ú][a-zà-ú\s'-]+,\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\.?/);
      let cleanText = plainText;
      if (headerBanner) cleanText = plainText.split(headerBanner[0]).join(' ');

      // Try DD/MM/YYYY first
      const slashMatch = cleanText.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
      if (slashMatch) return slashMatch[0];

      // Try "DD de mês de YYYY"
      const longMatch = cleanText.match(/\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/i);
      if (longMatch) return longMatch[0];

      // Try "DD mon YYYY" (short month)
      const shortMatch = plainText.match(/\d{1,2}\s+(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+\d{4}/i);
      if (shortMatch) return shortMatch[0];

      // Try "Publicado em DD/MM/YYYY" or "Publicado: DD/MM/YYYY"
      const pubMatch = plainText.match(/(?:publicado|postado|criado|atualizado)\s*(?:em|:)\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (pubMatch) return pubMatch[1];
    }

    return null;
  }

  /**
   * Extract article content with paragraph formatting preserved.
   * Converts HTML block elements into double-newline separated paragraphs.
   */
  _extractContent($) {
    // Block-level tags that should create paragraph breaks
    const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'tr', 'figcaption', 'section']);

    function htmlToText(el) {
      // Remove unwanted elements
      el.find('script, style, nav, header, footer, aside, .share, .social, .tags, .related, .breadcrumb, .menu, .sidebar, .pagination, .nav, .comentarios, .comments, form, iframe').remove();

      const paragraphs = [];
      let currentParagraph = '';

      // Get the inner HTML and process it
      const html = el.html();
      if (!html) return '';

      // Replace <br> with newline markers
      const processed = html
        .replace(/<br\s*\/?>/gi, '\n')
        // Add paragraph markers before block elements
        .replace(/<(p|div|h[1-6]|li|blockquote|tr|figcaption|section)[^>]*>/gi, '\n\n<<BLOCK>>\n')
        // Add paragraph markers after closing block elements
        .replace(/<\/(p|div|h[1-6]|li|blockquote|tr|figcaption|section)>/gi, '\n\n')
        // Remove all remaining HTML tags
        .replace(/<[^>]*>/g, '')
        // Decode common HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–');

      // Split by double newlines and clean each paragraph
      const rawParagraphs = processed.split(/\n{2,}/);
      for (const p of rawParagraphs) {
        const cleaned = p
          .replace(/<<BLOCK>>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleaned && cleaned.length > 2) {
          paragraphs.push(cleaned);
        }
      }

      // Filter out navigation breadcrumbs, social buttons, and short noise
      const NOISE_PATTERNS = [
        /^(início|home|notícias?|noticias?|voltar|anterior|próximo|compartilhar|tweetar|curtir|enviar|imprimir|whatsapp|facebook|twitter|instagram|linkedin|pinterest)$/i,
        /^(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|\d{4})$/i,
        /^(menu|buscar|pesquisar|acessibilidade|aumentar|diminuir|fonte|alto contraste|libras|atalhos|pular para|ir para|user-lock|conteúdo|busca|rodapé)$/i,
        /^(menu principal|o município|sobre |símbolos|turismo em|calendário|secretaria|departamento|contato|fale conosco|ouvidoria|transparência|licitaç|diário oficial)$/i,
        /^(reduzir fonte|aumentar fonte|alto contraste|font-size|copyright|todos os direitos|desenvolvido por|powered by)$/i,
        /^atualizada?\s+dia/i,
        /^compartilhe/i,
        /^publicado\s+em/i,
        /^tags?:/i,
        /^(leia mais|leia também|veja também|saiba mais|notícias relacionadas|últimas notícias)$/i,
        /^https?:\/\//i,
        /^www\./i,
        /^#\w/,
        /^\d{1,2}\/\d{1,2}\/\d{4}$/,
        /^\d{1,2}\s+de\s+\w+\s+de\s+\d{4}$/i,
        // Social/share buttons that merge into text
        /compartilhar\s*enviar/i,
        /compartilhar\s*imprimir/i,
        // Sidebar content
        /^acesso r[aá]pido$/i,
        /^mais secretarias$/i,
        /^mais atra[çc][oõ]es$/i,
        // Print/email buttons
        /^visualizar impress[ãa]o$/i,
        /^imprimir\s+fechar$/i,
        /^enviar e-?mail$/i,
        // Metadata lines
        /^data de publica[çc][ãa]o:/i,
        /^fonte:/i,
        // Font size controls
        /^A\+\s*A-/,
        // Date lines with "Publicado" or "às"
        /^\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\s*[-–]\s*(publicado|às)/i,
        // Social media follow
        /^siga nossas redes sociais/i,
        // Accessibility markers
        /^in[ií]cio conte[uú]do$/i,
        // Secretaria names as standalone paragraphs
        /^sec\.\s+de\s/i,
        /^secretaria\s+(municipal\s+)?de\s/i,
        /^SECRETARIAS$/,
        /^TURISMO$/,
        /^EDUCAÇÃO$/,
        /^SAÚDE$/,
        // Navigation remnants
        /^mais\s/i,
        /^ver\s+todos?$/i,
        /^ver\s+mais$/i,
        // Photo credits as standalone paragraph
        /^foto\s*:/i,
        /^cr[eé]dito\s*:/i,
        /^imagem\s*:/i,
        /^divulga[çc][ãa]o\s*$/i,
        // Footer content
        /^hor[aá]rio de atendimento/i,
        /^endere[çc]o\s*:/i,
        /^telefone\s*:/i,
        /^fone\s*:/i,
        /^\(\d{2}\)\s*\d{4}/,
      ];

      const filtered = paragraphs.map(p => p.replace(/^[>\s]+/, '').trim()).filter(p => {
        if (p.length < 4) return false;
        return !NOISE_PATTERNS.some(re => re.test(p));
      });

      return filtered.join('\n\n');
    }

    // Post-processing: trim trailing noise paragraphs (footer remnants)
    function trimTrailingNoise(text) {
      if (!text) return text;
      const TRAILING_NOISE = [
        /^(copyright|todos os direitos|desenvolvido por|powered by)/i,
        /^(endere[çc]o|telefone|fone|cnpj|cep)[\s:]/i,
        /^hor[aá]rio de (atendimento|funcionamento)/i,
        /^siga nossas redes/i,
        /^acesso r[aá]pido$/i,
        /^links? [uú]teis?$/i,
        /^mapa do site$/i,
        /^prefeitura municipal de\s/i,
        /^sec\.\s+de\s/i,
        /^secretaria\s+(municipal\s+)?de\s/i,
        /^SECRETARIAS$/,
        /^rua\s|^av\.\s|^avenida\s/i,
        /^\(\d{2}\)\s*\d/,
        /^foto\s*:/i,
        /^fonte\s*:/i,
        /^cr[eé]dito\s*:/i,
        /^compartilhar/i,
        /^imprimir/i,
        /^mais secretarias$/i,
        /^mais atra[çc][oõ]es$/i,
        /^TURISMO$/,
        /^EDUCA[ÇC][ÃA]O$/,
        /^SA[ÚU]DE$/,
      ];
      const paras = text.split('\n\n');
      // Trim from the end while paragraphs match noise
      while (paras.length > 1) {
        const last = paras[paras.length - 1].trim();
        if (TRAILING_NOISE.some(re => re.test(last)) || last.length < 10) {
          paras.pop();
        } else {
          break;
        }
      }
      return paras.join('\n\n');
    }

    // Strip a leading "Pular para o conteúdo principal" navigation preamble
    // that Drupal-style portals (e.g. PoA) bake into every page wrapper.
    function stripNavPreamble(text) {
      if (!text) return text;
      const NAV_PREAMBLE = [
        /^pular para o conte[uú]do principal[^\n]*\n+/i,
        /^agora,?\s+este [eé] o portal oficial[\s\S]*?ao site antigo\.?\s*\n+/i,
      ];
      let out = text;
      for (const re of NAV_PREAMBLE) out = out.replace(re, '');
      return out.trim();
    }

    for (const selector of CONTENT_SELECTORS) {
      const el = $(selector).first();
      if (!el.length) continue;

      let text = htmlToText(el);
      if (!text) continue;
      text = stripNavPreamble(text);
      // Threshold raised from 50 -> MIN_CONTENT_LEN to skip tiny "accessibility
      // widget" wrappers like Alvorada's `.entry-content` (53 chars: "Reduzir
      // Fonte A- Aumentar Fonte A+ Alto Contraste A") — falls through to the
      // real article container (article / main).
      if (text.length >= MIN_CONTENT_LEN) return trimTrailingNoise(text);
    }

    // Fallback: try body but be more aggressive with cleanup
    const body = $('body').clone();
    if (body.length) {
      // Remove more noise elements
      body.find('script, style, nav, header, footer, aside, .menu, .sidebar, .breadcrumb, .pagination, .nav, .topbar, .toolbar, .acessibilidade, .accessibility, .social, .share, .related, .tags, form, iframe, .banner, .carousel, .slider, [role="navigation"], [role="banner"], [role="complementary"]').remove();

      let text = htmlToText(body);
      text = stripNavPreamble(text);

      // Validate: if more than 30% of paragraphs are noise (< 20 chars), reject
      if (text && text.length > 100) {
        const paras = text.split('\n\n');
        const goodParas = paras.filter(p => p.length > 30);
        if (goodParas.length >= 2) {
          return trimTrailingNoise(goodParas.join('\n\n').substring(0, 10000));
        }
      }
    }

    return null;
  }
}

module.exports = GovBrScraper;
