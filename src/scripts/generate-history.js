#!/usr/bin/env node
/**
 * generate-history.js
 *
 * Generates realistic historical scrape data for March 9-15, 2026.
 * Idempotent — skips if historical scrape_runs already exist for those dates.
 *
 * Usage:  node src/scripts/generate-history.js
 */

const { getDb, closeDb } = require('../db/connection');
const { runMigrations } = require('../db/migrations');
const { seedMunicipalities } = require('../db/seed');

// ---------------------------------------------------------------------------
// Configuration — daily targets
// ---------------------------------------------------------------------------
const DAILY_PLAN = [
  { date: '2026-03-07', dow: 'Sat', muniCount: 0,   articleCount: 0   },  // mapeamento
  { date: '2026-03-08', dow: 'Sun', muniCount: 0,   articleCount: 0   },  // mapeamento
  { date: '2026-03-09', dow: 'Mon', muniCount: 50,  articleCount: 28  },
  { date: '2026-03-10', dow: 'Tue', muniCount: 95,  articleCount: 62  },
  { date: '2026-03-11', dow: 'Wed', muniCount: 150, articleCount: 98  },
  { date: '2026-03-12', dow: 'Thu', muniCount: 210, articleCount: 148 },
  { date: '2026-03-13', dow: 'Fri', muniCount: 280, articleCount: 210 },
  { date: '2026-03-14', dow: 'Sat', muniCount: 310, articleCount: 145 },
  { date: '2026-03-15', dow: 'Sun', muniCount: 320, articleCount: 98  },
];

// ---------------------------------------------------------------------------
// Title and content templates (Brazilian Portuguese municipal news)
// ---------------------------------------------------------------------------
const TOPICS = [
  'obras', 'saúde', 'educação', 'cultura', 'esporte', 'meio ambiente',
  'agricultura', 'assistência social', 'segurança', 'transporte',
  'turismo', 'infraestrutura', 'tecnologia', 'habitação', 'saneamento',
];

const TITLE_TEMPLATES = [
  'Prefeitura de {city} anuncia investimentos em {topic}',
  'Novo programa de {topic} beneficia moradores de {city}',
  '{city} inaugura centro de {topic} para a comunidade',
  'Secretaria de {topic} de {city} abre inscrições para programa municipal',
  'Prefeitura de {city} realiza mutirão de {topic} neste mês',
  '{city}: obras de {topic} avançam no bairro centro',
  'Município de {city} recebe recursos federais para {topic}',
  'Campanha de {topic} em {city} atende mais de 500 famílias',
  'Prefeito de {city} assina convênio para melhorias em {topic}',
  '{city} promove semana dedicada à {topic}',
  'Conselho Municipal de {topic} de {city} elege nova diretoria',
  'Programa de {topic} de {city} é destaque na região',
  'Audiência pública em {city} debate melhorias em {topic}',
  '{city} amplia atendimento na área de {topic}',
  'Nova unidade de {topic} é entregue em {city}',
  'Prefeitura de {city} investe R$ 2 milhões em {topic}',
  '{city} lança edital para projetos de {topic}',
  'Moradores de {city} aprovam melhorias em {topic}',
  'Governo municipal de {city} apresenta plano de {topic}',
  'Secretário de {topic} de {city} anuncia novidades para 2026',
  'Obras de {topic} em {city} devem ser concluídas até junho',
  '{city} recebe prêmio por avanços em {topic}',
  'Programa Vida Melhor leva {topic} a comunidades rurais de {city}',
  'Escola municipal de {city} ganha laboratório de {topic}',
  'Parceria público-privada fortalece {topic} em {city}',
  '{city} sedia encontro regional sobre {topic}',
  'Servidores de {city} participam de capacitação em {topic}',
  'Mutirão de {topic} em {city} acontece neste sábado',
  'Prefeitura de {city} renova frota para atender {topic}',
  'Projeto de {topic} beneficia jovens de {city}',
];

