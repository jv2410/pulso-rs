const path = require('path');
const dotenv = require('dotenv');
const defaults = require('./defaults');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const config = {
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || defaults.CRON_SCHEDULE,
  CONCURRENCY_LIMIT: parseInt(process.env.CONCURRENCY_LIMIT, 10) || defaults.CONCURRENCY_LIMIT,
  DOMAIN_DELAY_MS: parseInt(process.env.DOMAIN_DELAY_MS, 10) || defaults.DOMAIN_DELAY_MS,
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES, 10) || defaults.MAX_RETRIES,
  RETRY_BASE_DELAY_MS: parseInt(process.env.RETRY_BASE_DELAY_MS, 10) || defaults.RETRY_BASE_DELAY_MS,
  REQUEST_TIMEOUT_MS: parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || defaults.REQUEST_TIMEOUT_MS,
  MAX_PAGES_PER_SITE: parseInt(process.env.MAX_PAGES_PER_SITE, 10) || defaults.MAX_PAGES_PER_SITE,
  LOOKBACK_DAYS: parseInt(process.env.LOOKBACK_DAYS, 10) || defaults.LOOKBACK_DAYS,
  DB_PATH: process.env.DB_PATH || defaults.DB_PATH,
  LOG_LEVEL: process.env.LOG_LEVEL || defaults.LOG_LEVEL,
  LOG_DIR: process.env.LOG_DIR || defaults.LOG_DIR,
  USER_AGENT: process.env.USER_AGENT || defaults.USER_AGENT
};

module.exports = config;
