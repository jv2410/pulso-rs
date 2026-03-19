# Architecture: Municipal News Scraping System

**Version:** 1.0
**Date:** 2026-03-15
**Author:** Aria (System Architect)
**Status:** Draft

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Module Structure](#3-module-structure)
4. [Scraping Strategy](#4-scraping-strategy)
5. [Concurrency & Rate Limiting](#5-concurrency--rate-limiting)
6. [Error Handling](#6-error-handling)
7. [Data Flow](#7-data-flow)
8. [Database Schema](#8-database-schema)
9. [Configuration](#9-configuration)
10. [Future Cloud Migration Notes](#10-future-cloud-migration-notes)

---

## 1. System Overview

The system scrapes news articles from approximately 497 municipal government websites in Rio Grande do Sul (RS), Brazil. It runs daily on a local machine, storing results in SQLite. The architecture prioritizes resilience (tolerating individual site failures), efficiency (controlled concurrency), and simplicity (minimal dependencies, zero external services).

### High-Level Flow

```
  +------------------+
  |    node-cron     |
  |  (Daily Trigger) |
  +--------+---------+
           |
           v
  +--------+---------+
  |   Orchestrator    |
  |  Load site list   |
  |  Select strategy  |
  +--------+---------+
           |
           v
  +--------+----------+      +-------------------+
  |  Concurrency Pool  | --> |  Rate Limiter      |
  |  (p-limit, max 10) |     |  (per-domain delay)|
  +---------+----------+     +-------------------+
            |
            v
  +---------+-------------------------------------------+
  |              Scraper Strategy Layer                   |
  |                                                      |
  |  +----------------+  +----------------+  +--------+  |
  |  | GovBrScraper   |  | AtendeNet      |  | Generic|  |
  |  | *.rs.gov.br    |  | Scraper        |  | Scraper|  |
  |  | (~443 sites)   |  | *.atende.net   |  | (~24)  |  |
  |  |                |  | (~30 sites)    |  |        |  |
  |  +----------------+  +----------------+  +--------+  |
  +----------------------+-------------------------------+
                         |
                         v
               +---------+---------+
               |   Data Pipeline    |
               |                    |
               |  Normalize  -->    |
               |  Deduplicate -->   |
               |  Store             |
               +---------+---------+
                         |
                         v
               +---------+---------+
               |      SQLite        |
               |  (better-sqlite3)  |
               +--------------------+

  Logging (pino) -----> logs/scraper-YYYY-MM-DD.log
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite over PostgreSQL | Zero config, single file, fast synchronous access, good enough for ~500 sites |
| axios + cheerio over Puppeteer | 95%+ of target sites are server-rendered HTML; no need for a headless browser |
| Strategy pattern for scrapers | Sites cluster into 3 clear patterns; extensible for new patterns later |
| p-limit over worker threads | I/O-bound workload (HTTP requests); concurrency control is sufficient without parallelism |
| pino over winston | Lower overhead, structured JSON logs, better for later cloud ingestion |

---

## 2. Tech Stack

### Runtime

| Component | Choice | Version | Purpose |
|-----------|--------|---------|---------|
| Runtime | Node.js | >= 18 LTS | JavaScript runtime |
| Package Manager | npm | >= 9 | Dependency management |

### Core Dependencies

| Package | Purpose | Notes |
|---------|---------|-------|
| `axios` | HTTP client | Handles redirects, timeouts, custom headers |
| `cheerio` | HTML parsing | jQuery-like API, fast DOM traversal |
| `better-sqlite3` | Database | Synchronous, fast, embedded, zero config |
| `node-cron` | Scheduling | Cron syntax, local scheduler |
| `p-limit` | Concurrency control | Limits parallel async operations |
| `pino` | Logging | Structured JSON, low overhead |
| `pino-pretty` | Log formatting | Human-readable logs in development |

### Dev Dependencies

| Package | Purpose |
|---------|---------|
| `jest` | Unit and integration testing |
| `nodemon` | Auto-restart during development |
| `dotenv` | Environment variable loading |

---

## 3. Module Structure

```
automation-scraper/
|-- package.json
|-- .env                          # Environment config (not committed)
|-- .env.example                  # Template for .env
|-- .gitignore
|
|-- src/
|   |-- index.js                  # Entry point: scheduler setup, orchestrator boot
|   |
|   |-- config/
|   |   |-- index.js              # Central config export (merges env + defaults)
|   |   |-- defaults.js           # Default values (concurrency, timeouts, retries)
|   |   |-- sites.js              # Site list loader (reads from data/sites.xlsx or JSON)
|   |
|   |-- db/
|   |   |-- connection.js         # SQLite connection singleton (better-sqlite3)
|   |   |-- migrations.js         # Schema creation and versioned migrations
|   |   |-- queries.js            # Prepared statements: insert article, check duplicate, etc.
|   |
|   |-- scrapers/
|   |   |-- BaseScraper.js        # Abstract base class with shared logic
|   |   |-- GovBrScraper.js       # Strategy for *.rs.gov.br /noticias pages
|   |   |-- AtendeNetScraper.js   # Strategy for *.atende.net (SSL bypass)
|   |   |-- GenericScraper.js     # Fallback heuristic scraper
|   |   |-- ScraperFactory.js     # Selects correct scraper based on site URL
|   |
|   |-- orchestrator/
|   |   |-- index.js              # Main scraping loop: load sites, dispatch, collect results
|   |   |-- rateLimiter.js        # Per-domain delay enforcement
|   |
|   |-- utils/
|       |-- logger.js             # pino logger setup with file + console transports
|       |-- dateParser.js         # Brazilian date format parsing (DD/MM/YYYY, etc.)
|       |-- urlNormalizer.js      # Resolve relative URLs, strip tracking params
|       |-- textCleaner.js        # Strip HTML artifacts, normalize whitespace
|
|-- data/
|   |-- sites.xlsx                # Source spreadsheet with ~497 municipality URLs
|   |-- scraper.db                # SQLite database file (auto-created)
|
|-- logs/                         # Daily rotating log files
|
|-- tests/
|   |-- scrapers/                 # Unit tests for each scraper strategy
|   |-- utils/                    # Unit tests for utilities
|   |-- db/                       # Integration tests for database layer
|
|-- docs/
    |-- architecture.md           # This document
```

### Module Responsibilities

#### `src/index.js` (Entry Point)
- Loads environment variables via dotenv
- Initializes database (runs migrations if needed)
- Registers cron job(s) for daily scraping
- Exposes a manual trigger for development/testing
- Handles graceful shutdown (SIGINT/SIGTERM)

#### `src/orchestrator/` (Coordination)
- Loads the full site list from config
- For each site, selects the appropriate scraper via ScraperFactory
- Dispatches scraping tasks through the concurrency pool (p-limit)
- Enforces per-domain rate limiting
- Aggregates results and error reports
- Logs summary statistics after each run

#### `src/scrapers/` (Data Extraction)
- Each scraper implements a common interface: `scrape(siteUrl) -> Article[]`
- BaseScraper provides shared HTTP fetching, retry logic, and DOM loading
- Specialized scrapers implement site-specific selectors and navigation

#### `src/db/` (Persistence)
- connection.js: Creates and caches the SQLite connection
- migrations.js: Creates tables on first run, applies schema changes
- queries.js: All SQL is centralized here as prepared statements

#### `src/utils/` (Cross-Cutting)
- Pure utility functions, no side effects, fully testable

---

## 4. Scraping Strategy

The system uses the **Strategy pattern** to handle different site structures. A `ScraperFactory` maps site URLs to the appropriate scraper class.

### 4.1 ScraperFactory Selection Logic

```
Input: site URL
  |
  +--> URL contains ".rs.gov.br"?
  |      YES --> GovBrScraper
  |
  +--> URL contains ".atende.net"?
  |      YES --> AtendeNetScraper
  |
  +--> Otherwise
         --> GenericScraper
```

### 4.2 BaseScraper (Abstract)

Shared behavior inherited by all scrapers:

- **fetchPage(url):** HTTP GET with configured timeout, headers, and retry logic
- **parseHTML(html):** Load into cheerio for DOM traversal
- **extractText(element):** Clean text extraction from a DOM node
- **buildAbsoluteUrl(relative, base):** Resolve relative links against base URL

### 4.3 GovBrScraper (~443 sites)

Target pattern: `https://{municipio}.rs.gov.br/noticias`

**Step 1 -- Fetch listing page:**
- Navigate to `/noticias` or `/noticias?page=1`
- Look for article links in common selectors:
  - `.noticia-item a`, `.lista-noticias a`, `article a`, `.news-list a`
- Extract article URLs and listing-page dates (if visible)

**Step 2 -- Paginate (if needed):**
- Check for pagination: `.pagination`, `.paginacao`, `?page=N`
- Fetch up to N pages (configurable, default 3) to catch recent articles
- Stop early if articles are older than the configured lookback window

**Step 3 -- Fetch each article:**
- GET the full article page
- Extract: title (`h1`, `.titulo-noticia`), date (meta tags, `.data-publicacao`), raw content (`.conteudo-noticia`, `article`, `.texto`)

**Step 4 -- Return normalized articles**

### 4.4 AtendeNetScraper (~30 sites)

Target pattern: `https://{municipio}.atende.net`

**Key differences from GovBrScraper:**
- SSL certificate issues are common; must configure axios to bypass certificate validation **only for these domains** (`httpsAgent` with `rejectUnauthorized: false`)
- Different DOM structure: look for `.listagem-noticias`, `.noticia-titulo`
- Date formats may differ
- Some sites use AJAX/API endpoints for news listing

**Step 1-4:** Same flow as GovBrScraper but with atende.net-specific selectors and SSL handling.

### 4.5 GenericScraper (~24 sites, fallback)

For `.com.br` domains and any unrecognized patterns.

**Heuristic approach:**
1. Fetch the site root or a known `/noticias` path
2. Look for common news patterns:
   - Links containing keywords: `noticia`, `news`, `post`, `materia`
   - Structured data: `<script type="application/ld+json">` with `NewsArticle` schema
   - RSS/Atom feeds: `<link rel="alternate" type="application/rss+xml">`
3. Extract what is possible; log warnings for sites that need manual selector configuration
4. Fall back to a configurable per-site selector map (`data/custom-selectors.json`) for sites that require manual tuning

### 4.6 Common Interface

All scrapers implement:

```
class BaseScraper {
  async scrape(site)             -> { articles: Article[], errors: Error[] }
  async fetchListingPage(url)    -> cheerio document
  async extractArticleLinks(doc) -> string[]
  async fetchArticle(url)        -> Article
}

Article {
  municipality: string     // e.g., "Porto Alegre"
  title: string            // Article headline
  url: string              // Canonical article URL
  publishedDate: Date      // Parsed publication date
  rawContent: string       // Full article text (no HTML)
  scrapedAt: Date          // Timestamp of scraping
}
```

---

## 5. Concurrency & Rate Limiting

### 5.1 Concurrency Pool

- **Library:** `p-limit`
- **Max concurrent requests:** 10 (configurable via `CONCURRENCY_LIMIT` env var)
- All scraping tasks are wrapped in the limiter before execution
- This limits HTTP requests in flight, not sites being processed simultaneously

### 5.2 Per-Domain Rate Limiting

```
Domain Rate Limiter
  |
  +-- Map<domain, lastRequestTimestamp>
  |
  +-- Before each request to domain X:
  |     elapsed = now - lastRequest[X]
  |     if elapsed < MIN_DELAY (1500ms):
  |       await sleep(MIN_DELAY - elapsed)
  |     lastRequest[X] = now
```

- **Minimum delay between requests to the same domain:** 1500ms (configurable)
- Prevents overwhelming any single server
- Different domains can be fetched in parallel

### 5.3 Retry with Exponential Backoff

```
Attempt 1: immediate
Attempt 2: wait 2 seconds
Attempt 3: wait 4 seconds
(give up after 3 attempts)
```

| Parameter | Value |
|-----------|-------|
| Max retries | 3 |
| Base delay | 2000ms |
| Multiplier | 2x |
| Max delay cap | 10000ms |
| Retryable status codes | 429, 500, 502, 503, 504 |
| Retryable errors | ECONNRESET, ETIMEDOUT, ECONNREFUSED |

### 5.4 Request Timeout

- **Per-request timeout:** 30 seconds
- Applied at the axios level via `timeout: 30000`
- If a site consistently times out, it will exhaust retries and be logged as failed

### 5.5 Estimated Run Time

With 497 sites, ~3 pages per site, ~5 articles per page:
- ~497 listing pages + ~1,491 pagination pages + ~7,455 article pages = ~9,443 requests
- At 10 concurrent with ~1.5s average (including delays): ~24 minutes estimated
- With retries and failures: **30-45 minutes per full run** (acceptable for daily schedule)

---

## 6. Error Handling

### 6.1 Design Principle: Fail Per Site, Never Globally

A failure in one site must never halt the entire scraping run. Every site is wrapped in a try/catch at the orchestrator level.

### 6.2 Error Categories

| Category | Examples | Action |
|----------|----------|--------|
| **Network** | Timeout, DNS failure, connection refused | Retry with backoff, then log and skip |
| **HTTP** | 403 Forbidden, 404 Not Found, 500 Server Error | Log status, skip (retryable 5xx get retried) |
| **SSL** | Certificate expired, self-signed | Use SSL bypass for atende.net; log for others |
| **Parse** | No articles found, unexpected DOM structure | Log warning, return empty result |
| **Data** | Missing title, unparseable date | Store with null fields, log warning |

### 6.3 Error Tracking Table

Each scraping run logs per-site results to an `scrape_runs` table:

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Auto-increment |
| site_url | TEXT | The site that was scraped |
| run_date | TEXT | ISO date of the run |
| status | TEXT | 'success', 'partial', 'failed' |
| articles_found | INTEGER | Number of articles extracted |
| error_message | TEXT | Error details if failed |
| duration_ms | INTEGER | Time taken for this site |

### 6.4 Logging Strategy

**Structured JSON logging with pino:**

- **Level INFO:** Scraping started/completed, articles stored, run summary
- **Level WARN:** No articles found, parse anomalies, missing fields
- **Level ERROR:** HTTP failures after retries, SSL errors, unexpected exceptions

**Log output:**
- Console: human-readable via pino-pretty (development)
- File: JSON lines to `logs/scraper-YYYY-MM-DD.log` (production)

**Run summary log (emitted after each full run):**

```json
{
  "level": "info",
  "msg": "Scraping run complete",
  "totalSites": 497,
  "successful": 482,
  "partial": 8,
  "failed": 7,
  "articlesStored": 1247,
  "duplicatesSkipped": 342,
  "durationMinutes": 38.2
}
```

---

## 7. Data Flow

### 7.1 Pipeline Stages

```
[1. Fetch]     HTTP GET raw HTML from site
     |
     v
[2. Parse]     cheerio loads HTML, scraper extracts fields
     |
     v
[3. Normalize]  Clean text, parse dates, resolve URLs
     |
     v
[4. Dedupe]    Check article URL against database (UNIQUE constraint)
     |
     v
[5. Store]     INSERT into SQLite articles table
     |
     v
[6. Log]       Record result in scrape_runs table
```

### 7.2 Normalization Rules

| Field | Normalization |
|-------|--------------|
| **title** | Trim whitespace, collapse multiple spaces, limit to 500 chars |
| **url** | Resolve relative to absolute, remove tracking params (utm_*), remove trailing slash, lowercase domain |
| **publishedDate** | Parse BR formats: "DD/MM/YYYY", "DD de mes de YYYY", ISO 8601; store as ISO string |
| **rawContent** | Strip HTML tags, decode entities, collapse whitespace, trim; no length limit |
| **municipality** | Mapped from site config (not extracted from page) |

### 7.3 Deduplication

- **Primary deduplication:** UNIQUE constraint on `article_url` column
- **Insert strategy:** `INSERT OR IGNORE` -- silently skips duplicates
- **Implication:** First scrape wins; if an article is updated, the original version is kept
- **Future option:** `INSERT OR REPLACE` if content freshness matters later

---

## 8. Database Schema

### articles

```sql
CREATE TABLE IF NOT EXISTS articles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  municipality  TEXT    NOT NULL,
  title         TEXT    NOT NULL,
  article_url   TEXT    NOT NULL UNIQUE,
  published_date TEXT,
  raw_content   TEXT,
  scraped_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  site_url      TEXT    NOT NULL
);

CREATE INDEX idx_articles_municipality ON articles(municipality);
CREATE INDEX idx_articles_published_date ON articles(published_date);
CREATE INDEX idx_articles_scraped_at ON articles(scraped_at);
```

### scrape_runs

```sql
CREATE TABLE IF NOT EXISTS scrape_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  site_url        TEXT    NOT NULL,
  run_date        TEXT    NOT NULL,
  status          TEXT    NOT NULL CHECK(status IN ('success', 'partial', 'failed')),
  articles_found  INTEGER DEFAULT 0,
  error_message   TEXT,
  duration_ms     INTEGER,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_scrape_runs_run_date ON scrape_runs(run_date);
CREATE INDEX idx_scrape_runs_status ON scrape_runs(status);
```

### sites (optional, if migrating from xlsx to DB)

```sql
CREATE TABLE IF NOT EXISTS sites (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  municipality  TEXT    NOT NULL,
  site_url      TEXT    NOT NULL UNIQUE,
  scraper_type  TEXT    NOT NULL DEFAULT 'auto',
  active        INTEGER NOT NULL DEFAULT 1,
  notes         TEXT
);
```

---

## 9. Configuration

### Environment Variables (.env)

```bash
# Scheduling
CRON_SCHEDULE=0 6 * * *          # Run daily at 6:00 AM

# Concurrency
CONCURRENCY_LIMIT=10              # Max parallel HTTP requests
DOMAIN_DELAY_MS=1500              # Min delay between same-domain requests

# Retry
MAX_RETRIES=3                     # Retry attempts per request
RETRY_BASE_DELAY_MS=2000          # Base delay for exponential backoff

# Timeout
REQUEST_TIMEOUT_MS=30000          # Per-request timeout

# Scraping
MAX_PAGES_PER_SITE=3              # Max pagination pages to follow
LOOKBACK_DAYS=7                   # Ignore articles older than N days

# Database
DB_PATH=./data/scraper.db         # SQLite database file path

# Logging
LOG_LEVEL=info                    # pino log level
LOG_DIR=./logs                    # Log file directory
```

### defaults.js

All values above have sensible defaults in `src/config/defaults.js`. Environment variables override defaults. This allows running with zero configuration.

---

## 10. Future Cloud Migration Notes

### 10.1 Database: SQLite to PostgreSQL

| Aspect | Current (Local) | Future (Cloud) |
|--------|-----------------|----------------|
| Engine | better-sqlite3 | pg (node-postgres) |
| Connection | File path | Connection string (DATABASE_URL) |
| Queries | Synchronous | Async (await pool.query) |
| Schema | Same SQL | Minor syntax changes (AUTOINCREMENT -> SERIAL, datetime -> TIMESTAMP) |
| Migrations | Custom script | Use knex.js or similar migration tool |

**Migration strategy:**
1. Introduce a `db/adapter.js` that wraps database calls behind an interface
2. Create a PostgreSQL adapter that implements the same interface
3. Switch adapters via environment variable (`DB_ENGINE=sqlite|postgres`)
4. Export existing SQLite data to CSV, import into PostgreSQL

### 10.2 Scheduler: node-cron to Cloud

| Aspect | Current (Local) | Future (Cloud) |
|--------|-----------------|----------------|
| Scheduler | node-cron (in-process) | AWS EventBridge / Cloud Scheduler |
| Execution | Long-running Node.js process | AWS Lambda / Cloud Function / Cloud Run |
| Concurrency | Single process, p-limit | Multiple invocations or Step Functions |
| Monitoring | Log files | CloudWatch / Cloud Logging |

**Migration strategy:**
1. Extract the orchestrator into a standalone function that can be invoked independently of the scheduler
2. The orchestrator already returns results -- adapt this to return a structured response for the cloud function
3. For Lambda: split into two functions -- (a) dispatcher that fans out site URLs to SQS, (b) worker that scrapes one site per invocation
4. For simpler migration: deploy as a single Cloud Run job triggered by Cloud Scheduler

### 10.3 Incremental Migration Path

```
Phase 1 (Current):  Local machine + SQLite + node-cron
                    |
Phase 2:            Local machine + PostgreSQL (hosted, e.g., Supabase)
                    + node-cron (still local)
                    |
Phase 3:            Cloud Run Job + PostgreSQL
                    + Cloud Scheduler trigger
                    |
Phase 4 (Scale):    Cloud Functions + SQS/Pub-Sub fan-out
                    + PostgreSQL + monitoring dashboard
```

### 10.4 Design Decisions That Ease Migration

1. **All config via environment variables** -- same code runs locally or in cloud
2. **No global state** -- orchestrator is a pure function (sites in, results out)
3. **Structured JSON logging** -- directly ingestible by cloud logging services
4. **Database queries centralized in queries.js** -- single file to swap for PostgreSQL adapter
5. **Stateless scrapers** -- each scraper call is independent, parallelizable across cloud functions

---

## Appendix A: Request Flow Sequence

```
Orchestrator                 ScraperFactory             GovBrScraper              SQLite
     |                            |                          |                      |
     |-- getScraperFor(url) ----->|                          |                      |
     |<-- GovBrScraper instance --|                          |                      |
     |                                                       |                      |
     |-- scraper.scrape(site) -------------------------------->|                     |
     |                                                       |-- GET /noticias      |
     |                                                       |<-- HTML response     |
     |                                                       |-- parse listing      |
     |                                                       |-- GET /noticia/123   |
     |                                                       |<-- HTML response     |
     |                                                       |-- extract fields     |
     |<-- { articles: [...], errors: [...] } ----------------|                      |
     |                                                                              |
     |-- db.insertArticle(article) ------------------------------------------------>|
     |<-- (inserted or ignored if duplicate) ---------------------------------------|
     |                                                                              |
     |-- db.insertScrapeRun(result) ----------------------------------------------->|
     |<-- ok -------------------------------------------------------------------- --|
```

## Appendix B: Site Distribution

| Pattern | Count | Scraper | Notes |
|---------|-------|---------|-------|
| *.rs.gov.br | ~443 | GovBrScraper | Most standardized, /noticias pattern |
| *.atende.net | ~30 | AtendeNetScraper | SSL issues common, different DOM |
| *.com.br and others | ~24 | GenericScraper | Requires heuristics or manual config |
| **Total** | **~497** | | |