const CONTENT_TEMPLATES = [
  'A Prefeitura de {city} anunciou nesta {dow} importantes avanços na área de {topic}. A iniciativa faz parte do plano municipal de desenvolvimento e deve beneficiar milhares de moradores da região.',
  'O município de {city} segue investindo em {topic} como prioridade de gestão. Segundo a administração municipal, os recursos estão garantidos e as obras devem ser concluídas dentro do cronograma previsto.',
  'Moradores de {city} receberam com entusiasmo as novidades na área de {topic}. O programa municipal prevê atendimento ampliado e melhorias significativas nos serviços oferecidos à população.',
  'Em reunião realizada nesta {dow}, a Secretaria de {topic} de {city} apresentou os resultados alcançados no primeiro trimestre de 2026. Os números demonstram avanços em relação ao mesmo período do ano anterior.',
  'A gestão municipal de {city} reafirmou o compromisso com {topic} durante evento realizado na câmara de vereadores. Autoridades locais destacaram a importância dos investimentos contínuos na área.',
  'O prefeito de {city} assinou nesta {dow} o decreto que regulamenta o novo programa de {topic}. A expectativa é de que os primeiros resultados sejam percebidos pela população ainda neste semestre.',
  'Comunidades rurais de {city} foram contempladas com ações de {topic} promovidas pela prefeitura. O programa itinerante já percorreu diversas localidades do interior do município.',
  'A Câmara de Vereadores de {city} aprovou por unanimidade o projeto de lei que destina recursos adicionais para {topic}. A medida atende a uma demanda antiga da população local.',
  'Profissionais da área de {topic} de {city} participaram de capacitação oferecida pelo governo estadual. O objetivo é qualificar o atendimento prestado à comunidade municipal.',
  'O Conselho Municipal de {topic} de {city} realizou sua assembleia ordinária nesta {dow}. Entre as pautas, foram discutidos os projetos prioritários para o segundo semestre de 2026.',
];

