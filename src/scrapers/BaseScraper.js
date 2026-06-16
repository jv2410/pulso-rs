const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

let _overridesCache = null;
function loadOverrides() {
  if (_overridesCache !== null) return _overridesCache;
  try {
    const file = path.join(__dirname, '..', '..', 'data', 'news-url-overrides.json');
    _overridesCache = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    _overridesCache = {};
  }
  return _overridesCache;
}

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
  /\/noticias-[a-z]+\/\d+-[^/?#]+/i,         // /noticias-geral/{id}-{slug}, /noticias-saude/{id}-{slug} (Marau)
  /\/noticias\/descricao\/\d+\//,            // /noticias/descricao/{id}/{slug} (Tres Palmeiras)
  /\/noticia\/\d+-/,                         // /noticia/{id}-{slug}
  /\/noticia\/\d+\/[^/?#]+/,                 // /noticia/{id}/{slug}
  /\/artigo\/\d+\/[^/?#]+/,                  // /artigo/{id}/{slug}
  /\/artigos\/item\/\d+/,                    // /artigos/item/{id} (Bom Retiro do Sul)
  /\/portal\/noticias\/\d+\/\d+\/\d+\/[a-z][a-z0-9-]+/i, // /portal/noticias/0/3/6996/{slug} (Cangucu, Cerrito etc)
  /\/municipio\/noticias\/[a-z][a-z0-9-]{5,}/i,  // /municipio/noticias/{slug} (Montenegro)
  /\?p=\d{3,}/,                                  // WordPress ?p={id} (Santa Rosa)
  /noticias\.xhtml\?noticia=\d+/,                // noticias.xhtml?noticia={id} (Venancio Aires)
  /\/noticias\.php\?categ=\d+/,                  // noticias.php?categ={id} (Gentil)
  /\/noticia\/\d+\/[a-z][a-z0-9-]+/i,            // /noticia/3846/municipio-conquista-... (Feliz)
  /\/noticia\/\d+(?:\/|$)/,                      // /noticia/{id} no-slug (Esmeralda)
  /\/noticias?_individual\/\d+/,                 // /noticias_individual/{id} (Pouso Novo, Viadutos)
  /\/noticias\/index\/\d+/,                      // /noticias/index/{id} (Protasio Alves)
  /\/noticias\/\d+(?:\/|$)/,                     // /noticias/{id} no-slug (Floriano Peixoto, Taquarucu do Sul, Coqueiros do Sul)
  /\/noticias\/interna\/\d+\/[a-z][a-z0-9-]+/i,  // /noticias/interna/{id}/{slug} (Herval, Pedras Altas)
  /\/index\.php\/ultimas-noticias\/\d+-[^/?#]+/i, // /index.php/ultimas-noticias/{id}-{slug} (Sao Borja, Joomla)
  /\/Noticias\/Detalhes\/\d+\/[a-z][a-z0-9-]+/i, // /Noticias/Detalhes/{id}/{slug} (Sao Joao do Polesine, case-insensitive)
  /\?pg=noticias&rel=[a-f0-9]{20,}/,             // ?pg=noticias&rel={hash} (Salvador das Missoes)
  /\/artigo\/[a-z][a-z0-9-]{5,}(?:[^/?#]*)?$/,   // /artigo/{slug} no-ID (Xangri-La)
  /artigos_\d+(?:#|$)/,                          // artigos_{id} (Tres Passos)
  /\/noticias2\/[a-z][a-z0-9-]+/i,               // /noticias2/{slug} (Erval Seco)
  /\/imprensa\/noticia\/[a-z][a-z-]+\/[a-z][a-z0-9-]+/i, // /imprensa/noticia/{cat}/{slug} (Boa Vista das Missoes)
  /\/web\/noticias\/\d+\/[a-z][a-z0-9-]+/i,      // /web/noticias/{id}/{slug} (Alto Feliz)
  /\/not%C3%ADcias\/\d+-[^/?#]+/i,           // /notícias/{id}-{slug} url-encoded (Nova Ramada, Joomla)
  /\/not[íi]cias\/\d+-[^/?#]+/i,             // /notícias/{id}-{slug} decoded (Nova Ramada)
  /[?&]mn=noticia&id=\d+/,                   // ?mn=noticia&id={id} (Novo Barreiro)
  /\/[a-z][a-z0-9-]{15,}-\d+\.html$/i,       // /{slug}-{id}.html (Eugenio de Castro)
  /\/site\/noticias\/\d+-[^/?#]+/i,           // /site/noticias/{id}-{slug} (NOT /site/conteudos/ — those are institutional)
  /\/site\/noticias\/[a-z][\w-]+\/\d+-[^/?#]+/i, // /site/noticias/{category}/{id}-{slug} (Abase Sistemas, case-insensitive for /site/Noticias/)
  /\/site\/index\.php\/\d+-noticias?\/[a-z][a-z-]+\/\d+-[^/?#]+/i, // /site/index.php/82-noticias/ultimas/{id}-{slug} (Derrubadas, Joomla)
  /\/site\/noticia\/[^/?#]+\/\d+(?:\/|$)/,                          // /site/noticia/{slug}/{id} (Severiano de Almeida)
  /\/site\/publicacao\/[^/?#]+/,             // /site/publicacao/{slug} (Barão de Cotegipe)
  /\/noticiasView\/\d+_[^/?#]+/,            // /noticiasView/{id}_{slug}.html (Barra do Ribeiro)
  /\/midias\/noticias\/[^/]+\/\d+/,          // /midias/noticias/{slug}/{id} (Jari)
  /\/blog\/\d+\/[^/]+\/\d+/,                // /blog/{id}/{slug}/{id} (Arroio Grande)
  /\/pmcs\/news\/\d{4}\/\d{2}\/[^/?#]+/,    // /pmcs/news/{yyyy}/{mm}/{slug}
  /\/post\/\d{2,}(?:\/|$)/,                 // /post/{id} (Coqueiros do Sul)
  /\/postagem\/[a-z][a-z0-9%-]{5,}/i,       // /postagem/{slug} (Cidreira)
  // WordPress date-based
  /\/\d{4}\/\d{2}\/\d{2}\/[^/?#]+/,         // /{yyyy}/{mm}/{dd}/{slug}
  /\/\d{4}\/\d{2}\/[^/?#]+/,                // /{yyyy}/{mm}/{slug}
  // Category-based patterns (Santiago etc.)
  /\/noticias\/[a-z][\w-]+\/[a-z][a-z0-9-]{5,}/, // /noticias/{category}/{slug}
  // PHP query-string patterns
  /noticias_int\.php\?id=\d+/,               // noticias_int.php?id={id}
  /noticia\.php\?detalhe=\d+/,               // noticia.php?detalhe={id}
  /noticia\.php\?noticia=\d+/,               // noticia.php?noticia={id} (Charrua)
  /noticias_ver\.php\?id_noticia=\d+/,       // noticias_ver.php?id_noticia={id}
  /noticias\.php\?url=[A-Za-z0-9+/=]{10,}/,  // noticias.php?url={base64} (Tramandaí etc)
  /artigo\.php\?id=\d+/,                     // artigo.php?id={id} (Igrejinha)
  // Slug-only patterns (least specific, last)
  /\/noticias\/[a-z][a-z0-9-]{5,}\/?(?:[?#].*)?$/i, // /noticias/{slug} ou {slug}/ (min 6 chars, Butiá)
  /\/noticia\/[a-z][a-z0-9-]{5,}[^/?#]*$/,  // /noticia/{slug} (min 6 chars)
  /\/cidadao\/noticia\/[a-z][a-z0-9-]{5,}[^/?#]*$/, // /cidadao/noticia/{slug} (AtendeNet, min 6 chars)
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
  /\/noticias\/categories\//,           // Cidreira (en)
  /\/noticias\/tag\//,
  /\/postagem\/prefeitura-de-cidreira-publica-edital-para-processo-seletivo-simplificado-de-est/i, // Cidreira: bug título+data
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
  // Anchored: only exclude when these are top-level path segments,
  // NOT when they appear inside a /noticias/{cat}/ slug (e.g. UBIRETAMA's
  // /site/Noticias/secretaria-de-obras/909909-... is a real article).
  /^\/secretaria(?:s)?(?:\/|\?|$)/i,
  /^\/site\/secretaria(?:s)?(?:\/|\?|$)/i,
  /^\/servicos(?:\/|\?|$)/i,
  /^\/site\/servicos(?:\/|\?|$)/i,
  /\/legislacao/,
  /\/concursos/,
  /\/editais/,
  /^\/eventos(?:\/|\?|$)/i,
  /^\/site\/eventos(?:\/|\?|$)/i,
  /\/galeria/,
  /\/wp-admin/,
  /\/wp-content/,
  /\/attachment\//,                          // WP image-attachment pages, não são artigos
  /\/feed\/?$/,
  /\.pdf$/i,
  /\.jpg$/i,
  /\.png$/i,
  /\/site\/conteudos\//,                     // /site/conteudos/ — institutional pages, not news
  /\/site\/noticias\/[a-z][a-z-]+\/?$/,      // /site/noticias/categoria — category listing pages (no numeric ID)
  /\/categorias\/(?!noticias)/,               // /categorias/* — category pages (except /categorias/noticias which is a listing)
  /\/noticias\/noticias-/,                   // /noticias/noticias-de-saude etc — category pages
  /\/dados-do-municipio/i,                   // institutional: municipal data
  /\/hino-do-municipio/i,                    // institutional: municipal anthem
  /\/historia-do-municipio/i,                // institutional: municipal history
  /\/formularios-/i,                         // institutional: forms
  /\/demonstrativos-contabeis/i,             // institutional: accounting reports
  /\/legislacao-municipal/i,                 // institutional: municipal legislation
  /\/estrutura-organizacional/i,             // institutional: org structure
  /\/informacoes-do-municipio/i,             // institutional: municipal info
];

/**
 * Listing page paths to try in order of likelihood.
 */
const NEWS_LISTING_PATHS = [
  '/noticias',
  '/noticias/todas',
  '/cidadao/noticia',                  // AtendeNet convention
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
  // --- Phase 2 additions (Decision A1) — appended after existing 19 ---
  '/imprensa',
  '/comunicacao',
  '/comunicacao-social',
  '/sala-de-imprensa',
  '/sala-imprensa',
  '/cidadao/noticia',
  '/cidadao/noticias',
  '/portal/noticia',
  '/portal/noticias',
  '/site/Noticias',
  '/midias',
  '/categorias/noticias',
  '/wp/noticias',
  '/category/noticias',
];

/**
 * User-Agent rotation pool (Decision B1).
 * Index 0 is the default UA — first attempt always uses [0] to preserve
 * behavior of existing working sites. Retries rotate through the pool.
 */
const USER_AGENT_POOL = [
  'Mozilla/5.0 (compatible; RSNewsScraper/1.0)',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html',
];

/**
 * Path to the on-disk discovered-listings cache (Decision C2).
 */
const DISCOVERED_LISTINGS_FILE = path.join(__dirname, '..', '..', 'data', 'discovered-listings.json');

let _discoveredCache = null;
function loadDiscoveredListings() {
  if (_discoveredCache !== null) return _discoveredCache;
  try {
    _discoveredCache = JSON.parse(fs.readFileSync(DISCOVERED_LISTINGS_FILE, 'utf8'));
    if (typeof _discoveredCache !== 'object' || _discoveredCache === null) _discoveredCache = {};
  } catch {
    _discoveredCache = {};
    try {
      fs.writeFileSync(DISCOVERED_LISTINGS_FILE, '{}\n', 'utf8');
    } catch {
      // best-effort; cache still works in-memory
    }
  }
  return _discoveredCache;
}

function saveDiscoveredListing(siteUrl, listingUrl) {
  const cache = loadDiscoveredListings();
  if (cache[siteUrl] === listingUrl) return;
  cache[siteUrl] = listingUrl;
  try {
    fs.writeFileSync(DISCOVERED_LISTINGS_FILE, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  } catch {
    // best-effort
  }
}

/**
 * Strip diacritics for accent-insensitive text matching.
 */
function _stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

class BaseScraper {
  constructor(config = {}) {
    this.timeout = config.REQUEST_TIMEOUT_MS || 30000;
    this.maxRetries = config.MAX_RETRIES || 3;
    this.retryBaseDelay = config.RETRY_BASE_DELAY_MS || 2000;
    this.userAgent = config.USER_AGENT || 'Mozilla/5.0 (compatible; RSNewsScraper/1.0)';
  }

  /**
   * HTTP GET with retry, timeout ladder (B2), and UA rotation on retries (B1).
   * Returns HTML string only — preserves API for existing callers.
   * @param {string} url
   * @param {object} options
   * @returns {Promise<string>} HTML string
   */
  async fetchPage(url, options = {}) {
    const { html } = await this._fetchInternal(url, options);
    return html;
  }

  /**
   * Like fetchPage but returns { html, finalUrl } — finalUrl reflects redirect chain.
   * Added in Phase 2 (Decision A3) for discoverNewsPage to track effective URLs.
   */
  async fetchPageWithUrl(url, options = {}) {
    return this._fetchInternal(url, options);
  }

  /**
   * Internal fetch with timeout ladder, UA rotation, and smart retry classification.
   */
  async _fetchInternal(url, options = {}) {
    const https = require('https');
    const baseTimeout = this.timeout;
    // Decision B2 — timeout ladder
    const timeoutFor = (attempt) => {
      if (attempt <= 0) return baseTimeout;
      if (attempt === 1) return Math.round(baseTimeout * 1.6);
      return Math.round(baseTimeout * 2.5);
    };

    const response = await this.retry(async (attempt) => {
      // First attempt always uses the default UA so the 41 working sites
      // keep behaving identically. Retries rotate through the pool.
      const ua = attempt === 0
        ? this.userAgent
        : USER_AGENT_POOL[attempt % USER_AGENT_POOL.length];

      const axiosConfig = {
        url,
        method: 'GET',
        timeout: timeoutFor(attempt),
        maxRedirects: 5,
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5'
        },
        responseType: 'text',
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      };

      return await axios(axiosConfig);
    }, this.maxRetries);

    let finalUrl = url;
    try {
      finalUrl = (response.request && response.request.res && response.request.res.responseUrl)
        || response.config?.url
        || url;
    } catch {
      finalUrl = url;
    }

    return { html: response.data, finalUrl };
  }

  /**
   * Classify an axios/network error to decide whether to retry.
   * Decision B2: 404 → fail fast; 403/503/timeout/ECONNRESET/4xx → retry.
   */
  _shouldRetry(err) {
    if (!err) return false;
    const status = err.response && err.response.status;
    if (status === 404) return false; // path doesn't exist — bail
    return true;
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
   * Passes the current attempt index (0-based) to fn so callers can adapt
   * (e.g. UA rotation, timeout ladder). 404s short-circuit immediately.
   * @param {Function} fn - async function (attempt) => Promise
   * @param {number} maxRetries
   * @returns {Promise<*>}
   */
  async retry(fn, maxRetries) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(attempt);
      } catch (err) {
        lastError = err;
        // Smart retry: don't retry on 404 — path simply doesn't exist
        if (!this._shouldRetry(err)) throw err;
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

    // MANDATORY year sanity check — reject any year outside [2000, 2030].
    // AtendeNet sites embed numeric file IDs in paths like
    // "/static/portal/html/elementos/2026/05/03/2251_<hash>.html" which the
    // greedy DD/MM/YYYY regex would otherwise parse as 05/03/2251 (year 2251).
    const isYearSane = (y) => {
      const n = typeof y === 'string' ? parseInt(y, 10) : y;
      return Number.isFinite(n) && n >= 2000 && n <= 2030;
    };

    // Future-date guard: reject dates beyond tomorrow (catches event/deadline dates
    // mistakenly extracted from URL slugs like "refis-ate-20-de-junho-de-2026")
    const isNotFuture = (iso) => {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return false;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      return d <= tomorrow;
    };

    const buildIso = (year, month, day, hh = '12', mm = '00', ss = '00') => {
      if (!isYearSane(year)) return null;
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${hh}:${mm}:${ss}Z`;
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      if (!isNotFuture(d.toISOString())) return null;
      return d.toISOString();
    };

    // Already ISO — accept "YYYY-MM-DD", "YYYY-MM-DDTHH:MM:SS[±zz:zz|Z]"
    // AND space-separated "YYYY-MM-DD HH:MM:SS" (AtendeNet article:published_time).
    const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?/);
    if (isoMatch) {
      const [, year, month, day, hh, mm, ss, tz] = isoMatch;
      if (!isYearSane(year)) return null;
      if (hh !== undefined) {
        // Reconstruct ISO with explicit T separator and default to UTC if no tz given
        const tzPart = tz ? tz : 'Z';
        const iso = `${year}-${month}-${day}T${hh}:${mm}:${ss || '00'}${tzPart}`;
        const d = new Date(iso);
        if (isNaN(d.getTime())) return null;
        if (!isNotFuture(d.toISOString())) return null;
        return d.toISOString();
      }
      return buildIso(year, month, day);
    }

    // DD/MM/YYYY (optionally with time in various formats)
    const slashMatch = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      return buildIso(year, month, day);
    }

    // DD/Mon/YYYY (e.g. 12/Mar/2026 — Alegrete)
    const slashMonMatch = cleaned.match(/(\d{1,2})\/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{4})/i);
    if (slashMonMatch) {
      const shortMonths = { 'jan':'01','fev':'02','mar':'03','abr':'04','mai':'05','jun':'06','jul':'07','ago':'08','set':'09','out':'10','nov':'11','dez':'12' };
      const [, day, mon, year] = slashMonMatch;
      const month = shortMonths[mon.toLowerCase()];
      if (month) return buildIso(year, month, day);
    }

    // DD mon YYYY (e.g. 17 mar 2026 — Encantado listing)
    const shortMonthMatch = cleaned.toLowerCase().match(/(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(\d{4})/);
    if (shortMonthMatch) {
      const shortMonths = { 'jan':'01','fev':'02','mar':'03','abr':'04','mai':'05','jun':'06','jul':'07','ago':'08','set':'09','out':'10','nov':'11','dez':'12' };
      const [, day, mon, year] = shortMonthMatch;
      const month = shortMonths[mon];
      if (month) return buildIso(year, month, day);
    }

    // "DD de mês de YYYY"
    const textMatch = cleaned.toLowerCase().match(/(\d{1,2})\s+de\s+([a-záàâãéèêíïóôõúç]+)\s+de\s+(\d{4})/);
    if (textMatch) {
      const [, day, monthName, year] = textMatch;
      const month = BRAZILIAN_MONTHS[monthName];
      if (month) return buildIso(year, month, day);
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
    let trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) trimmed = 'https://' + trimmed;
    // AtendeNet wildcard cert is *.atende.net (1 level only) — strip www. to avoid SSL mismatch
    return trimmed.replace(/^(https?:\/\/)www\.([^/]+\.atende\.net)/i, '$1$2');
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
   * Quick probe: HEAD request to check if path exists.
   * Returns final URL (after redirects) on 2xx, null on 4xx/5xx/timeout.
   * Much faster than full GET — 100-300ms per failed path vs 2-8s.
   */
  async _probeListingPath(baseUrl, listingPath) {
    const url = baseUrl + listingPath;
    const https = require('https');
    try {
      const response = await axios({
        url,
        method: 'HEAD',
        timeout: 4000,           // shorter timeout for probe
        maxRedirects: 5,
        validateStatus: (s) => s < 500,  // accept any non-5xx
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      });
      if (response.status >= 200 && response.status < 400) {
        // Track final URL after redirects
        const finalUrl = response.request?.res?.responseUrl || url;
        return finalUrl;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Discover the news listing page for a site by trying common paths.
   * Returns the first path that responds with HTML containing article-like links.
   * @param {string} baseUrl - e.g. https://www.agudo.rs.gov.br
   * @param {string} [siteName] - municipality name to look up overrides
   * @returns {Promise<{url: string, html: string}|null>}
   */
  async discoverNewsPage(baseUrl, siteName = null) {
    // Override lookup: if a specific URL is configured for this city, use it directly
    if (siteName) {
      const overrides = loadOverrides();
      const ovEntry = overrides[siteName];
      const overrideUrl = typeof ovEntry === 'string' ? ovEntry : (ovEntry && ovEntry.url) || null;
      if (overrideUrl) {
        try {
          const html = await this.fetchPage(overrideUrl);
          const links = this.extractArticleLinks(html, baseUrl);
          if (links.length > 0) {
            return { url: overrideUrl, html };
          }
          // 0 links from static HTML: try Playwright-rendered version (SPA / lazy-loaded news)
          try {
            const { getInstance } = require('./BrowserPool');
            const pool = getInstance();
            if (pool.isEnabled()) {
              const rendered = await pool.fetchRendered(overrideUrl);
              const rLinks = this.extractArticleLinks(rendered, baseUrl);
              if (rLinks.length > 0) {
                return { url: overrideUrl, html: rendered };
              }
              // Still 0: return rendered (more likely useful than static empty page)
              return { url: overrideUrl, html: rendered };
            }
          } catch (err) {
            console.error(`[BaseScraper] override Playwright render failed for ${overrideUrl}: ${err.message}`);
          }
          // Fall back to static HTML
          return { url: overrideUrl, html };
        } catch {
          // Override URL fetch failed entirely, fall back to discovery
        }
      }
    }

    // Decision C2 — check on-disk cache before running discovery again
    const cache = loadDiscoveredListings();
    const cachedUrl = cache[baseUrl];
    if (cachedUrl) {
      try {
        const { html, finalUrl } = await this.fetchPageWithUrl(cachedUrl);
        const links = this.extractArticleLinks(html, baseUrl);
        if (links.length > 0) {
          return { url: finalUrl || cachedUrl, html };
        }
      } catch {
        // cached URL stale; fall through to discovery
      }
    }

    // Stage 1 — Quick probe: HEAD all NEWS_LISTING_PATHS in parallel.
    // Stage 2 — Full GET only on candidates that responded 2xx/3xx.
    // Preserves NEWS_LISTING_PATHS priority by iterating in original order.
    const probeResults = await Promise.allSettled(
      NEWS_LISTING_PATHS.map((p, idx) =>
        this._probeListingPath(baseUrl, p).then(url => ({ path: p, url, idx }))
      )
    );
    const candidates = probeResults
      .filter(r => r.status === 'fulfilled' && r.value && r.value.url)
      .map(r => r.value)
      .sort((a, b) => a.idx - b.idx);

    for (const cand of candidates) {
      try {
        const { html, finalUrl } = await this.fetchPageWithUrl(cand.url);
        const links = this.extractArticleLinks(html, baseUrl);
        if (links.length > 0) {
          return { url: finalUrl || cand.url, html };
        }
      } catch {
        // try next candidate
      }
    }

    // Safety net: some servers don't support HEAD properly (405/501 or
    // misbehaving proxies). If the parallel HEAD probe yielded zero
    // candidates, retry the FIRST 5 NEWS_LISTING_PATHS with full GET.
    if (candidates.length === 0) {
      const fallbackPaths = NEWS_LISTING_PATHS.slice(0, 5);
      for (const p of fallbackPaths) {
        const url = baseUrl + p;
        try {
          const { html, finalUrl } = await this.fetchPageWithUrl(url);
          const links = this.extractArticleLinks(html, baseUrl);
          if (links.length > 0) {
            return { url: finalUrl || url, html };
          }
        } catch {
          // try next
        }
      }
    }

    // Also try PHP-based listing pages
    const phpPaths = ['/noticias.php', '/noticia.php', '/index.php?pg=noticias'];
    for (const p of phpPaths) {
      const url = baseUrl + p;
      try {
        const { html, finalUrl } = await this.fetchPageWithUrl(url);
        const links = this.extractArticleLinks(html, baseUrl);
        if (links.length > 0) {
          return { url: finalUrl || url, html };
        }
      } catch {
        // Path not found or errored, try next
      }
    }

    // Decision A2 — homepage anchor scan
    let homepageHtml = null;
    let homepageFinalUrl = baseUrl;
    try {
      const homepageResp = await this.fetchPageWithUrl(baseUrl);
      homepageHtml = homepageResp.html;
      homepageFinalUrl = homepageResp.finalUrl || baseUrl;

      const candidates = this._scanHomepageForNewsLink(baseUrl, homepageHtml);
      for (const candidate of candidates) {
        try {
          const { html, finalUrl } = await this.fetchPageWithUrl(candidate);
          const links = this.extractArticleLinks(html, baseUrl);
          if (links.length > 0) {
            const resolved = finalUrl || candidate;
            saveDiscoveredListing(baseUrl, resolved);
            return { url: resolved, html };
          }
        } catch {
          // try next candidate
        }
      }
    } catch {
      // homepage fetch failed
    }

    // Decision C1 — host variant probe (only when everything else failed)
    const hostVariants = this._generateHostVariants(baseUrl);
    const probePaths = NEWS_LISTING_PATHS.slice(0, 3); // /noticias, /noticias/todas, /site/noticias
    for (const variant of hostVariants) {
      if (variant === baseUrl) continue; // already tried above
      for (const p of probePaths) {
        const url = variant + p;
        try {
          const { html, finalUrl } = await this.fetchPageWithUrl(url);
          const links = this.extractArticleLinks(html, baseUrl);
          if (links.length > 0) {
            const resolved = finalUrl || url;
            saveDiscoveredListing(baseUrl, resolved);
            return { url: resolved, html };
          }
        } catch {
          // try next
        }
      }
    }

    // Last resort: use the homepage itself if it has enough article links
    if (homepageHtml) {
      const links = this.extractArticleLinks(homepageHtml, baseUrl);
      if (links.length >= 3) {
        saveDiscoveredListing(baseUrl, homepageFinalUrl);
        return { url: homepageFinalUrl, html: homepageHtml };
      }
    }

    // Last resort: SPA fallback via Playwright (Decision D1)
    // Re-fetch the override URL or baseUrl with browser to render JS, then extract.
    try {
      const { getInstance } = require('./BrowserPool');
      const pool = getInstance();
      if (pool.isEnabled()) {
        // Determine target: explicit override > current baseUrl
        const overrides = loadOverrides();
        const targetUrl = (siteName && overrides[siteName]) || baseUrl;

        // Quick check: do we already know it's SPA based on a previous attempt?
        // We don't store that signal. Just try once if we got this far without finding a listing.
        const renderedHtml = await pool.fetchRendered(targetUrl);
        const links = this.extractArticleLinks(renderedHtml, baseUrl);
        if (links.length > 0) {
          saveDiscoveredListing(baseUrl, targetUrl);  // cache it
          return { url: targetUrl, html: renderedHtml };
        }
      }
    } catch (err) {
      // Playwright unavailable, max-per-run reached, or rendering failed — fall through
      console.error(`[BaseScraper] Playwright fallback failed for ${baseUrl}: ${err.message}`);
    }

    return null;
  }

  /**
   * Heuristic to detect a Single Page Application that needs JS rendering.
   * Returns true when both:
   *   - Static HTML has very few anchors (< 5)
   *   - HTML contains a SPA marker (Vue/Vuex/Next.js/Plasmic/empty mount point)
   * The combination minimizes false positives on plain pages with no news yet.
   */
  _isLikelySPA(html, anchorCount = null) {
    if (anchorCount === null) {
      const $ = this.loadHTML(html);
      anchorCount = $('a[href]').filter((_, el) => {
        const h = $(el).attr('href');
        return h && !h.startsWith('#') && !h.startsWith('javascript:') && !h.startsWith('mailto:');
      }).length;
    }
    if (anchorCount >= 5) return false;

    // SPA markers
    if (/__NEXT_DATA__/.test(html)) return true;
    if (/Vuex\.Store|new Vue\(|window\.__NUXT__/i.test(html)) return true;
    if (/plasmic|window\.PLASMIC/i.test(html)) return true;
    if (/<div\s+id=["'](app|root|__nuxt|__next)["'][^>]*>\s*<\/div>/i.test(html)) return true;
    if (/data-v-[a-f0-9]{6,}/i.test(html)) return true;

    return false;
  }

  /**
   * Decision A2 — scan homepage for anchors whose visible text matches
   * news-related labels. Returns up to 5 absolute candidate URLs (same host).
   */
  _scanHomepageForNewsLink(baseUrl, html) {
    const out = [];
    if (!html) return out;
    let $;
    try { $ = this.loadHTML(html); } catch { return out; }

    let baseHost;
    try { baseHost = this._normalizeHost(new URL(baseUrl).hostname); } catch { return out; }

    // Accent-insensitive, exact-text match
    const matchRe = /^(noticias?|imprensa|comunicacao|sala de imprensa|comunicacao social)$/i;
    const seen = new Set();

    $('a[href]').each((_, el) => {
      if (out.length >= 5) return;
      const $el = $(el);
      const rawText = ($el.text() || '').trim();
      if (!rawText) return;
      const normalized = _stripAccents(rawText).toLowerCase();
      if (!matchRe.test(normalized)) return;

      const href = $el.attr('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;

      const abs = this.buildAbsoluteUrl(href, baseUrl);
      if (!abs || seen.has(abs)) return;

      try {
        const linkHost = this._normalizeHost(new URL(abs).hostname);
        if (linkHost !== baseHost) return;
      } catch {
        return;
      }

      seen.add(abs);
      out.push(abs);
    });

    return out;
  }

  /**
   * Decision C1 — generate host/protocol variants for a baseUrl, plus an
   * automatic gov.br twin for non-gov hosts (e.g. pmaratiba.com.br → aratiba.rs.gov.br).
   */
  _generateHostVariants(baseUrl) {
    const variants = [];
    let u;
    try { u = new URL(baseUrl); } catch { return variants; }

    const host = u.hostname;
    const hasWww = host.startsWith('www.');
    const stripped = hasWww ? host.slice(4) : host;
    const withWww = hasWww ? host : 'www.' + host;

    const push = (proto, h) => {
      const v = `${proto}://${h}`;
      if (!variants.includes(v)) variants.push(v);
    };

    push('https', host);
    push('https', hasWww ? stripped : withWww);
    push('http', host);
    push('http', hasWww ? stripped : withWww);

    // Auto gov.br twin: pmFOO.com.br / FOO.com.br / FOO.com → FOO.rs.gov.br
    const m = host.match(/^(www\.)?(pm)?(\w+)\.(com\.br|com)$/);
    if (m) {
      const slug = m[3];
      if (slug && slug.length >= 3) {
        push('https', `${slug}.rs.gov.br`);
        push('https', `www.${slug}.rs.gov.br`);
      }
    }

    return variants;
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

      let abs = this.buildAbsoluteUrl(href, baseUrl);
      // Strip URL fragment (#respond, #comments etc). The fragment points at
      // the SAME article — keeping it produced duplicate rows (Atlas 2026-06-15).
      if (abs) abs = abs.replace(/#.*$/, '');
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
          let wpAbs = this.buildAbsoluteUrl(href, baseUrl);
          if (wpAbs) wpAbs = wpAbs.replace(/#.*$/, '');
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
