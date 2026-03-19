const GovBrScraper = require('./GovBrScraper');

/**
 * AtendeNet scraper - extends GovBrScraper.
 *
 * Previously overrode fetchPage for SSL bypass, but BaseScraper now
 * bypasses SSL for all sites by default. Kept as a separate class
 * for routing/classification purposes.
 */
class AtendeNetScraper extends GovBrScraper {}

module.exports = AtendeNetScraper;