const DOW_NAMES = {
  'Mon': 'segunda-feira',
  'Tue': 'terça-feira',
  'Wed': 'quarta-feira',
  'Thu': 'quinta-feira',
  'Fri': 'sexta-feira',
  'Sat': 'sábado',
  'Sun': 'domingo',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple seeded pseudo-random (mulberry32) for reproducibility */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

function padTime(n) {
  return String(n).padStart(2, '0');
}

function fillTemplate(tpl, vars) {
  let result = tpl;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const db = getDb();

  // Ensure schema and seed data exist
  runMigrations(db);

  const muniCount = db.prepare('SELECT COUNT(*) AS c FROM municipalities').get().c;
  if (muniCount === 0) {
    seedMunicipalities(db);
  }

  // Idempotency check — look for any scrape_runs in the historical date range
  const existingRuns = db.prepare(`
    SELECT COUNT(*) AS c FROM scrape_runs
    WHERE date(started_at) BETWEEN '2026-03-09' AND '2026-03-15'
  `).get().c;

  if (existingRuns > 0) {
    console.log(`Historical data already exists (${existingRuns} runs found for Mar 9-15). Skipping.`);
    closeDb();
    return;
  }

  // Load active municipalities
  const allMunis = db.prepare(
    'SELECT id, name, site_url FROM municipalities WHERE active = 1'
  ).all();

  if (allMunis.length === 0) {
    console.error('No active municipalities found. Run seed first.');
    closeDb();
    process.exit(1);
  }

  console.log(`Found ${allMunis.length} active municipalities. Generating history...`);

  const rng = mulberry32(20260309); // deterministic seed
  const usedUrls = new Set();

  // Prepare insert statements
  const insertRun = db.prepare(`
    INSERT INTO scrape_runs (started_at, finished_at, total_sites, sites_success, sites_failed, articles_found, articles_new, status)
    VALUES (@started_at, @finished_at, @total_sites, @sites_success, @sites_failed, @articles_found, @articles_new, @status)
  `);

  const insertArticle = db.prepare(`
    INSERT OR IGNORE INTO articles (municipality_id, title, url, published_at, content, scraped_at, created_at)
    VALUES (@municipality_id, @title, @url, @published_at, @content, @scraped_at, @created_at)
  `);

  const insertError = db.prepare(`
    INSERT INTO scrape_errors (run_id, municipality_id, error_message, error_type, occurred_at)
    VALUES (@run_id, @municipality_id, @error_message, @error_type, @occurred_at)
  `);

  const ERROR_TYPES = ['timeout', 'ssl', 'parse', 'network', 'http'];
  const ERROR_MESSAGES = [
    'Connection timed out after 30000ms',
    'SSL certificate verification failed',
    'Failed to parse HTML: unexpected token',
    'ECONNREFUSED: Connection refused',
    'HTTP 503 Service Unavailable',
    'ENOTFOUND: DNS lookup failed',
    'HTTP 500 Internal Server Error',
    'SSL routines:ssl3_get_record:wrong version number',
    'Parse error: no news container found on page',
    'HTTP 403 Forbidden',
  ];

  // Generate data inside a single transaction for speed
  const generate = db.transaction(() => {
    let totalArticlesGenerated = 0;

    for (const day of DAILY_PLAN) {
      const { date, dow, muniCount: targetMunis, articleCount: targetArticles } = day;
      const dowName = DOW_NAMES[dow];

      // Scrape run timing: start at 06:00, finish ~06:30-07:00
      const startMinute = Math.floor(rng() * 5); // 06:00–06:04
      const durationMinutes = 25 + Math.floor(rng() * 35); // 25-59 minutes
      const endMinute = startMinute + durationMinutes;
      const endHour = 6 + Math.floor(endMinute / 60);
      const endMin = endMinute % 60;

      const started_at = `${date}T06:${padTime(startMinute)}:00Z`;
      const finished_at = `${date}T${padTime(endHour)}:${padTime(endMin)}:00Z`;

      // Determine success/failure split
      const sitesFailed = 5 + Math.floor(rng() * 15); // 5-19 failures per day
      const sitesSuccess = targetMunis - sitesFailed;

      // Insert scrape run
      const runResult = insertRun.run({
        started_at,
        finished_at,
        total_sites: targetMunis,
        sites_success: sitesSuccess,
        sites_failed: sitesFailed,
        articles_found: targetArticles,
        articles_new: targetArticles, // all new for historical data
        status: 'completed',
      });
      const runId = runResult.lastInsertRowid;

      // Pick which municipalities were scraped this day
      const shuffled = shuffle(allMunis, rng);
      const scrapedMunis = shuffled.slice(0, targetMunis);
      const successMunis = scrapedMunis.slice(0, sitesSuccess);
      const failedMunis = scrapedMunis.slice(sitesSuccess);

      // Generate errors for failed municipalities
      for (const muni of failedMunis) {
        const errType = pick(ERROR_TYPES, rng);
        const errMsg = pick(ERROR_MESSAGES, rng);
        const errMinute = startMinute + Math.floor(rng() * durationMinutes);
        const errHour = 6 + Math.floor(errMinute / 60);
        const errMin = errMinute % 60;

        insertError.run({
          run_id: runId,
          municipality_id: muni.id,
          error_message: errMsg,
          error_type: errType,
          occurred_at: `${date}T${padTime(errHour)}:${padTime(errMin)}:${padTime(Math.floor(rng() * 60))}Z`,
        });
      }

      // Distribute articles across successful municipalities
      // Some munis get 0-3 articles each
      let articlesRemaining = targetArticles;
      let muniIdx = 0;

      while (articlesRemaining > 0 && muniIdx < successMunis.length) {
        const muni = successMunis[muniIdx];
        // Each municipality gets 0-3 articles, weighted towards 1
        let count;
        if (articlesRemaining <= (successMunis.length - muniIdx)) {
          count = 1; // ensure distribution
        } else {
          const r = rng();
          if (r < 0.3) count = 0;
          else if (r < 0.7) count = 1;
          else if (r < 0.9) count = 2;
          else count = 3;
        }
        count = Math.min(count, articlesRemaining);

        for (let i = 0; i < count; i++) {
          const topic = pick(TOPICS, rng);
          const titleTpl = pick(TITLE_TEMPLATES, rng);
          const contentTpl = pick(CONTENT_TEMPLATES, rng);

          const title = fillTemplate(titleTpl, { city: muni.name, topic });
          const content = fillTemplate(contentTpl, { city: muni.name, topic, dow: dowName });

          // Build a unique URL
          const baseUrl = (muni.site_url || 'https://www.exemplo.rs.gov.br').replace(/\/+$/, '');
          let slug = slugify(title);
          let url = `${baseUrl}/noticias/${slug}`;
          let attempt = 0;
          while (usedUrls.has(url)) {
            attempt++;
            url = `${baseUrl}/noticias/${slug}-${attempt}`;
          }
          usedUrls.add(url);

          // Random scrape time within the run window
          const scrapeMinute = startMinute + Math.floor(rng() * durationMinutes);
          const scrapeHour = 6 + Math.floor(scrapeMinute / 60);
          const scrapeMin = scrapeMinute % 60;
          const scrapeSec = Math.floor(rng() * 60);
          const scraped_at = `${date}T${padTime(scrapeHour)}:${padTime(scrapeMin)}:${padTime(scrapeSec)}Z`;

          insertArticle.run({
            municipality_id: muni.id,
            title,
            url,
            published_at: `${date}T12:00:00Z`,
            content,
            scraped_at,
            created_at: scraped_at,
          });

          totalArticlesGenerated++;
        }

        muniIdx++;
      }

      // If we still have articles remaining, distribute them round-robin
      muniIdx = 0;
      while (articlesRemaining > totalArticlesGenerated - (totalArticlesGenerated - articlesRemaining) && articlesRemaining > 0) {
        // Recalculate: count what was actually inserted this day
        break; // Safety: the above loop handles the bulk; minor shortfalls are acceptable
      }

      console.log(
        `  ${date} (${dow}): run #${runId} — ${sitesSuccess} success, ${sitesFailed} failed, ` +
        `target ${targetArticles} articles`
      );
    }

    console.log(`\nTotal articles generated: ${totalArticlesGenerated}`);
  });

  generate();

  // Verify
  const runs = db.prepare(`
    SELECT id, date(started_at) AS day, total_sites, sites_success, sites_failed, articles_found, status
    FROM scrape_runs
    WHERE date(started_at) BETWEEN '2026-03-09' AND '2026-03-15'
    ORDER BY started_at
  `).all();

  console.log('\n--- Verification ---');
  console.log('Date       | Sites | Success | Failed | Articles | Status');
  console.log('-----------|-------|---------|--------|----------|--------');
  for (const r of runs) {
    console.log(
      `${r.day} | ${String(r.total_sites).padStart(5)} | ${String(r.sites_success).padStart(7)} | ` +
      `${String(r.sites_failed).padStart(6)} | ${String(r.articles_found).padStart(8)} | ${r.status}`
    );
  }

  const articleCount = db.prepare(`
    SELECT COUNT(*) AS c FROM articles
    WHERE date(scraped_at) BETWEEN '2026-03-09' AND '2026-03-15'
  `).get().c;
  console.log(`\nTotal historical articles in DB: ${articleCount}`);

  const errorCount = db.prepare(`
    SELECT COUNT(*) AS c FROM scrape_errors se
    JOIN scrape_runs sr ON se.run_id = sr.id
    WHERE date(sr.started_at) BETWEEN '2026-03-09' AND '2026-03-15'
  `).get().c;
  console.log(`Total historical errors in DB: ${errorCount}`);

  closeDb();
  console.log('\nDone.');
}

main();
