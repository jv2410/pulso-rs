/**
 * Database query functions using better-sqlite3 prepared statements.
 * All functions receive a db instance as the first argument.
 */

function insertMunicipality(db, data) {
  const stmt = db.prepare(`
    INSERT INTO municipalities (name, association, site_url, news_url, category, scraper_type, active)
    VALUES (@name, @association, @site_url, @news_url, @category, @scraper_type, @active)
    ON CONFLICT(name) DO UPDATE SET
      association  = excluded.association,
      site_url     = excluded.site_url,
      news_url     = excluded.news_url,
      category     = excluded.category,
      scraper_type = excluded.scraper_type,
      active       = excluded.active,
      updated_at   = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  `);
  return stmt.run(data);
}

function insertArticle(db, data) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO articles (municipality_id, title, url, published_at, content, summary)
    VALUES (@municipality_id, @title, @url, @published_at, @content, @summary)
  `);
  return stmt.run({ ...data, summary: data.summary || null });
}

function createScrapeRun(db) {
  const stmt = db.prepare(`
    INSERT INTO scrape_runs (status) VALUES ('running')
  `);
  const result = stmt.run();
  return result.lastInsertRowid;
}

function updateScrapeRun(db, id, data) {
  const stmt = db.prepare(`
    UPDATE scrape_runs SET
      finished_at    = @finished_at,
      total_sites    = @total_sites,
      sites_success  = @sites_success,
      sites_failed   = @sites_failed,
      articles_found = @articles_found,
      articles_new   = @articles_new,
      status         = @status
    WHERE id = @id
  `);
  return stmt.run({ id, ...data });
}

function insertScrapeError(db, data) {
  const stmt = db.prepare(`
    INSERT INTO scrape_errors (run_id, municipality_id, error_message, error_type)
    VALUES (@run_id, @municipality_id, @error_message, @error_type)
  `);
  return stmt.run(data);
}

function getActiveMunicipalities(db) {
  return db.prepare('SELECT * FROM municipalities WHERE active = 1').all();
}

function getArticlesByDate(db, date) {
  return db.prepare(`
    SELECT a.*, m.name AS municipality_name
    FROM articles a
    JOIN municipalities m ON a.municipality_id = m.id
    WHERE date(a.published_at) = date(?)
    ORDER BY a.published_at DESC
  `).all(date);
}

function getMunicipalityByName(db, name) {
  return db.prepare('SELECT * FROM municipalities WHERE name = ?').get(name);
}

module.exports = {
  insertMunicipality,
  insertArticle,
  createScrapeRun,
  updateScrapeRun,
  insertScrapeError,
  getActiveMunicipalities,
  getArticlesByDate,
  getMunicipalityByName
};
