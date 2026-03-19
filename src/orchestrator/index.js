'use strict';

const config = require('../config');
const logger = require('../utils/logger');
const { RateLimiter } = require('./rateLimiter');
const { getScraperForSite } = require('../scrapers/ScraperFactory');

/**
 * Extracts the domain (hostname) from a URL string.
 */
function extractDomain(url) {
  try {
    const withProto = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    return new URL(withProto).hostname;
  } catch {
    return url;
  }
}

/**
 * Main scraping orchestration function.
 * Processes all active municipalities, respecting concurrency and rate limits.
 */
async function runScraping() {
  const startTime = Date.now();
  logger.info('Starting scraping run...');

  // 1. Database setup
  const db = require('../db/connection').getDb();

  // 2. Run migrations
  require('../db/migrations').runMigrations(db);
  logger.info('Database migrations complete');

  // 3. Seed municipalities if table is empty
  require('../db/seed').seedMunicipalities(db);

  // 4. Create a new scrape_run record
  const queries = require('../db/queries');
  const runId = queries.createScrapeRun(db);
  logger.info({ runId }, 'Scrape run created');

  // 5. Get all active municipalities
  const municipalities = queries.getActiveMunicipalities(db);
  logger.info({ count: municipalities.length }, 'Active municipalities loaded');

  if (municipalities.length === 0) {
    logger.warn('No active municipalities found. Nothing to scrape.');
    queries.updateScrapeRun(db, runId, {
      finished_at: new Date().toISOString(),
      total_sites: 0, sites_success: 0, sites_failed: 0,
      articles_found: 0, articles_new: 0, status: 'completed'
    });
    return { runId, total: 0, success: 0, failed: 0, articlesFound: 0, articlesNew: 0, durationMs: Date.now() - startTime };
  }

  // 6. Setup concurrency limiter (p-limit is ESM-only)
  const pLimit = (await import('p-limit')).default;
  const limit = pLimit(config.CONCURRENCY_LIMIT);

  // 7. Setup per-domain rate limiter
  const rateLimiter = new RateLimiter(config.DOMAIN_DELAY_MS);

  // Stats tracking
  const stats = {
    runId,
    total: municipalities.length,
    success: 0,
    failed: 0,
    articlesFound: 0,
    articlesNew: 0,
    durationMs: 0,
  };

  let processed = 0;

  // 8. Create limited tasks for each municipality
  const tasks = municipalities.map((municipality) =>
    limit(async () => {
      try {
        const domain = extractDomain(municipality.site_url);

        // Get the appropriate scraper
        const scraper = getScraperForSite(municipality, config);

        // Respect rate limiting per domain
        await rateLimiter.acquire(domain);

        // Execute scraping — returns { articles: [], errors: [] }
        const result = await scraper.scrape(municipality);
        const articles = result.articles || [];
        const errors = result.errors || [];

        let newCount = 0;
        for (const article of articles) {
          try {
            const res = queries.insertArticle(db, {
              municipality_id: municipality.id,
              title: article.title,
              url: article.url,
              published_at: article.publishedAt || null,
              content: article.content || null,
              summary: article.summary || null,
              category: article.category || null,
            });
            // changes > 0 means it was inserted (not ignored as duplicate)
            if (res.changes > 0) newCount++;
          } catch (insertErr) {
            logger.warn({ url: article.url, err: insertErr.message }, 'Failed to insert article');
          }
        }

        stats.success++;
        stats.articlesFound += articles.length;
        stats.articlesNew += newCount;

        if (errors.length > 0) {
          for (const e of errors) {
            logger.warn({ municipality: municipality.name, error: e }, 'Scraper warning');
          }
        }

        logger.debug(
          { municipality: municipality.name, articlesFound: articles.length, articlesNew: newCount },
          'Municipality scraped'
        );
      } catch (err) {
        stats.failed++;

        logger.error(
          { municipality: municipality.name, site: municipality.site_url, err: err.message },
          'Failed to scrape municipality'
        );

        try {
          queries.insertScrapeError(db, {
            run_id: runId,
            municipality_id: municipality.id,
            error_type: classifyError(err),
            error_message: (err.message || '').substring(0, 500),
          });
        } catch (dbErr) {
          logger.error({ err: dbErr.message }, 'Failed to insert scrape error');
        }
      } finally {
        processed++;
        if (processed % 50 === 0 || processed === municipalities.length) {
          logger.info(
            { processed, total: municipalities.length, success: stats.success, failed: stats.failed },
            `Progress: ${processed}/${municipalities.length}`
          );
        }
      }
    })
  );

  // 9. Wait for all tasks
  await Promise.allSettled(tasks);

  // 10. Finalize
  stats.durationMs = Date.now() - startTime;

  queries.updateScrapeRun(db, runId, {
    finished_at: new Date().toISOString(),
    total_sites: stats.total,
    sites_success: stats.success,
    sites_failed: stats.failed,
    articles_found: stats.articlesFound,
    articles_new: stats.articlesNew,
    status: 'completed',
  });

  logger.info(
    {
      ...stats,
      durationMin: (stats.durationMs / 60000).toFixed(2),
    },
    'Scraping run complete'
  );

  return stats;
}

/**
 * Classify error type for database logging.
 */
function classifyError(err) {
  const msg = (err.message || '').toLowerCase();
  const code = err.code || '';
  if (msg.includes('timeout') || code === 'ECONNABORTED') return 'timeout';
  if (msg.includes('ssl') || msg.includes('cert') || code === 'ERR_TLS_CERT_ALTNAME_INVALID') return 'ssl';
  if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'ENOTFOUND') return 'network';
  if (err.response && err.response.status) return 'http';
  if (msg.includes('parse') || msg.includes('selector')) return 'parse';
  return 'unknown';
}

module.exports = { runScraping };
