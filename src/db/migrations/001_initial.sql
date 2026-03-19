-- Migration 001: Initial Schema
-- News Scraping System for RS Municipal Government Sites
-- SQLite compatible
-- Created: 2026-03-15

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================================
-- municipalities
-- ============================================================================
-- Each row represents one of the ~497 municipal government sites in RS.

CREATE TABLE IF NOT EXISTS municipalities (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    association TEXT,
    site_url    TEXT    NOT NULL,
    news_url    TEXT,
    category    TEXT    CHECK (category IN ('gov.br', 'atende.net', 'com.br', 'other')),
    scraper_type TEXT,
    active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_municipalities_category ON municipalities(category);
CREATE INDEX idx_municipalities_active ON municipalities(active);
CREATE INDEX idx_municipalities_association ON municipalities(association);

-- ============================================================================
-- articles
-- ============================================================================
-- Each row is a single news article scraped from a municipality site.
-- The url column is UNIQUE to enforce deduplication.

CREATE TABLE IF NOT EXISTS articles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    municipality_id INTEGER NOT NULL,
    title           TEXT    NOT NULL,
    url             TEXT    NOT NULL UNIQUE,
    published_at    TEXT,
    content         TEXT,
    scraped_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE CASCADE
);

CREATE INDEX idx_articles_municipality_id ON articles(municipality_id);
CREATE INDEX idx_articles_published_at ON articles(published_at);
CREATE INDEX idx_articles_scraped_at ON articles(scraped_at);
-- url already has a UNIQUE index from the column constraint

-- ============================================================================
-- scrape_runs
-- ============================================================================
-- Each row tracks a full scraping execution across all (or a subset of) sites.

CREATE TABLE IF NOT EXISTS scrape_runs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    finished_at    TEXT,
    total_sites    INTEGER DEFAULT 0,
    sites_success  INTEGER DEFAULT 0,
    sites_failed   INTEGER DEFAULT 0,
    articles_found INTEGER DEFAULT 0,
    articles_new   INTEGER DEFAULT 0,
    status         TEXT    NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX idx_scrape_runs_status ON scrape_runs(status);
CREATE INDEX idx_scrape_runs_started_at ON scrape_runs(started_at);

-- ============================================================================
-- scrape_errors
-- ============================================================================
-- Detailed error log per municipality per run.

CREATE TABLE IF NOT EXISTS scrape_errors (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          INTEGER NOT NULL,
    municipality_id INTEGER NOT NULL,
    error_message   TEXT,
    error_type      TEXT    CHECK (error_type IN ('timeout', 'ssl', 'parse', 'network', 'http', 'unknown')),
    occurred_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    FOREIGN KEY (run_id) REFERENCES scrape_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE CASCADE
);

CREATE INDEX idx_scrape_errors_run_id ON scrape_errors(run_id);
CREATE INDEX idx_scrape_errors_municipality_id ON scrape_errors(municipality_id);
CREATE INDEX idx_scrape_errors_error_type ON scrape_errors(error_type);
