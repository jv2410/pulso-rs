#!/usr/bin/env node

/**
 * Export SQLite data to JSON files for the dashboard.
 * Reads from data/scraper.db and writes to dashboard/public/data/
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '..', '..');
const DB_PATH = path.join(ROOT, 'data', 'scraper.db');
const OUTPUT_DIR = path.join(ROOT, 'dashboard', 'public', 'data');

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const db = new Database(DB_PATH, { readonly: true });

// ---------- today.json ----------
function exportToday() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const articles = db.prepare(`
    SELECT
      m.name AS municipality,
      a.title,
      a.url,
      a.published_at AS publishedAt,
      a.scraped_at AS scrapedAt
    FROM articles a
    JOIN municipalities m ON m.id = a.municipality_id
    WHERE a.published_at IS NOT NULL AND date(a.published_at) = ?
    ORDER BY a.published_at DESC
  `).all(today);

  // Add summary to today's articles
  for (const a of articles) {
    if (!a.summary) delete a.summary;
  }

  const municipalities = new Set(articles.map(a => a.municipality));

  const data = {
    date: today,
    totalArticles: articles.length,
    totalMunicipalities: municipalities.size,
    articles,
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'today.json'), JSON.stringify(data, null, 2));
  console.log(`today.json: ${articles.length} articles, ${municipalities.size} municipalities`);
}

// ---------- stats.json ----------
function exportStats() {
  const daily = db.prepare(`
    SELECT
      date(published_at) AS date,
      COUNT(*) AS articles,
      COUNT(DISTINCT municipality_id) AS municipalities
    FROM articles
    WHERE published_at IS NOT NULL
    GROUP BY date(published_at)
    ORDER BY date(published_at)
  `).all();

  const totalArticles = db.prepare('SELECT COUNT(*) AS n FROM articles').get().n;
  const totalMunicipalities = db.prepare('SELECT COUNT(*) AS n FROM municipalities').get().n;
  const activeMunicipalities = db.prepare('SELECT COUNT(DISTINCT municipality_id) AS n FROM articles').get().n;
  const coveragePercent = totalMunicipalities > 0
    ? Math.round((activeMunicipalities / totalMunicipalities) * 1000) / 10
    : 0;

  const data = {
    daily,
    totals: {
      totalArticles,
      totalMunicipalities,
      totalSites: totalMunicipalities,
      coveragePercent,
    },
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'stats.json'), JSON.stringify(data, null, 2));
  console.log(`stats.json: ${daily.length} days, ${totalArticles} total articles`);
}

// ---------- municipalities.json ----------
function exportMunicipalities() {
  const rows = db.prepare(`
    SELECT
      m.name,
      m.association,
      m.site_url AS siteUrl,
      m.category,
      COUNT(a.id) AS articleCount
    FROM municipalities m
    LEFT JOIN articles a ON a.municipality_id = m.id
    GROUP BY m.id
    ORDER BY m.name
  `).all();

  const data = rows.map(r => ({
    name: r.name,
    association: r.association || '',
    siteUrl: r.siteUrl,
    category: r.category || 'other',
    status: r.articleCount > 0 ? 'ok' : 'failed',
    articleCount: r.articleCount,
  }));

  fs.writeFileSync(path.join(OUTPUT_DIR, 'municipalities.json'), JSON.stringify(data, null, 2));
  console.log(`municipalities.json: ${data.length} municipalities, ${data.filter(d => d.status === 'ok').length} with articles`);
}

// ---------- articles-by-date.json ----------
function exportArticlesByDate() {
  // Only include articles that have a real published_at date
  const rows = db.prepare(`
    SELECT
      date(a.published_at) AS date,
      m.name AS municipality,
      a.title,
      a.url,
      a.published_at AS publishedAt,
      a.scraped_at AS scrapedAt,
      a.summary
    FROM articles a
    JOIN municipalities m ON m.id = a.municipality_id
    WHERE a.published_at IS NOT NULL
    ORDER BY date(a.published_at) DESC, a.published_at DESC
  `).all();

  const byDate = {};
  for (const row of rows) {
    const d = row.date;
    if (!byDate[d]) {
      byDate[d] = { totalArticles: 0, totalMunicipalities: 0, articles: [], _muniSet: new Set() };
    }
    const article = {
      municipality: row.municipality,
      title: row.title,
      url: row.url,
      publishedAt: row.publishedAt,
      scrapedAt: row.scrapedAt,
    };
    if (row.summary) article.summary = row.summary;
    byDate[d].articles.push(article);
    byDate[d]._muniSet.add(row.municipality);
    byDate[d].totalArticles++;
  }

  const dates = Object.keys(byDate).sort().reverse();
  for (const d of dates) {
    byDate[d].totalMunicipalities = byDate[d]._muniSet.size;
    delete byDate[d]._muniSet;
  }

  const data = { dates, byDate };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'articles-by-date.json'), JSON.stringify(data, null, 2));
  console.log(`articles-by-date.json: ${dates.length} dates, ${rows.length} total articles`);
}

try {
  exportToday();
  exportStats();
  exportMunicipalities();
  exportArticlesByDate();
  console.log('\nExport complete! Files written to dashboard/public/data/');
} catch (error) {
  console.error('Export failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
