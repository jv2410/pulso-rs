'use strict';

require('dotenv').config();

const cron = require('node-cron');
const config = require('./config');
const { runScraping } = require('./orchestrator');
const logger = require('./utils/logger');

if (process.argv.includes('--now')) {
  // Manual run: execute immediately and exit
  logger.info('Manual scraping triggered');
  runScraping()
    .then((stats) => {
      logger.info({ stats }, 'Scraping complete');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Scraping failed');
      process.exit(1);
    });
} else {
  // Scheduled mode: run on cron schedule
  logger.info({ schedule: config.CRON_SCHEDULE }, 'Scheduler started');

  cron.schedule(config.CRON_SCHEDULE, () => {
    logger.info('Scheduled scraping started');
    runScraping()
      .then((stats) => logger.info({ stats }, 'Scheduled scraping complete'))
      .catch((err) => logger.error({ err }, 'Scheduled scraping failed'));
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down (SIGINT)...');
    try {
      const { getInstance } = require('./scrapers/BrowserPool');
      await getInstance().close();
    } catch {}
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down (SIGTERM)...');
    try {
      const { getInstance } = require('./scrapers/BrowserPool');
      await getInstance().close();
    } catch {}
    process.exit(0);
  });

  logger.info('Automation scraper running. Waiting for next scheduled run...');
  logger.info('Use --now flag to run immediately: node src/index.js --now');
}
