# Architecture: News Dashboard

**Version:** 1.0
**Date:** 2026-03-16
**Author:** Aria (System Architect)
**Status:** Approved

---

## 1. Problem Statement

The scraper collects news daily from ~497 RS municipal government sites into SQLite. The client needs a web dashboard showing daily news, coverage statistics, and progress evolution. It must be deployable to a free-tier hosting platform (Vercel, Netlify, or Railway).

---

## 2. Architecture Decision: Static Site with Pre-built JSON

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **A. Next.js on Railway with SQLite** | Direct DB access, real-time data | Railway free tier limits; SQLite file must be in the container; complex deploy |
| **B. Next.js API routes + hosted DB (Postgres/Turso)** | Real-time queries, scalable | Adds a paid service; migration effort; overkill for daily-batch data |
| **C. Next.js static export + JSON files** | Free hosting (Vercel/Netlify); fast; simple; no server | Data only as fresh as last build; no real-time queries |

### Decision: Option C

**Rationale:** The scraper runs once daily. Data does not change between runs. A static site with pre-built JSON files is the simplest, cheapest, and fastest approach. The scraper already finishes its run and has all the data -- generating JSON files is a trivial post-processing step.

### How It Works

```
Daily Scraper Run (local machine)
        |
        v
  SQLite DB updated
        |
        v
  JSON export script runs         <-- new build step
  (reads SQLite, writes JSON)
        |
        v
  data/dashboard/*.json files
        |
        v
  Next.js static build             <-- next build && next export
  (reads JSON at build time)
        |
        v
  Deploy to Vercel/Netlify          <-- git push or CLI deploy
  (static HTML/CSS/JS)
```

---

## 3. Tech Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Framework | Next.js 14+ (App Router) | SSG support, file-based routing, React Server Components for build-time data loading |
| Styling | Tailwind CSS | Utility-first, fast prototyping, small bundle |
| Charts | Recharts | Lightweight, React-native, good for line/bar charts |
| Icons | Lucide React | Consistent icon set, tree-shakeable |
| Data layer | Static JSON files (generated from SQLite) | No runtime DB needed |
| Export script | Node.js + better-sqlite3 | Same dependency the scraper already uses |
| Deployment | Vercel (primary) or Netlify (fallback) | Free tier, automatic deploys from git |

### What We Do NOT Need

- No database in production
- No API routes
- No authentication (public dashboard)
- No server runtime (pure static)

---

## 4. Project Structure

```
dashboard/                          <-- new directory at project root
├── package.json
├── next.config.js                  <-- output: 'export' for static build
├── tailwind.config.js
├── tsconfig.json                   <-- TypeScript for the dashboard
│
├── public/
│   └── data/                       <-- JSON files copied here at build time
│       ├── today.json
│       ├── stats.json
│       └── municipalities.json
│
├── src/
│   ├── app/
│   │   ├── layout.tsx              <-- Root layout with nav, Tailwind
│   │   ├── page.tsx                <-- Homepage (overview stats)
│   │   ├── noticias/
│   │   │   └── page.tsx            <-- News feed page
│   │   ├── estatisticas/
│   │   │   └── page.tsx            <-- Charts and statistics
│   │   └── municipios/
│   │       └── page.tsx            <-- Municipality status list
│   │
│   ├── components/
│   │   ├── StatCard.tsx            <-- Reusable stat display card
│   │   ├── NewsCard.tsx            <-- Article card component
│   │   ├── MunicipalityTable.tsx   <-- Sortable/filterable table
│   │   ├── CoverageChart.tsx       <-- Daily coverage line chart
│   │   ├── SearchBar.tsx           <-- Client-side search/filter
│   │   └── Header.tsx              <-- Navigation header
│   │
│   ├── lib/
│   │   └── data.ts                 <-- Functions to load JSON files
│   │
│   └── types/
│       └── index.ts                <-- TypeScript interfaces
│
└── scripts/
    └── export-json.js              <-- SQLite -> JSON export script
```

This lives as a separate directory (not a subdirectory of `src/`) because the dashboard is a separate deployable artifact with its own `package.json` and build pipeline.

---

## 5. Data Files Specification

### 5.1 `today.json`

Contains today's scraped articles, grouped by municipality.

