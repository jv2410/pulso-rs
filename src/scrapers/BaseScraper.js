const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

const BRAZILIAN_MONTHS = {
  'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
  'abril': '04', 'maio': '05', 'junho': '06',
  'julho': '07', 'agosto': '08', 'setembro': '09',
  'outubro': '10', 'novembro': '11', 'dezembro': '12'
};

/**
 * Known article URL patterns - paths that indicate an article page.
 * Order matters: more specific patterns first.
 */
const ARTICLE_PATH_PATTERNS = [
  // ID-based patterns (most specific first)
  /\/noticia\/visualizar\/id\/\d+/,          // /noticia/visualizar/id/{id}
  /\/noticia\/view\/\d+\//,                   // /noticia/view/{id}/{slug}
  /\/noticia\/\d+\/\d+/,                     // /noticia/{id}/{category_id} (Lajeado, Rio Grande)
  /\/noticias\/\d+\/[^/?#]+/,                // /noticias/{id}/{slug}
  /\/noticias\/\d+-[^/?#]+/,                 // /noticias/{id}-{slug}
  /\/noticias\/descricao\/\d+\//,            // /noticias/descricao/{id}/{slug} (Tres Palmeiras)
  /\/noticia\/\d+-/,                         // /noticia/{id}-{slug}
  /\/noticia\/\d+\/[^/?#]+/,                 // /noticia/{id}/{slug}
  /\/artigo\/\d+\/[^/?#]+/,                  // /artigo/{id}/{slug}
  /\/artigos\/item\/\d+/,                    // /artigos/item/{id} (Bom Retiro do Sul)
  /\/site\/noticias\/\d+-[^/?#]+/,           // /site/noticias/{id}-{slug} (NOT /site/conteudos/ — those are institutional)
  /\/site\/publicacao\/[^/?#]+/,             // /site/publicacao/{slug} (Barão de Cotegipe)
  /\/noticiasView\/\d+_[^/?#]+/,            // /noticiasView/{id}_{slug}.html (Barra do Ribeiro)
  /\/midias\/noticias\/[^/]+\/\d+/,          // /midias/noticias/{slug}/{id} (Jari)
  /\/blog\/\d+\/[^/]+\/\d+/,                // /blog/{id}/{slug}/{id} (Arroio Grande)
  /\/pmcs\/news\/\d{4}\/\d{2}\/[^/?#]+/,    // /pmcs/news/{yyyy}/{mm}/{slug}
  // WordPress date-based
  /\/\d{4}\/\d{2}\/\d{2}\/[^/?#]+/,         // /{yyyy}/{mm}/{dd}/{slug}
  /\/\d{4}\/\d{2}\/[^/?#]+/,                // /{yyyy}/{mm}/{slug}
  // Category-based patterns (Santiago etc.)
  /\/noticias\/[a-z][\w-]+\/[a-z][a-z0-9-]{5,}/, // /noticias/{category}/{slug}
  // PHP query-string patterns
  /noticias_int\.php\?id=\d+/,               // noticias_int.php?id={id}
  /noticia\.php\?detalhe=\d+/,               // noticia.php?detalhe={id}
  /noticias_ver\.php\?id_noticia=\d+/,       // noticias_ver.php?id_noticia={id}
  /noticias\.php\?url=[A-Za-z0-9+/=]{10,}/,  // noticias.php?url={base64} (Tramandaí etc)
  /artigo\.php\?id=\d+/,                     // artigo.php?id={id} (Igrejinha)
  // Slug-only patterns (least specific, last)
  /\/noticias\/[a-z][a-z0-9-]{5,}[^/?#]*$/, // /noticias/{slug} (min 6 chars)
  /\/noticia\/[a-z][a-z0-9-]{5,}[^/?#]*$/,  // /noticia/{slug} (min 6 chars)
  /\/news\/[a-z][a-z0-9-]{5,}[^/?#]*$/,     // /news/{slug}
];

/**
 * Paths that should be EXCLUDED even if they match article patterns.
 */
const EXCLUDED_PATH_PATTERNS = [
  /\/noticias\/?$/,
  /\/noticia\/?$/,
  /\/noticias\/\d{4}\/?$/,              // year pages
  /\/noticias\/\d{4}\/\d{2}\/?$/,      // month pages
  /\/noticias\/categoria\//,
  /\/noticias\/tag\//,
  /\/noticia\/categoria\//,
  /[?&]page=/,
  /[?&]pagina=/,
  /\/pesquisar/,
  /\/contato/,
  /\/sobre/,
  /\/fale-conosco/,
  /\/transparencia/,
  /\/licitacoes/,
  /\/diario-oficial/,
  /\/secretaria/,
  /\/servicos/,
  /\/legislacao/,
  /\/concursos/,
  /\/editais/,
  /\/eventos/,
  /\/galeria/,
  /\/wp-admin/,
  /\/wp-content/,
  /\/feed\/?$/,
  /\.pdf$/i,
  /\.jpg$/i,
  /\.png$/i,
  /\/site\/conteudos\//,                     // /site/conteudos/ — institutional pages, not news
  /\/site\/noticias\/[a-z][a-z-]+\/?$/,      // /site/noticias/categoria — category listing pages (no numeric ID)
  /\/categorias\/(?!noticias)/,               // /categorias/* — category pages (except /categorias/noticias which is a listing)
  /\/noticias\/noticias-/,                   // /noticias/noticias-de-saude etc — category pages
];

/**
 * Listing page paths to try in order of likelihood.
 */
const NEWS_LISTING_PATHS = [
  '/noticias',
  '/noticias/todas',
  '/site/noticias',
  '/web/noticias',
  '/noticia',
  '/noticia/?noticias.html',
  '/noticia/bcid/13/?noticias.html',
  '/noticia/categoria/',
  '/noticias/noticias-temporarias',
  '/portal/noticias',
  '/news',
  '/blog',
  '/artigos',                          // Bom Retiro do Sul
  '/midias/noticias',                  // Jari
  '/noticias/descricao',               // Tres Palmeiras
  '/blog/1/assessoria-imprensa/2',     // Arroio Grande
  '/links/noticias',                   // Santa Cruz do Sul
  '/categoria/noticias',               // Jaguarão (WordPress category)
  '/categoria/noticias/',              // Jaguarão (trailing slash)
];

class BaseScraper {
  constructor(config = {}) {
    this.timeout = config.REQUEST_TIMEOUT_MS || 30000;
    this.maxRetries = config.MAX_RETRIES || 3;
    this.retryBaseDelay = config.RETRY_BASE_DELAY_MS || 2000;
    this.userAgent = config.USER_AGENT || 'Mozilla/5.0 (compatible; RSNewsScraper/1.0)';
  }

  /**
   * HTTP GET with retry, timeout, redirect following.
   * @param {string} url
   * @param {object} options - { rejectUnauthorized }
   * @returns {Promise<string>} HTML string
   */
  async fetchPage(url, options = {}) {
    const https = require('https');
    const axiosConfig = {
      url,
      method: 'GET',
      timeout: this.timeout,
      maxRedirects: 5,
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5'
      },
      responseType: 'text',
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    };

    const response = await this.retry(
      () => axios(axiosConfig),
      this.maxRetries
    );

    return response.data;
  }

  /**
   * Load HTML string into cheerio.
   * @param {string} html
   * @param {object} options - cheerio options
   * @returns {cheerio.CheerioAPI}
   */
  loadHTML(html, options = {}) {
    return cheerio.load(html, options);
  }

  /**
   * Generic retry with exponential backoff.
   * @param {Function} fn - async function to retry
   * @param {number} maxRetries
   * @returns {Promise<*>}
   */
  async retry(fn, maxRetries) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const delay = this.retryBaseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  /**
   * Strip HTML tags and collapse whitespace.
   * @param {string} text
   * @returns {string}
   */
  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Parse Brazilian date formats to ISO 8601 string.
   * Supports: DD/MM/YYYY, DD de mês de YYYY, YYYY-MM-DD, DD/MM/YYYY HHhMM
   * @param {string} dateStr
   * @returns {string|null}
   */
  parseBrazilianDate(dateStr) {
    if (!dateStr) return null;
    const cleaned = dateStr.trim();

    // Already ISO (full datetime or date-only, with optional timezone offset)
    const isoMatch = cleaned.match(/^(\d{4}-\d{2}-\d{2})(T[\d:.]+([+-]\d{2}:?\d{2}|Z)?)?/);
    if (isoMatch) {
      // If it has a time component, parse the full match; otherwise add noon UTC
      const hasTime = !!isoMatch[2];
      const d = new Date(hasTime ? isoMatch[0] : isoMatch[1] + 'T12:00:00Z');
      return isNaN(d.getTime()) ? null : d.toISOString();
    }

    // DD/MM/YYYY (optionally with time in various formats)
    const slashMatch = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00Z`);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }

    // DD/Mon/YYYY (e.g. 12/Mar/2026 — Alegrete)
    const slashMonMatch = cleaned.match(/(\d{1,2})\/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{4})/i);
    if (slashMonMatch) {
      const shortMonths = { 'jan':'01','fev':'02','mar':'03','abr':'04','mai':'05','jun':'06','jul':'07','ago':'08','set':'09','out':'10','nov':'11','dez':'12' };
      const [, day, mon, year] = slashMonMatch;
      const month = shortMonths[mon.toLowerCase()];
      if (month) {
        const d = new Date(`${year}-${month}-${day.padStart(2, '0')}T12:00:00Z`);
        return isNaN(d.getTime()) ? null : d.toISOString();
      }
    }

    // DD mon YYYY (e.g. 17 mar 2026 — Encantado listing)
    const shortMonthMatch = cleaned.toLowerCase().match(/(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(\d{4})/);
    if (shortMonthMatch) {
      const shortMonths = { 'jan':'01','fev':'02','mar':'03','abr':'04','mai':'05','jun':'06','jul':'07','ago':'08','set':'09','out':'10','nov':'11','dez':'12' };
      const [, day, mon, year] = shortMonthMatch;
      const month = shortMonths[mon];
      if (month) {
        const d = new Date(`${year}-${month}-${day.padStart(2, '0')}T12:00:00Z`);
        return isNaN(d.getTime()) ? null : d.toISOString();
      }
    }

    // "DD de mês de YYYY"
    const textMatch = cleaned.toLowerCase().match(/(\d{1,2})\s+de\s+([a-záàâãéèêíïóôõúç]+)\s+de\s+(\d{4})/);
    if (textMatch) {
      const [, day, monthName, year] = textMatch;
      const month = BRAZILIAN_MONTHS[monthName];
      if (month) {
        const d = new Date(`${year}-${month}-${day.padStart(2, '0')}T12:00:00Z`);
        return isNaN(d.getTime()) ? null : d.toISOString();
      }
    }

    return null;
  }

  /**
   * Resolve a relative URL against a base URL.
   * @param {string} relative
   * @param {string} base
   * @returns {string}
   */
  buildAbsoluteUrl(relative, base) {
    if (!relative) return '';
    try {
      return new URL(relative, base).href;
    } catch {
      return relative;
    }
  }

  /**
   * Ensure a URL has a protocol prefix.
   * @param {string} url
   * @returns {string}
   */
  ensureProtocol(url) {
    if (!url) return '';
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return 'https://' + trimmed;
  }

  /**
   * Normalize a hostname by stripping the leading 'www.' prefix.
   * This allows matching e.g. www.site.rs.gov.br with site.rs.gov.br.
   * @param {string} hostname
   * @returns {string}
   */
  _normalizeHost(hostname) {
    return hostname.replace(/^www\./, '');
  }

  // ---------------------------------------------------------------------------
  // DISCOVERY-FIRST METHODS
  // ---------------------------------------------------------------------------

  /**
   * Discover the news listing page for a site by trying common paths.
   * Returns the first path that responds with HTML containing article-like links.
   * @param {string} baseUrl - e.g. https://www.agudo.rs.gov.br
   * @returns {Promise<{url: string, html: string}|null>}
   */
  async discoverNewsPage(baseUrl) {
    // First try all standard paths
    for (const path of NEWS_LISTING_PATHS) {
      const url = baseUrl + path;
      try {
        const html = await this.fetchPage(url);
        const links = this.extractArticleLinks(html, baseUrl);
        if (links.length > 0) {
          return { url, html };
        }
      } catch {
        // Path not found or errored, try next
      }
    }

    // Also try PHP-based listing pages
    const phpPaths = ['/noticias.php', '/noticia.php', '/index.php?pg=noticias'];
    for (const path of phpPaths) {
      const url = baseUrl + path;
      try {
        const html = await this.fetchPage(url);
        const links = this.extractArticleLinks(html, baseUrl);
        if (links.length > 0) {
          return { url, html };
        }
      } catch {
        // Path not found or errored, try next
      }
    }

    // Last resort: try the homepage itself (some sites show news on homepage)
    try {
      const html = await this.fetchPage(baseUrl);
      const links = this.extractArticleLinks(html, baseUrl);
      if (links.length >= 3) {
        return { url: baseUrl, html }; // require at least 3 to avoid false positives
      }
    } catch {
      // Homepage fetch failed
    }

    return null;
  }

  /**
   * Discover category/editorial sub-pages that may contain additional news.
   * Looks for links like /noticias/saude, /noticias/educacao, /categorias/noticias/*, etc.
   * @param {string} listingHtml - HTML of the main listing page
   * @param {string} baseUrl
   * @returns {string[]} - array of category page URLs to scrape
   */
  discoverCategoryPages(listingHtml, baseUrl) {
    const $ = this.loadHTML(listingHtml);
    const categories = new Set();

    let baseHost;
    try {
      baseHost = this._normalizeHost(new URL(baseUrl).hostname);
    } catch {
      return [];
    }

    // Editorial categories we care about
    const EDITORIAL_KEYWORDS = [
      'cidadania', 'meio-ambiente', 'bem-estar', 'animal', 'cultura',
      'habitacao', 'habitação', 'infraestrutura', 'desenvolvimento',
      'mobilidade', 'turismo', 'esporte', 'lazer', 'educacao', 'educação',
      'gestao', 'gestão', 'saude', 'saúde', 'seguranca', 'segurança',
      'resiliencia', 'resiliência', 'eventos', 'festas', 'obras',
      'assistencia', 'assistência', 'agricultura', 'social', 'transporte',
    ];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const abs = this.buildAbsoluteUrl(href, baseUrl);
      if (!abs) return;

      try {
        const linkHost = this._normalizeHost(new URL(abs).hostname);
        if (linkHost !== baseHost) return;
      } catch {
        return;
      }

      const path = new URL(abs).pathname.toLowerCase();

      // Match category-like paths: /noticias/{category}, /categorias/noticias/{category}
      const isCategoryPage = (
        /\/noticias\/[a-z][\w-]+\/?$/.test(path) ||
        /\/categorias\/noticias\/[a-z][\w-]+\/?$/.test(path) ||
        /\/site\/noticias\/[a-z][\w-]+\/?$/.test(path)
      );

      if (isCategoryPage) {
        // Only include if it matches an editorial we care about
        const matchesEditorial = EDITORIAL_KEYWORDS.some(kw => path.includes(kw));
        if (matchesEditorial) {
          categories.add(abs);
        }
      }
    });

    return Array.from(categories);
  }

  /**
   * Smart article link extraction using known URL patterns.
   * Filters out non-article links, deduplicates by absolute URL.
   * Falls back to WordPress detection if no pattern matches.
   * @param {string} html - HTML of the listing page
   * @param {string} baseUrl - base URL for resolving relative links
   * @returns {string[]} - array of absolute article URLs
   */
  extractArticleLinks(html, baseUrl) {
    const $ = this.loadHTML(html);
    const seen = new Set();
    const results = [];

    let baseHost;
    try {
      baseHost = this._normalizeHost(new URL(baseUrl).hostname);
    } catch {
      return results;
    }

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      // Skip non-navigational links
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;

      const abs = this.buildAbsoluteUrl(href, baseUrl);
      if (!abs || seen.has(abs)) return;

      // Skip external domains (normalize www prefix for comparison)
      try {
        const linkHost = this._normalizeHost(new URL(abs).hostname);
        if (linkHost !== baseHost) return;
      } catch {
        return;
      }

      // Get both pathname and full URL for pattern matching
      let urlObj;
      try { urlObj = new URL(abs); } catch { return; }
      const pathAndQuery = urlObj.pathname + urlObj.search;

      // Check excluded patterns against both path and full URL
      const isExcluded = EXCLUDED_PATH_PATTERNS.some(re => re.test(pathAndQuery) || re.test(abs));
      if (isExcluded) return;

      // Check article patterns against both path and full pathAndQuery
      const isArticle = ARTICLE_PATH_PATTERNS.some(re => re.test(urlObj.pathname) || re.test(pathAndQuery));
      if (isArticle) {
        seen.add(abs);
        results.push(abs);
      }
    });

    // If no pattern-based matches, try WordPress detection
    if (results.length === 0) {
      const isWordPress = html.includes('wp-content') || html.includes('wp-json') || html.includes('wordpress');
      if (isWordPress) {
        // On WordPress /noticias pages, article links are usually in post titles
        $('article a, .entry-title a, .post-title a, h2.entry-title a, h2 a, .card a').each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;
          const wpAbs = this.buildAbsoluteUrl(href, baseUrl);
          if (!wpAbs || seen.has(wpAbs)) return;
          try {
            const linkHost = this._normalizeHost(new URL(wpAbs).hostname);
            if (linkHost !== baseHost) return;
            const path = new URL(wpAbs).pathname;
            // WordPress articles typically have slugs with multiple hyphens
            if (path !== '/' && path.split('-').length >= 3 && !EXCLUDED_PATH_PATTERNS.some(re => re.test(path))) {
              seen.add(wpAbs);
              results.push(wpAbs);
            }
          } catch {}
        });
      }
    }

    return results;
  }

  /**
   * Main scrape method - subclasses must implement.
   * @param {object} site - { id, name, site_url, category }
   * @returns {Promise<{articles: Array, errors: Array}>}
   */
  async scrape(site) {
    return { articles: [], errors: [{ message: 'scrape() not implemented', site: site.site_url }] };
  }
}

module.exports = BaseScraper;
