# Database Schema - News Scraping System

**Database engine:** SQLite (WAL mode)
**Migration file:** `src/db/migrations/001_initial.sql`

---

## Entity-Relationship Overview

```
municipalities (1) ──< (N) articles
municipalities (1) ──< (N) scrape_errors
scrape_runs    (1) ──< (N) scrape_errors
```

---

## Tables

### 1. `municipalities`

Stores the ~497 municipal government sites in Rio Grande do Sul that the system scrapes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK, AUTOINCREMENT | Unique identifier |
| name | TEXT | NOT NULL, UNIQUE | Municipality name (e.g. "Porto Alegre") |
| association | TEXT | | Regional association (e.g. "FAMURS") |
| site_url | TEXT | NOT NULL | Root URL of the government site |
| news_url | TEXT | | Specific news listing page URL |
| category | TEXT | CHECK IN ('gov.br', 'atende.net', 'com.br', 'other') | Site platform category, used for scraper selection |
| scraper_type | TEXT | | Which scraper strategy to apply (e.g. 'gov_br_v1', 'atende_standard') |
| active | INTEGER | NOT NULL, DEFAULT 1 | Whether to include in scraping runs (0 = skip) |
| created_at | TEXT | NOT NULL, DEFAULT now | ISO 8601 timestamp |
| updated_at | TEXT | NOT NULL, DEFAULT now | ISO 8601 timestamp |

**Rationale:** Separating municipalities from articles lets us manage the list of sites independently. The `category` and `scraper_type` columns let the scraper engine dispatch to the correct parsing strategy without hardcoding. The `active` flag allows temporarily disabling broken sites without deleting them.

**Indexes:**
- `idx_municipalities_category` -- filter sites by platform type
- `idx_municipalities_active` -- quickly select only active sites for a run
- `idx_municipalities_association` -- group/filter by regional association

---

### 2. `articles`

Stores every news article scraped from municipal sites.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK, AUTOINCREMENT | Unique identifier |
| municipality_id | INTEGER | NOT NULL, FK -> municipalities | Source municipality |
| title | TEXT | NOT NULL | Article headline |
| url | TEXT | NOT NULL, UNIQUE | Canonical article URL (dedup key) |
| published_at | TEXT | | ISO 8601 date the article was published (as reported by the site) |
| content | TEXT | | Raw article text |
| scraped_at | TEXT | NOT NULL, DEFAULT now | When our scraper fetched this article |
| created_at | TEXT | NOT NULL, DEFAULT now | Row insertion timestamp |

**Rationale:** The `url` column has a UNIQUE constraint, which serves as the deduplication mechanism. Attempting to INSERT a duplicate URL will fail (use `INSERT OR IGNORE` or check before inserting). The `published_at` is nullable because not all sites expose a clear publication date. `content` is nullable to support a two-phase scrape: first collect URLs/titles from listing pages, then fetch full content later.

**Indexes:**
- UNIQUE on `url` (implicit from constraint) -- deduplication lookups
- `idx_articles_municipality_id` -- filter articles by municipality
- `idx_articles_published_at` -- date-range queries, "latest articles"
- `idx_articles_scraped_at` -- find articles from a specific scraping session

---

### 3. `scrape_runs`

Tracks each execution of the scraping pipeline.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK, AUTOINCREMENT | Unique identifier |
| started_at | TEXT | NOT NULL, DEFAULT now | When the run began |
| finished_at | TEXT | | When the run ended (null while running) |
| total_sites | INTEGER | DEFAULT 0 | Number of sites targeted |
| sites_success | INTEGER | DEFAULT 0 | Sites scraped without error |
| sites_failed | INTEGER | DEFAULT 0 | Sites that produced errors |
| articles_found | INTEGER | DEFAULT 0 | Total articles encountered (including duplicates) |
| articles_new | INTEGER | DEFAULT 0 | New articles actually inserted |
| status | TEXT | NOT NULL, DEFAULT 'running', CHECK IN ('running', 'completed', 'failed') | Current run state |

**Rationale:** This table provides observability. Each daily cron job creates one row. The counters (`articles_found` vs `articles_new`) reveal duplication rates. A run stuck in 'running' status indicates a crash. The `sites_failed` count triggers alerts when it exceeds a threshold.

**Indexes:**
- `idx_scrape_runs_status` -- find active/failed runs
- `idx_scrape_runs_started_at` -- chronological queries

---

### 4. `scrape_errors`

Detailed error log for each site failure within a run.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK, AUTOINCREMENT | Unique identifier |
| run_id | INTEGER | NOT NULL, FK -> scrape_runs | Parent run |
| municipality_id | INTEGER | NOT NULL, FK -> municipalities | Which site failed |
| error_message | TEXT | | Full error message / stack trace |
| error_type | TEXT | CHECK IN ('timeout', 'ssl', 'parse', 'network', 'http', 'unknown') | Error classification |
| occurred_at | TEXT | NOT NULL, DEFAULT now | When the error happened |