```typescript
interface TodayData {
  date: string;                     // "2026-03-16"
  totalArticles: number;
  totalMunicipalities: number;      // municipalities that had articles today
  articles: ArticleGroup[];
}

interface ArticleGroup {
  municipality: string;             // "Porto Alegre"
  municipalityId: number;
  articles: Article[];
}

interface Article {
  title: string;
  url: string;
  publishedAt: string | null;       // ISO date
  scrapedAt: string;
}
```

### 5.2 `stats.json`

Daily aggregated statistics for charting coverage evolution.

```typescript
interface StatsData {
  generatedAt: string;
  dailyStats: DailyStat[];          // one entry per day since March 9
  totals: {
    totalArticles: number;
    totalDays: number;
    averageArticlesPerDay: number;
    averageMunicipalitiesPerDay: number;
  };
}

interface DailyStat {
  date: string;                     // "2026-03-09"
  articlesScraped: number;
  newArticles: number;
  municipalitiesCovered: number;    // unique municipalities with articles
  sitesSuccess: number;
  sitesFailed: number;
  scrapeRunId: number;
}
```

### 5.3 `municipalities.json`

Status of every municipality site.

```typescript
interface MunicipalitiesData {
  total: number;                    // 497
  active: number;
  working: number;                  // had at least 1 article in last run
  failing: number;                  // active but errored in last run
  municipalities: MunicipalityStatus[];
}

interface MunicipalityStatus {
  id: number;
  name: string;
  siteUrl: string;
  category: string;                 // "gov.br", "atende.net", etc.
  active: boolean;
  status: "working" | "failing" | "inactive" | "no_data";
  lastArticleDate: string | null;
  totalArticles: number;
  lastError: string | null;
}
```

---

## 6. Dashboard Pages

### 6.1 Homepage (`/`)

**Purpose:** At-a-glance overview of today's scraping results.

**Content:**
- 4 stat cards: Articles today, Municipalities covered, Success rate, Total articles (all time)
- Mini line chart: articles per day for the last 7 days
- Quick links to other pages

### 6.2 News Feed (`/noticias`)

**Purpose:** Browse today's news articles.

**Content:**
- Client-side search bar (filters by title or municipality name)
- Articles grouped by municipality, sorted alphabetically
- Each article shows: title (linked to source), municipality name, published date
- Badge showing article count per municipality

### 6.3 Statistics (`/estatisticas`)

**Purpose:** Visualize scraping coverage evolution since project start (March 9).

**Content:**
- Line chart: articles per day
- Line chart: municipalities covered per day
- Bar chart: success vs. failed sites per day
- Summary cards: averages, totals, growth trend

### 6.4 Municipality List (`/municipios`)

**Purpose:** Show status of all 497 monitored sites.

**Content:**
- Sortable, filterable table with all municipalities
- Columns: Name, Category, Status (color-coded badge), Last Article, Total Articles, Last Error
- Filter by status: working / failing / inactive / no data
- Search by municipality name

---

## 7. JSON Export Script

The `scripts/export-json.js` script runs after each scraper execution and before each dashboard build.

### Logic

```
1. Open SQLite database (read-only)
2. Query today's articles joined with municipalities -> write today.json
3. Query scrape_runs + aggregated article counts per day -> write stats.json
4. Query all municipalities + latest error + article count -> write municipalities.json
5. Close database
```

### Key Queries

- **Today's articles:** `SELECT ... FROM articles a JOIN municipalities m ON a.municipality_id = m.id WHERE date(a.scraped_at) = date('now') ORDER BY m.name, a.published_at DESC`
- **Daily stats:** `SELECT date(started_at) as date, articles_new, sites_success, sites_failed FROM scrape_runs WHERE status = 'completed' ORDER BY started_at`
- **Municipality status:** LEFT JOIN municipalities with latest scrape_errors and article counts

### Output Location

Files are written to `dashboard/public/data/` so Next.js can read them at build time and they are served as static assets.

---

## 8. Historical Data Simulation

To demonstrate the dashboard from day one, we need to backfill data for March 9-15, 2026.

### Simulation Script: `scripts/simulate-history.js`

Creates realistic historical records in the SQLite database.

### Data Profile

