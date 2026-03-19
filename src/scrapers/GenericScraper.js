const GovBrScraper = require('./GovBrScraper');

/**
 * RSS feed paths to try as a fallback when HTML scraping finds nothing.
 */
const RSS_PATHS = ['/feed', '/rss', '/rss.xml', '/feed.xml', '/noticias/feed'];

/**
 * Generic scraper for non-gov.br / non-atende.net sites.
 * Inherits all discovery and extraction from GovBrScraper,
 * adds RSS feed detection as a fallback.
 */
class GenericScraper extends GovBrScraper {
  /**
   * Scrape with discovery-first approach, falling back to RSS.
   */
  async scrape(site) {
    // Try the standard discovery-first approach
    const result = await super.scrape(site);

    // If we found articles, return them
    if (result.articles.length > 0) return result;

    // Fallback: try RSS feeds
    const baseUrl = this.ensureProtocol(site.site_url).replace(/\/+$/, '');
    const rssArticles = await this._tryRSS(baseUrl, site);

    if (rssArticles.length > 0) {
      return {
        articles: rssArticles,
        errors: [] // Clear errors since RSS worked
      };
    }

    // Nothing worked - return original errors
    return result;
  }

  /**
   * Try to find and parse an RSS feed.
   * @param {string} baseUrl
   * @param {object} site
   * @returns {Promise<Array>}
   */
  async _tryRSS(baseUrl, site) {
    for (const path of RSS_PATHS) {
      try {
        const xml = await this.fetchPage(baseUrl + path);
        const $ = this.loadHTML(xml, { xmlMode: true });
        const articles = [];

        $('item').each((_, item) => {
          const title = $(item).find('title').text().trim();
          const link = $(item).find('link').text().trim();
          const pubDate = $(item).find('pubDate').text().trim();
          const description = $(item).find('description').text().trim();

          if (title && link) {
            articles.push({
              title: this.cleanText(title),
              url: this.ensureProtocol(this.buildAbsoluteUrl(link, baseUrl)),
              publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
              content: this.cleanText(description) || null,
              municipalityId: site.id || null,
              scrapedAt: new Date().toISOString()
            });
          }
        });

        if (articles.length > 0) return articles;
      } catch {
        // Try next RSS path
      }
    }

    return [];
  }
}

module.exports = GenericScraper;
