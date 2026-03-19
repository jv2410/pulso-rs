const GovBrScraper = require('./GovBrScraper');
const AtendeNetScraper = require('./AtendeNetScraper');
const GenericScraper = require('./GenericScraper');

/**
 * Return the appropriate scraper instance for a given site.
 * @param {object} site - { id, name, site_url, category }
 * @param {object} config - scraper config (timeouts, retries, etc.)
 * @returns {BaseScraper}
 */
function getScraperForSite(site, config = {}) {
  if (site.category === 'atende.net' || (site.site_url && site.site_url.includes('atende.net'))) {
    return new AtendeNetScraper(config);
  }
  if (site.category === 'gov.br' || (site.site_url && site.site_url.includes('.gov.br'))) {
    return new GovBrScraper(config);
  }
  return new GenericScraper(config);
}

module.exports = { getScraperForSite };
