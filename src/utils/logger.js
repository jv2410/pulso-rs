const fs = require('fs');
const path = require('path');
const pino = require('pino');
const config = require('../config');

const logDir = path.resolve(process.cwd(), config.LOG_DIR);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logDir, `scraper-${today}.log`);

const isDev = process.env.NODE_ENV !== 'production';

const targets = [
  // File transport - always active
  {
    target: 'pino/file',
    options: { destination: logFile, mkdir: true },
    level: config.LOG_LEVEL
  }
];

if (isDev) {
  // Pretty console output in development
  targets.push({
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' },
    level: config.LOG_LEVEL
  });
}

const logger = pino({
  level: config.LOG_LEVEL,
  transport: { targets }
});

module.exports = logger;
