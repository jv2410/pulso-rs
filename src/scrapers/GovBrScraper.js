const BaseScraper = require('./BaseScraper');
const { extractWithLLM, classifyAndSummarize } = require('../utils/llmDateExtractor');

/**
 * Title selectors in priority order.
 */
const TITLE_SELECTORS = [
  'h1.titulo-noticia',
  'h1.titulo',
  'article h1',
  '.entry-title',
  '.noticia-titulo',
  '.page-title',
  '.post-title',
  'h2.titulo-noticia',
  'h2.titulo',
  '.content h1',
  '.container h1',
  'h1',
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
 * Words/phrases that indicate a title is actually a site name or navigation.
 */
const TITLE_BLACKLIST = [
  'notícias',
  'noticias',
  'página inicial',
  'home',
];

class GovBrScraper extends BaseScraper {
  /**
   * Scrape a municipal government site - ONLY articles from today.
   */
  async scrape(site) {
    const articles = [];
    const errors = [];
    const baseUrl = this.ensureProtocol(site.site_url).replace(/\/+$/, '');

    // Step 1: Discover news listing page
    const listing = await this.discoverNewsPage(baseUrl);
    if (!listing) {
      errors.push({
        type: 'listing_not_found',
        site: baseUrl,
        message: 'No news listing page found after trying all known paths'
      });
      return { articles, errors };
    }

    // Step 2: Extract article links from main listing
    let links = this.extractArticleLinks(listing.html, baseUrl);

    // Step 2b: Also discover category/editorial sub-pages and extract their articles
    const categoryPages = this.discoverCategoryPages(listing.html, baseUrl);
    for (const catUrl of categoryPages) {
      try {
        const catHtml = await this.fetchPage(catUrl);
        const catLinks = this.extractArticleLinks(catHtml, baseUrl);
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

    // Step 3: Try to extract dates from the listing page first
    const today = this._getTodayString();
    const listingDates = this._extractListingDates(listing.html, links, baseUrl);

    // Step 4: Fetch articles - prioritize those that appear to be from today
    for (const articleUrl of links) {
      try {
        // If we got a date from the listing and it's not today, skip
        const listingDate = listingDates.get(articleUrl);
        if (listingDate && !this._isToday(listingDate)) {
          continue;
        }

        const article = await this._fetchArticle(articleUrl, site, baseUrl);
        if (!article) continue;

        // If date is confirmed and it's today -> include
        // If date is confirmed and NOT today -> skip
        // If no date -> include (first page of listing = likely recent)
        if (article.publishedAt) {
          if (this._isToday(article.publishedAt)) {
            articles.push(article);
          }
          // confirmed not today -> skip
        } else if (!listingDate) {
          // no date anywhere -> include (trust listing page recency)
          articles.push(article);
        }
      } catch (err) {
        errors.push({
          type: 'article_fetch',
          url: articleUrl,
          message: err.message
        });
      }
    }

    return { articles, errors };
  }

  /**
   * Get today's date string in YYYY-MM-DD format.
   */
  _getTodayString() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Check if a date string (ISO or parsed) is today.
   */
  _isToday(dateStr) {
    if (!dateStr) return false;
    const today = this._getTodayString();
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      return d.toISOString().split('T')[0] === today;
    } catch {
      return false;
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
   * Fetch a single article page and extract title, date, content.
   */
  async _fetchArticle(url, site, baseUrl) {
    const html = await this.fetchPage(url);
    const $ = this.loadHTML(html);

    const title = this._extractTitle($, site.name);
    if (!title) return null;

    const dateRaw = this._extractDate($, html);
    let publishedAt = this.parseBrazilianDate(dateRaw);
    const content = this._extractContent($);
    const cleanTitle = this.cleanText(title);
    const cleanContent = this.cleanText(content) || null;

    // If regex failed to find date: use LLM as fallback
    if (!publishedAt) {
      const pageText = $('body').text().replace(/\s+/g, ' ').trim();
      const llmResult = await extractWithLLM(cleanTitle, pageText, url);

      // LLM says it's not a news article → reject
      if (!llmResult.isNews) return null;

      // LLM found a date when regex didn't
      if (llmResult.date) {
        publishedAt = llmResult.date;
      }
    }

    // Classify, summarize, and rate with LLM (single call)
    const { summary, category, relevanceScore } = await classifyAndSummarize(cleanTitle, cleanContent);

    return {
      title: cleanTitle,
      url: this.ensureProtocol(url),
      publishedAt,
      summary,
      category,
      relevanceScore,
      content: cleanContent,
      municipalityId: site.id || null,
      scrapedAt: new Date().toISOString()
    };
  }

  /**
   * Extract article title using multiple selectors.
   */
  _extractTitle($, siteName) {
    for (const selector of TITLE_SELECTORS) {
      const el = $(selector).first();
      if (!el.length) continue;

      const text = el.text().trim();
      if (!text) continue;

      if (selector === 'h1' || selector === '.container h1' || selector === '.content h1') {
        const lower = text.toLowerCase().trim();
        const isBlacklisted = TITLE_BLACKLIST.some(bl => lower === bl);
        const isSiteName = siteName && lower === siteName.toLowerCase().trim();
        if (isBlacklisted || isSiteName) continue;
      }

      return text;
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
        // Only accept text that looks like a parseable date (must contain a year)
        if (text && /\d{4}/.test(text)) return text;
        // Accept DD/MM/YYYY format
        if (text && /\d{1,2}\/\d{1,2}\/\d{4}/.test(text)) return text;
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

      // Try DD/MM/YYYY first
      const slashMatch = plainText.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
      if (slashMatch) return slashMatch[0];

      // Try "DD de mês de YYYY"
      const longMatch = plainText.match(/\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/i);
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
        /^(início|home|notícias?|noticias?|voltar|anterior|próximo|compartilhar|tweetar|curtir|enviar|imprimir|whatsapp|facebook|twitter|instagram|linkedin)$/i,
        /^(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|\d{4})$/i,
        /^(menu|buscar|pesquisar|acessibilidade|aumentar|diminuir|fonte|alto contraste|libras|atalhos)$/i,
        /^atualizada?\s+dia/i,
        /^compartilhe/i,
        /^publicado\s+em/i,
        /^tags?:/i,
      ];

      const filtered = paragraphs.map(p => p.replace(/^[>\s]+/, '').trim()).filter(p => {
        if (p.length < 4) return false;
        return !NOISE_PATTERNS.some(re => re.test(p));
      });

      return filtered.join('\n\n');
    }

    for (const selector of CONTENT_SELECTORS) {
      const el = $(selector).first();
      if (!el.length) continue;

      const text = htmlToText(el);
      if (text && text.length > 50) return text;
    }

    // Fallback: try body
    const body = $('body').clone();
    if (body.length) {
      const text = htmlToText(body);
      if (text && text.length > 100) return text.substring(0, 10000);
    }

    return null;
  }
}

module.exports = GovBrScraper;
