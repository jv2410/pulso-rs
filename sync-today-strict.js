#!/usr/bin/env node
// Sync estrito: pega SOMENTE notícias publicadas em TODAY, dedupe por URL.
require('dotenv').config({ path: __dirname + '/.env' });
process.env.SKIP_LLM = 'true';
process.env.SKIP_LLM_DATE = 'false';
process.env.PLAYWRIGHT_MAX_PER_RUN = process.env.PLAYWRIGHT_MAX_PER_RUN || '500';
process.env.PLAYWRIGHT_PAGE_TIMEOUT_MS = process.env.PLAYWRIGHT_PAGE_TIMEOUT_MS || '20000';

const { createClient } = require('@supabase/supabase-js');
const { getScraperForSite } = require('./src/scrapers/ScraperFactory');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const HARD = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('hard_timeout_'+ms)), ms))]);

// Normalização canônica de URL (Atlas 2026-07-06): a MESMA notícia às vezes é
// servida como http:// e https:// (ou com/sem www, com/sem barra final). Como o
// upsert usa onConflict:'url', essas variantes viravam LINHAS DIFERENTES — o
// usuário marcava uma como inválida (score 0) e o sync re-inseria a variante,
// fazendo a notícia "voltar" ao feed. Normalizar previne isso e corta duplicatas.
const normUrl = (u) => (u || '').trim().toLowerCase()
  .replace(/^https?:\/\//, '').replace(/^www\./, '')
  .replace(/[?#].*$/, '').replace(/\/+$/, '');

const TODAY = process.argv[2] || new Date().toISOString().slice(0, 10);
// Janela D-1 (Atlas 2026-06-10): publicações da noite anterior só aparecem no
// run seguinte; sem esta janela elas eram descartadas para sempre (skipOld).
// Dedupe por URL (existingUrls + upsert onConflict) impede duplicatas.
const YESTERDAY = (() => { const t = new Date(TODAY + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); })();
const WINDOW_START = YESTERDAY + 'T00:00:00';
const TODAY_END   = TODAY + 'T23:59:59';

async function main() {
  const { data: munis } = await sb.from('municipalities').select('*').eq('active', true);
  console.log(`Sync ESTRITO de ${TODAY} (janela D-1: aceita ${YESTERDAY}) em ${munis.length} cidades ativas\n`);

  // URLs já no DB hoje pra evitar re-fetch (comparadas por forma NORMALIZADA,
  // pra dedup também pegar variantes http/https/www).
  const ids = munis.map(m => m.id);
  const existingUrls = new Set();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await sb.from('articles').select('url').in('municipality_id', ids.slice(i, i+100)).gte('published_at', WINDOW_START).lte('published_at', TODAY_END);
    for (const a of data||[]) existingUrls.add(normUrl(a.url));
  }
  console.log(`URLs já no DB hoje: ${existingUrls.size}`);

  // PROTEÇÃO DE INVALIDAÇÕES (Atlas 2026-06-24, normalizada 2026-07-06): notícias
  // marcadas como inválidas (relevance_score = 0) NUNCA podem ser re-inseridas —
  // nem pela URL exata nem por variante http/https/www. Comparação normalizada.
  let invPage = 0; const invSet = new Set();
  while (true) {
    const { data } = await sb.from('articles').select('url').eq('relevance_score', 0).range(invPage*1000, invPage*1000+999);
    if (!data || !data.length) break;
    for (const a of data) { const n = normUrl(a.url); existingUrls.add(n); invSet.add(n); }
    if (data.length < 1000) break; invPage++;
  }
  console.log(`URLs invalidadas protegidas: ${invSet.size}\n`);

  const pLimit = (await import('p-limit')).default;
  const limit = pLimit(10);
  const stats = { processed: 0, ok: 0, errors: 0, today: 0, inserted: 0, skipDup: 0, skipOld: 0, skipFuture: 0, skipNoDate: 0 };
  const errs = {};
  const start = Date.now();

  await Promise.all(munis.map(m => limit(async () => {
    try {
      const cfg = { REQUEST_TIMEOUT_MS: 25000, MAX_RETRIES: 2, USER_AGENT: 'Mozilla/5.0', LOOKBACK_DAYS: 2 };
      const s = getScraperForSite(m, cfg);
      // Force scraper's "today" to TARGET (in case it's used for filtering)
      s._getTodayString = () => TODAY;
      const r = await HARD(s.scrape(m), 120000);
      const arts = r.articles || [];
      if (arts.length > 0) stats.ok++;

      for (const a of arts) {
        if (!a.publishedAt) { stats.skipNoDate++; continue; }
        const d = a.publishedAt.slice(0, 10);
        if (d > TODAY) { stats.skipFuture++; continue; }
        if (d < YESTERDAY) { stats.skipOld++; continue; }
        // d === TODAY ou YESTERDAY (janela D-1)
        stats.today++;
        if (existingUrls.has(normUrl(a.url))) { stats.skipDup++; continue; }
        // Auto-skip score 1 (lixo: títulos genéricos, listas administrativas)
        if (a.relevanceScore === 1) { stats.skipScore1 = (stats.skipScore1||0) + 1; continue; }
        const { error, data } = await sb.from('articles').upsert({
          municipality_id: m.id, title: a.title, url: a.url,
          published_at: a.publishedAt, content: a.content,
          summary: a.summary, category: a.category,
          relevance_score: a.relevanceScore || null,
          image_url: a.imageUrl || null,
        }, { onConflict: 'url', ignoreDuplicates: false }).select();
        if (!error && data?.length) {
          stats.inserted++;
          existingUrls.add(normUrl(a.url));
        } else if (data && !data.length) {
          stats.skipDup++;
        }
      }
    } catch (e) {
      stats.errors++;
      const k = (e.message||'').slice(0, 40);
      errs[k] = (errs[k]||0)+1;
    }
    stats.processed++;
    if (stats.processed % 30 === 0 || stats.processed === munis.length) {
      const el = ((Date.now()-start)/1000).toFixed(0);
      process.stdout.write(`\r[${stats.processed}/${munis.length}] (${el}s) ok:${stats.ok} hoje:${stats.today} ins:${stats.inserted} dup:${stats.skipDup} old:${stats.skipOld} fut:${stats.skipFuture} err:${stats.errors}    `);
    }
  })));

  console.log('\n\n=== RESULTADO SYNC ESTRITO ===');
  console.log(`Cidades com qualquer notícia: ${stats.ok}/${munis.length}`);
  console.log(`Artigos na janela ${YESTERDAY}..${TODAY}: ${stats.today}`);
  console.log(`  → INSERIDOS novos: ${stats.inserted}`);
  console.log(`  → DUPLICATAS skip: ${stats.skipDup}`);
  console.log(`Artigos descartados (não-hoje):`);
  console.log(`  antigos: ${stats.skipOld} | futuros: ${stats.skipFuture} | sem data: ${stats.skipNoDate}`);
  if (stats.skipScore1) console.log(`  score 1 (lixo): ${stats.skipScore1}`);
  console.log(`Erros: ${stats.errors}`);
  if (stats.errors) {
    Object.entries(errs).sort((a,b)=>b[1]-a[1]).slice(0,8).forEach(([k,v]) => console.log(`  ${v}× ${k}`));
  }

  try { await require('./src/scrapers/BrowserPool').getInstance().close(); } catch {}
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
