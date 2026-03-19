#!/usr/bin/env node

/**
 * Site Discovery Script
 *
 * Scans all active municipalities in the database and discovers:
 * - News listing page URL
 * - Number of article links found
 * - Sample article extraction (title, date, content presence)
 * - Detected CMS platform
 *
 * Usage: node src/scrapers/discover.js
 * Output: data/site-mappings.json
 */

const path = require('path');
const fs = require('fs');

// Load env before config
require('dotenv').config();

const { getDb, closeDb } = require('../db/connection');
const { getActiveMunicipalities } = require('../db/queries');
const BaseScraper = require('./BaseScraper');
const GovBrScraper = require('./GovBrScraper');

const CONCURRENCY = 5;
const LOG_INTERVAL = 25;
const OUTPUT_FILE = path.resolve(process.cwd(), 'data/site-mappings.json');

/**
 * Detect the CMS platform from HTML content.
 * @param {string} html
 * @returns {string}
 */
function detectPlatform(html) {
  if (!html) return 'unknown';
  const lower = html.toLowerCase();

  if (lower.includes('cittaweb') || lower.includes('citta.com.br')) return 'cittaweb';
  if (lower.includes('wp-content') || lower.includes('wordpress')) return 'wordpress';
  if (lower.includes('__nuxt') || lower.includes('nuxt')) return 'nuxt';
  if (lower.includes('livewire') || lower.includes('laravel')) return 'laravel';
  if (lower.includes('plone') || lower.includes('portal_css')) return 'plone';
  if (lower.includes('webde') || lower.includes('webdesenvolve')) return 'webde';
  if (lower.includes('bootstrap') && !lower.includes('wp-content')) return 'bootstrap';

  return 'unknown';
}

/**
 * Discover a single site and return its mapping.
 */
async function discoverSite(scraper, site) {
  const baseUrl = scraper.ensureProtocol(site.site_url).replace(/\/+$/, '');
  const result = {
    status: 'failed',
    newsUrl: null,
    articleCount: 0,
    sampleArticle: null,
    platform: 'unknown',
    error: null,
  };

  try {
    // Step 1: Discover listing page
    const listing = await scraper.discoverNewsPage(baseUrl);
    if (!listing) {
      result.error = 'No news listing page found';
      return result;
    }

    result.newsUrl = listing.url;
    result.platform = detectPlatform(listing.html);

    // Step 2: Extract article links
    const links = scraper.extractArticleLinks(listing.html, baseUrl);
    result.articleCount = links.length;

    if (links.length === 0) {
      result.status = 'partial';
      result.error = 'Listing found but no article links matched patterns';
      return result;
    }

    // Step 3: Try to fetch first article as sample using GovBrScraper pipeline
    const sampleUrl = links[0];
    try {
      const govScraper = new GovBrScraper({
        REQUEST_TIMEOUT_MS: scraper.timeout,
        MAX_RETRIES: scraper.maxRetries,
        RETRY_BASE_DELAY_MS: scraper.retryBaseDelay,
      });
      const siteObj = { id: null, name: '', site_url: site.site_url };
      const article = await govScraper._fetchArticle(sampleUrl, siteObj, baseUrl);

      result.sampleArticle = {
        url: sampleUrl,
        title: article ? (article.title || '').substring(0, 120) : null,
        date: article ? article.publishedAt : null,
        hasContent: article ? !!(article.content && article.content.length > 50) : false,
      };

      result.status = (article && article.title) ? 'ok' : 'partial';
    } catch (err) {
      result.status = 'partial';
      result.error = `Listing OK (${links.length} links) but sample article fetch failed: ${err.message}`;
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

/**
 * Run discovery on all active municipalities with concurrency control.
 */
async function main() {
  console.log('Starting site discovery...');

  const db = getDb();

  // Ensure tables exist and are seeded
  const { runMigrations } = require('../db/migrations');
  const { seedMunicipalities } = require('../db/seed');
  runMigrations(db);
  seedMunicipalities(db);

  const municipalities = getActiveMunicipalities(db);
  console.log(`Found ${municipalities.length} active municipalities`);

  if (municipalities.length === 0) {
    console.log('No active municipalities. Exiting.');
    closeDb();
    return;
  }

  const scraper = new BaseScraper({
    REQUEST_TIMEOUT_MS: 15000,
    MAX_RETRIES: 1,
    RETRY_BASE_DELAY_MS: 1000,
  });

  const mappings = {};
  let completed = 0;
  let okCount = 0;
  let partialCount = 0;
  let failedCount = 0;

  // Process with concurrency limit using simple batching
  const pLimitModule = await import('p-limit');
  const limit = pLimitModule.default(CONCURRENCY);

  const tasks = municipalities.map(site =>
    limit(async () => {
      const key = site.site_url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      const result = await discoverSite(scraper, site);
      mappings[key] = result;

      completed++;
      if (result.status === 'ok') okCount++;
      else if (result.status === 'partial') partialCount++;
      else failedCount++;

      if (completed % LOG_INTERVAL === 0 || completed === municipalities.length) {
        console.log(
          `Progress: ${completed}/${municipalities.length} | ` +
          `OK: ${okCount} | Partial: ${partialCount} | Failed: ${failedCount}`
        );
      }
    })
  );

  await Promise.all(tasks);

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write results
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mappings, null, 2), 'utf8');
  console.log(`\nDiscovery complete. Results saved to ${OUTPUT_FILE}`);
  console.log(`Summary: ${okCount} OK | ${partialCount} partial | ${failedCount} failed out of ${municipalities.length} sites`);

  closeDb();
}

main().catch(err => {
  console.error('Discovery failed:', err);
  closeDb();
  process.exit(1);
});
