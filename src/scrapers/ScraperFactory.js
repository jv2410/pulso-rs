const fs = require('fs');
const path = require('path');
const GovBrScraper = require('./GovBrScraper');
const AtendeNetScraper = require('./AtendeNetScraper');
const GenericScraper = require('./GenericScraper');

let _overridesCache = null;
function loadOverrides() {
  if (_overridesCache !== null) return _overridesCache;
  try {
    _overridesCache = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'news-url-overrides.json'), 'utf8'));
  } catch {
    _overridesCache = {};
  }
  return _overridesCache;
}

/**
 * Return the appropriate scraper instance for a given site.
 * Considers the news_url override too — if a city's override points to
 * atende.net, use AtendeNetScraper even when site_url in DB says otherwise.
 * @param {object} site - { id, name, site_url, category }
 * @param {object} config - scraper config (timeouts, retries, etc.)
 * @returns {BaseScraper}
 */
function getScraperForSite(site, config = {}) {
  const overrides = loadOverrides();
  const ovEntry = site.name && overrides[site.name];
  // Override entry can be a plain URL string or an object { url, scraper }
  const overrideUrl = typeof ovEntry === 'string' ? ovEntry : (ovEntry && ovEntry.url) || null;
  const overrideForcedScraper = typeof ovEntry === 'object' && ovEntry && ovEntry.scraper;

  if (overrideForcedScraper === 'atendenet') return new AtendeNetScraper(config);
  if (overrideForcedScraper === 'govbr') return new GovBrScraper(config);
  if (overrideForcedScraper === 'generic') return new GenericScraper(config);

  const effective = overrideUrl || site.site_url || '';
  // Heuristic: AtendeNet portals use the path /cidadao/noticia even when
  // hosted on a custom .gov.br domain. Treat as AtendeNet (needs Playwright).
  if (site.category === 'atende.net' || effective.includes('atende.net') || /\/cidadao\/noticias?(\/|$)/.test(effective)) {
    return new AtendeNetScraper(config);
  }
  if (site.category === 'gov.br' || effective.includes('.gov.br')) {
    return new GovBrScraper(config);
  }
  return new GenericScraper(config);
}

module.exports = { getScraperForSite };