| Date | Day | Articles | Municipalities | Success Rate | Narrative |
|------|-----|----------|---------------|-------------|-----------|
| March 9 (Mon) | 1 | 52 | 180 | 36% | First run, many sites failing, initial calibration |
| March 10 (Tue) | 2 | 78 | 210 | 42% | Bug fixes, more scrapers working |
| March 11 (Wed) | 3 | 95 | 245 | 49% | Added AtendeNet support |
| March 12 (Thu) | 4 | 118 | 280 | 56% | Generic scraper improved |
| March 13 (Fri) | 5 | 134 | 305 | 61% | Stabilizing, retry logic tuned |
| March 14 (Sat) | 6 | 89 | 290 | 58% | Weekend: fewer articles published by municipalities |
| March 15 (Sun) | 7 | 67 | 270 | 54% | Weekend: lower output, some sites down for maintenance |

### What Gets Created

1. **scrape_runs:** One completed run per day with matching stats
2. **articles:** Randomly selected municipalities get 0-3 articles each per day, with realistic titles (template-based: "Prefeitura de {municipality} {action} {topic}")
3. **scrape_errors:** Proportional to the failure rate, distributed across municipalities with realistic error types (timeout, ssl, parse)

### Constraints

- Article URLs must be unique (use date + municipality_id + index pattern)
- `published_at` should match the run date
- `scraped_at` timestamps should fall within a realistic 30-45 minute window per run
- Error distribution: timeout (40%), ssl (20%), parse (25%), network (10%), http (5%)

---

## 9. Build and Deploy Pipeline

### Local Development

```bash
cd dashboard
npm install
npm run dev                         # Next.js dev server at localhost:3000
```

JSON files in `public/data/` are read directly during development. For initial setup, run the export script once.

### Production Build

```bash
# 1. Run scraper (already scheduled via cron)
npm run start                       # from project root

# 2. Export JSON from SQLite
node scripts/export-json.js

# 3. Build static dashboard
cd dashboard && npm run build       # produces 'out/' directory

# 4. Deploy
# Option A: Push to GitHub -> Vercel auto-deploys
# Option B: vercel deploy --prod (Vercel CLI)
# Option C: netlify deploy --prod --dir=out (Netlify CLI)
```

### Vercel Configuration

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "out",
  "framework": "nextjs",
  "rootDirectory": "dashboard"
}
```

### Daily Update Flow

The scraper machine runs this sequence daily after the scrape completes:

```
scraper finishes -> export-json.js -> git commit JSON files -> git push -> Vercel auto-deploys
```

Alternative (no git for data): use Vercel CLI `vercel deploy` directly from the build script.

---

## 10. Design Decisions Summary

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| Static export over server-side | Static JSON + SSG | Data updates once daily; no need for server runtime; free hosting |
| Separate `dashboard/` directory | Own package.json | Independent build, deploy, and dependency management from scraper |
| JSON files over API | Pre-built JSON in `public/` | Zero runtime cost; works on any static host; cacheable by CDN |
| Recharts for charts | Recharts | React-native, lightweight, sufficient for line/bar charts |
| TypeScript for dashboard | `.tsx` files | Type safety for data structures; catches JSON shape mismatches at build time |
| Client-side search only | Filter in browser | Dataset is small (~150 articles/day); no server needed for search |
| Simulated history in SQLite | Backfill records in same DB | Export script works the same for real and simulated data; single source of truth |

---

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| JSON files grow large over time | Slow page loads | `today.json` only contains current day; `stats.json` is aggregated (one row per day); pagination if needed later |
| Vercel free tier build limits | Blocked deploys | Static site builds are fast (~30s); well within 6000 min/month free tier |
| SQLite locked during export | Export script fails | Open database in read-only mode; scraper and export never run simultaneously (sequential in cron) |
| Client needs real-time data later | Architecture change | Migrate to Next.js on Railway with API routes; JSON structure maps directly to API response shape |

---

## 12. Implementation Order

1. **Simulation script** (`scripts/simulate-history.js`) -- backfill March 9-15 data
2. **JSON export script** (`scripts/export-json.js`) -- SQLite to JSON
3. **Dashboard scaffold** -- Next.js + Tailwind + TypeScript setup
4. **Homepage** -- stat cards + mini chart
5. **News feed page** -- article list with search
6. **Statistics page** -- coverage evolution charts
7. **Municipality list page** -- status table
8. **Deploy to Vercel** -- connect repo, configure build
9. **Integrate with scraper cron** -- auto-export + auto-deploy after each run