**Rationale:** Keeping errors in a separate table (rather than a JSON blob in `scrape_runs`) allows querying patterns: "which sites fail most often?", "is SSL the dominant error type?", "did this municipality start failing after a specific date?". The `error_type` enum enables aggregation and dashboards.

**Indexes:**
- `idx_scrape_errors_run_id` -- list all errors for a run
- `idx_scrape_errors_municipality_id` -- error history for a site
- `idx_scrape_errors_error_type` -- aggregate by error category

---

## Common Query Patterns

### Scraping pipeline

```sql
-- Get all active sites for a scraping run
SELECT id, name, news_url, category, scraper_type
FROM municipalities
WHERE active = 1;

-- Insert article with deduplication (skip if URL exists)
INSERT OR IGNORE INTO articles (municipality_id, title, url, published_at, content, scraped_at)
VALUES (?, ?, ?, ?, ?, ?);

-- Start a new scrape run
INSERT INTO scrape_runs (total_sites) VALUES (?);

-- Finish a scrape run
UPDATE scrape_runs
SET finished_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
    sites_success = ?, sites_failed = ?,
    articles_found = ?, articles_new = ?,
    status = 'completed'
WHERE id = ?;

-- Log an error
INSERT INTO scrape_errors (run_id, municipality_id, error_message, error_type)
VALUES (?, ?, ?, ?);
```

### Reporting / querying

```sql
-- Latest articles across all municipalities
SELECT a.title, a.url, a.published_at, m.name AS municipality
FROM articles a
JOIN municipalities m ON a.municipality_id = m.id
ORDER BY a.published_at DESC
LIMIT 50;

-- Articles for a specific municipality
SELECT title, url, published_at
FROM articles
WHERE municipality_id = ?
ORDER BY published_at DESC;

-- Articles from the last 7 days
SELECT a.title, a.url, m.name
FROM articles a
JOIN municipalities m ON a.municipality_id = m.id
WHERE a.published_at >= date('now', '-7 days')
ORDER BY a.published_at DESC;

-- Run summary: last 10 runs
SELECT id, started_at, finished_at, status,
       total_sites, sites_success, sites_failed,
       articles_found, articles_new
FROM scrape_runs
ORDER BY started_at DESC
LIMIT 10;

-- Most failing municipalities
SELECT m.name, COUNT(*) AS error_count
FROM scrape_errors e
JOIN municipalities m ON e.municipality_id = m.id
GROUP BY m.name
ORDER BY error_count DESC
LIMIT 20;

-- Error breakdown by type for a specific run
SELECT error_type, COUNT(*) AS count
FROM scrape_errors
WHERE run_id = ?
GROUP BY error_type;
```

---

## Design Decisions

### Why TEXT for dates (not INTEGER/Unix timestamps)?
SQLite has no native date type. ISO 8601 strings (`2026-03-15T14:30:00Z`) are human-readable, sort correctly as text, and work with SQLite's built-in `date()`, `datetime()`, and `strftime()` functions. They also map directly to JavaScript `Date` and PostgreSQL `TIMESTAMP` when migrating.

### Why UNIQUE on articles.url instead of a hash?
The full URL is already stored and is the natural dedup key. A hash would add complexity without saving space (the URL is stored either way). SQLite's B-tree index on TEXT works well for this.

### Why ON DELETE CASCADE?
If a municipality is removed, its articles and error logs should go with it. This keeps the database consistent without requiring application-level cleanup.

### Why WAL mode?
WAL (Write-Ahead Logging) allows concurrent reads while a write is in progress. This matters when the scraper is writing new articles while a reporting query runs simultaneously.

---

## Migration Path to PostgreSQL

When moving from SQLite to PostgreSQL, the following changes are needed:

| SQLite | PostgreSQL | Notes |
|--------|-----------|-------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` or `BIGSERIAL` | PostgreSQL handles auto-increment differently |
| `TEXT` for dates | `TIMESTAMPTZ` | Use proper timestamp type; existing ISO strings parse directly |
| `INTEGER` for boolean (`active`) | `BOOLEAN` | Change `DEFAULT 1` to `DEFAULT TRUE` |
| `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')` | `NOW()` or `CURRENT_TIMESTAMP` | Default value expressions |
| `CHECK (category IN (...))` | `CREATE TYPE category_enum AS ENUM (...)` | Optional; CHECK works in PG too |
| `INSERT OR IGNORE` | `INSERT ... ON CONFLICT (url) DO NOTHING` | PostgreSQL uses ON CONFLICT syntax |
| `PRAGMA journal_mode = WAL` | Remove | Not applicable |
| `PRAGMA foreign_keys = ON` | Remove | Foreign keys are always enforced in PG |

The table structure, column names, and indexes remain the same. The migration can be scripted by replacing the SQLite-specific syntax listed above.
